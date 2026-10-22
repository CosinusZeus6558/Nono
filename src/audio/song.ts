// La « partition » : ce qui joue à chaque pas. Partagée par la lecture en direct et l'export WAV.
import { progression } from '../music/generator';
import { BASS, ROWS, SECTIONS } from '../music/presets';
import { chordInfo } from '../music/theory';
import { stepDur } from '../store/project';
import type { Project, Track } from '../store/types';
import type { TuneParams } from './dsp/autotune';
import { buildFx } from './fx';
import { bass, drum, pad } from './synths';
import { playable } from './takes';

interface Chan { g: GainNode; p: StereoPannerNode }
export interface Mix { ctx: BaseAudioContext; out: AudioNode; chans: Map<string, Chan>; solo?: string }

export function makeMix(ctx: BaseAudioContext, out: AudioNode, tracks: Track[], solo?: string): Mix {
  const mix: Mix = { ctx, out, chans: new Map(), solo };
  syncMix(mix, tracks);
  return mix;
}

export function chan(mix: Mix, id: string): Chan {
  let c = mix.chans.get(id);
  if (!c) {
    const g = mix.ctx.createGain(), p = mix.ctx.createStereoPanner();
    g.connect(p).connect(mix.out);
    c = { g, p }; mix.chans.set(id, c);
  }
  return c;
}

export function syncMix(mix: Mix, tracks: Track[]) {
  for (const t of tracks) {
    const c = chan(mix, t.id), on = !t.mute && (!mix.solo || mix.solo === t.id);
    c.g.gain.value = on ? t.vol / 100 : 0;
    c.p.pan.value = t.pan / 50;
  }
}

export const tuneOf = (t: Track, S: Pick<Project, 'key' | 'scale'>): TuneParams => ({ mode: t.tune, key: S.key, scale: S.scale, retune: t.retune });

export const chordsOf = (S: Pick<Project, 'key' | 'scale' | 'mood' | 'variant'>) =>
  progression(S.mood, S.variant).map(d => chordInfo(S.key, S.scale, d));

/** Démarre une prise à l'instant `t`, `offset` secondes après son début. */
export function startTake(mix: Mix, S: Project, tr: Track, t: number, offset: number) {
  if (!tr.takeId) return null;
  const buf = playable(tr.takeId, tuneOf(tr, S));
  // Calage manuel : décale la prise sans modifier l'audio.
  offset -= (tr.offsetMs ?? 0) / 1000;
  if (offset < 0) { t -= offset; offset = 0; }
  if (!buf || offset >= buf.duration) return null;
  const c = mix.ctx, src = c.createBufferSource();
  src.buffer = buf;
  src.connect(buildFx(c, tr.fx, chan(mix, tr.id).g, t, t + buf.duration - offset + 3, stepDur(S.bpm)));
  src.start(t, offset);
  return src;
}

/** Joue le pas `s` à l'instant `t`. En mode boucle (écran Beats), seule la batterie joue sur une mesure. */
export function playStep(mix: Mix, S: Project, s: number, t: number, loop: boolean, onSource?: (src: AudioBufferSourceNode) => void) {
  const c = mix.ctx, st = s % 16, bar = Math.floor(s / 16);
  const block = S.blocks[Math.floor(bar / 4)] || 'Couplet';
  const sec = loop ? { drums: 'full', bass: false } : SECTIONS[block];
  if (sec.drums !== 'none') ROWS.forEach((r, i) => {
    if (!S.grid[i]?.[st] || S.rowMute[r.id]) return;
    if (sec.drums === 'light' && !(r.id === 'hat' || r.id === 'open' || r.id === 'perc')) return;
    drum(c, r.id, t, chan(mix, 'drums').g);
  });
  if (loop) return;
  const sd = stepDur(S.bpm), chord = chordsOf(S)[bar % 4];
  if (st === 0) pad(c, chord.notes, t, sd * 16, chan(mix, 'chords').g, S.style === 'lofi');
  if (sec.bass && BASS[S.style]?.[st] === 'x') bass(c, chord.root - 12, t, sd * 2.5, chan(mix, 'bass').g);
  for (const tr of S.tracks) {
    if (tr.kind === 'rec' && tr.startStep === s) {
      const src = startTake(mix, S, tr, t, 0);
      if (src) onSource?.(src);
    }
  }
}
