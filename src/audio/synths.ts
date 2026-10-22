// Instruments synthétiques, portés du prototype. Indépendants du contexte : servent à la lecture et à l'export.
import type { DrumId } from '../music/presets';
import { mtof } from '../music/theory';

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuf(c: BaseAudioContext) {
  let b = noiseCache.get(c);
  if (!b) {
    b = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(c, b);
  }
  return b;
}

export function drum(c: BaseAudioContext, id: DrumId, t: number, out: AudioNode) {
  const g = c.createGain(); g.connect(out);
  const env = (peak: number, dec: number) => { g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + dec); };
  const noise = () => { const s = c.createBufferSource(); s.buffer = noiseBuf(c); return s; };
  const bq = (type: BiquadFilterType, f: number, q?: number) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
  if (id === 'kick') {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    env(1, 0.5); o.connect(g); o.start(t); o.stop(t + 0.55);
  } else if (id === 'snare') {
    const n = noise(); env(0.5, 0.18); n.connect(bq('highpass', 1300)).connect(g); n.start(t); n.stop(t + 0.2);
    const o = c.createOscillator(), og = c.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    og.gain.setValueAtTime(0.45, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og).connect(out); o.start(t); o.stop(t + 0.12);
  } else if (id === 'clap') {
    const n = noise(); g.gain.setValueAtTime(0.0001, t);
    [0, 0.012, 0.024].forEach(d => { g.gain.setValueAtTime(0.7, t + d); g.gain.exponentialRampToValueAtTime(0.08, t + d + 0.01); });
    g.gain.setValueAtTime(0.6, t + 0.036); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    n.connect(bq('bandpass', 1500, 0.9)).connect(g); n.start(t); n.stop(t + 0.25);
  } else if (id === 'hat' || id === 'open') {
    const n = noise(), dec = id === 'open' ? 0.3 : 0.05;
    env(id === 'open' ? 0.26 : 0.22, dec); n.connect(bq('highpass', 7600)).connect(g); n.start(t); n.stop(t + dec + 0.02);
  } else if (id === 'perc') {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(480, t + 0.06);
    env(0.32, 0.12); o.connect(g); o.start(t); o.stop(t + 0.14);
  }
}

export function pad(c: BaseAudioContext, notes: number[], t: number, dur: number, out: AudioNode, soft: boolean) {
  const f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'lowpass'; f.frequency.value = soft ? 900 : 1600; f.Q.value = 0.7;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.08);
  g.gain.setValueAtTime(0.16, t + dur - 0.12); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(out);
  notes.forEach(n => [-7, 7].forEach(dt => {
    const o = c.createOscillator(), og = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = dt; og.gain.value = 0.12;
    o.connect(og).connect(f); o.start(t); o.stop(t + dur + 0.02);
  }));
}

export function bass(c: BaseAudioContext, n: number, t: number, dur: number, out: AudioNode) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.42, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  g.connect(out);
  ([['triangle', n], ['sine', n - 12]] as const).forEach(([type, m]) => {
    const o = c.createOscillator(); o.type = type; o.frequency.value = mtof(m);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  });
}

/** Clic de métronome pour le décompte avant enregistrement. */
export function click(c: BaseAudioContext, t: number, accent: boolean, out: AudioNode) {
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.value = accent ? 1760 : 1320;
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.07);
}
