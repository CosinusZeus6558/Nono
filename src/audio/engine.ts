// Moteur de lecture en direct : horloge à anticipation (pas planifiés ~120 ms à l'avance), enregistrement, aperçus.
import { ROWS, type DrumId } from '../music/presets';
import { deleteTake, saveTake } from '../store/persist';
import { projectOf, stepDur, totalSteps, uid, useStore } from '../store/project';
import type { Project } from '../store/types';
import type { TuneParams } from './dsp/autotune';
import { buildFx } from './fx';
import { Recorder } from './recorder';
import { makeMix, playStep, startTake, syncMix, type Mix } from './song';
import { click, drum } from './synths';
import { addTake, playable, removeTake } from './takes';
import type { ColorFx } from '../music/presets';

type HeadFn = (step: number) => void;

class Engine {
  ctx?: AudioContext;
  private master?: GainNode;
  private preview?: GainNode;
  private bus?: GainNode;
  private mix?: Mix;
  private timer?: ReturnType<typeof setInterval>;
  private raf = 0;
  private curStep = 0;
  private nextTime = 0;
  private queue: { step: number; time: number }[] = [];
  private lastVis: { step: number; time: number } | null = null;
  private active: AudioBufferSourceNode[] = [];
  private heads = new Set<HeadFn>();
  private rec = new Recorder();
  private recT0 = 0;
  private arming = false;
  private previewSrc: AudioBufferSourceNode | null = null;
  private previewEnd = 0;
  private previewHeads = new Set<(p: number) => void>();
  private previewT0 = 0;

  constructor() {
    useStore.subscribe((s, p) => {
      if (this.master && s.master !== p.master) this.master.gain.value = s.master / 100;
      if (this.mix && s.tracks !== p.tracks) syncMix(this.mix, s.tracks);
      if (!s.playing && s.step !== p.step) this.emitHead(s.step);
    });
  }

  private get S(): Project { return projectOf(useStore.getState()); }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const c = new AC({ latencyHint: 'interactive' });
      this.ctx = c;
      this.master = c.createGain();
      this.master.gain.value = useStore.getState().master / 100;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp).connect(c.destination);
      this.preview = c.createGain();
      this.preview.connect(this.master);
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
    return this.ctx;
  }

  onHead(fn: HeadFn) { this.heads.add(fn); fn(useStore.getState().step); return () => { this.heads.delete(fn); }; }
  private emitHead(pos: number) { this.heads.forEach(f => f(pos)); }

  private makeBus() {
    const c = this.ctx!;
    this.dropBus();
    this.bus = c.createGain(); this.bus.connect(this.master!);
    this.mix = makeMix(c, this.bus, useStore.getState().tracks);
  }
  private dropBus() {
    const c = this.ctx!;
    if (this.bus) { const old = this.bus; old.gain.setTargetAtTime(0, c.currentTime, 0.02); setTimeout(() => old.disconnect(), 300); this.bus = undefined; }
    this.active.forEach(s => { try { s.stop(); } catch { /* déjà arrêtée */ } });
    this.active = [];
  }

  private get loop() { return useStore.getState().screen === 'beats'; }

  /** Les prises déjà commencées au point de départ reprennent au bon endroit. */
  private resumeTakes(step: number, t: number) {
    if (this.loop) return;
    const S = this.S, sd = stepDur(S.bpm);
    for (const tr of S.tracks) {
      if (tr.kind !== 'rec' || tr.startStep === undefined || step <= tr.startStep) continue;
      const src = startTake(this.mix!, S, tr, t, (step - tr.startStep) * sd);
      if (src) this.active.push(src);
    }
  }

  private schedule() {
    const c = this.ctx!, S = this.S, total = totalSteps(S), loop = this.loop;
    while (this.nextTime < c.currentTime + 0.12) {
      if (this.curStep === 0) {
        // Retour au début : on coupe les prises de la boucle précédente.
        this.active.forEach(s => { try { s.stop(this.nextTime); } catch { /* */ } });
        this.active = [];
      }
      playStep(this.mix!, S, this.curStep, this.nextTime, loop, src => this.active.push(src));
      this.queue.push({ step: this.curStep, time: this.nextTime });
      this.nextTime += stepDur(S.bpm);
      this.curStep = (this.curStep + 1) % total;
    }
  }

  private restartAt(step: number, at?: number) {
    const c = this.ctx!;
    this.makeBus();
    this.curStep = step % totalSteps(this.S);
    this.nextTime = at ?? c.currentTime + 0.05;
    this.queue = []; this.lastVis = null;
    this.resumeTakes(this.curStep, this.nextTime);
  }

  play(at?: number) {
    this.ensure();
    this.restartAt(useStore.getState().step, at);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
    useStore.setState({ playing: true });
    this.startRaf();
  }

  pause() {
    clearInterval(this.timer); this.timer = undefined;
    if (useStore.getState().recording) this.stopRec();
    if (this.ctx) this.dropBus();
    this.queue = [];
    useStore.setState({ playing: false, countIn: 0 });
  }

  toggle() { if (useStore.getState().playing) this.pause(); else this.play(); }

  seek(step: number) {
    const s = useStore.getState();
    if (s.recording) return;
    useStore.setState({ step });
    if (s.playing) this.restartAt(step);
  }

  /** Relance la lecture en cours (changement d'instru, de tempo…). */
  refresh() {
    if (useStore.getState().playing && !useStore.getState().recording) this.restartAt(useStore.getState().step);
  }

  private startRaf() {
    cancelAnimationFrame(this.raf);
    const loop = () => {
      this.tick();
      if (useStore.getState().playing || this.previewSrc) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private tick() {
    const c = this.ctx; if (!c) return;
    const now = c.currentTime, st = useStore.getState();
    let cur = null;
    while (this.queue.length && this.queue[0].time <= now) cur = this.queue.shift()!;
    if (cur) {
      this.lastVis = cur;
      if (cur.step !== st.step) {
        if (st.recording) {
          if (cur.step < st.step) { this.stopRec(); }
          else useStore.setState({ liveLevels: [...st.liveLevels, ...Array(cur.step - st.step).fill(this.rec.level())] });
        }
        useStore.setState({ step: cur.step });
      }
    }
    if (st.playing && this.lastVis) this.emitHead(this.lastVis.step + Math.min(1, (now - this.lastVis.time) / stepDur(st.bpm)));
    if (this.previewSrc) {
      const p = (now - this.previewT0) / this.previewEnd;
      if (p >= 1) this.stopPreview(); else this.previewHeads.forEach(f => f(p));
    }
  }

  hit(id: DrumId) {
    const c = this.ensure();
    drum(c, id, c.currentTime, this.preview!);
    useStore.setState({ padHit: id });
    setTimeout(() => { if (useStore.getState().padHit === id) useStore.setState({ padHit: null }); }, 120);
  }

  hitKey(key: string) {
    const r = ROWS.find(r => r.key.toLowerCase() === key.toLowerCase());
    if (r) this.hit(r.id);
    return !!r;
  }

  // ---------- aperçu d'une voix (écran Voix) ----------
  onPreviewHead(fn: (p: number) => void) { this.previewHeads.add(fn); return () => { this.previewHeads.delete(fn); }; }

  previewTake(takeId: string, tune: TuneParams, fx: ColorFx) {
    const c = this.ensure();
    this.stopPreview();
    const buf = playable(takeId, tune);
    if (!buf) return 0;
    const src = c.createBufferSource(), t = c.currentTime + 0.05;
    src.buffer = buf;
    src.connect(buildFx(c, fx, this.preview!, t, t + buf.duration + 3, stepDur(useStore.getState().bpm)));
    src.start(t);
    this.previewSrc = src; this.previewT0 = t; this.previewEnd = buf.duration;
    this.startRaf();
    return buf.duration;
  }

  stopPreview() {
    if (!this.previewSrc) return;
    try { this.previewSrc.stop(); } catch { /* */ }
    this.previewSrc = null;
    this.previewHeads.forEach(f => f(-1));
    useStore.setState({ voicePlaying: null });
  }

  // ---------- enregistrement ----------
  async toggleRec() { if (useStore.getState().recording) await this.stopRec(); else await this.startRec(); }

  async startRec() {
    const st = useStore.getState();
    if (st.recording || this.arming) return;
    this.arming = true;
    const c = this.ensure();
    try {
      await this.rec.arm(c);
    } catch (e) {
      this.arming = false;
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      st.toast(denied ? 'Accès au micro refusé : autorisez-le dans le navigateur' : 'Micro indisponible sur cet appareil');
      return;
    }
    this.arming = false;
    const S = useStore.getState(), sd = stepDur(S.bpm);
    let startStep: number;
    if (S.playing) {
      startStep = this.curStep; this.recT0 = this.nextTime;
    } else {
      // Décompte d'une mesure (4 clics) avant de lancer la lecture et la prise.
      startStep = S.step;
      const beat = sd * 4, tc = c.currentTime + 0.15;
      for (let i = 0; i < 4; i++) {
        click(c, tc + i * beat, i === 0, this.preview!);
        setTimeout(() => { if (useStore.getState().recording) useStore.setState({ countIn: 4 - i }); }, (tc + i * beat - c.currentTime) * 1000);
      }
      setTimeout(() => useStore.setState({ countIn: 0 }), (tc + 4 * beat - c.currentTime) * 1000);
      this.recT0 = tc + 4 * beat;
    }
    const n = S.tracks.filter(t => t.kind === 'rec').length + 1, id = uid('rec');
    S.set({
      tracks: [...S.tracks, { id, name: 'Prise ' + n, kind: 'rec', hue: 235, vol: 90, pan: 0, mute: false, takeId: uid('take'), startStep, offsetMs: 0, tune: 'none', retune: 70, fx: 'none' }],
      sel: id, recording: true, recId: id, liveLevels: [], voiceSrc: S.screen === 'voix' ? id : S.voiceSrc,
      screen: S.screen === 'beats' ? 'studio' : S.screen,
    });
    if (!S.playing) this.play(this.recT0);
    S.toast('Enregistrement… (casque conseillé)');
  }

  async stopRec() {
    const st = useStore.getState();
    if (!st.recording) return;
    const id = st.recId!, c = this.ctx!;
    useStore.setState({ recording: false, recId: null, countIn: 0 });
    // Compensation de latence : le son capté à l'instant T correspond à ce que l'on entendait à T − latence.
    const lat = (c.baseLatency || 0) + (c.outputLatency || 0) + this.rec.inputLatency;
    const pcm = await this.rec.finish(this.recT0 + lat, c.sampleRate);
    const tr = useStore.getState().tracks.find(t => t.id === id);
    if (!tr?.takeId) return;
    if (pcm.length < c.sampleRate * 0.3) {
      useStore.getState().removeTrack(id);
      useStore.getState().toast('Prise trop courte, rien n\'a été gardé');
      return;
    }
    addTake(tr.takeId, pcm, c.sampleRate);
    useStore.setState(s => ({ takesRev: s.takesRev + 1, liveLevels: [] }));
    try { await saveTake(tr.takeId, pcm, c.sampleRate); } catch { useStore.getState().toast('Prise gardée, mais la sauvegarde locale a échoué'); return; }
    useStore.getState().toast('Prise enregistrée');
  }

  deleteTrack(id: string) {
    const tr = useStore.getState().tracks.find(t => t.id === id);
    if (tr?.takeId) { removeTake(tr.takeId); deleteTake(tr.takeId).catch(() => {}); }
    useStore.getState().removeTrack(id);
  }
}

export const engine = new Engine();
