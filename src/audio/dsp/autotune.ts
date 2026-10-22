import type { ScaleName, TuneMode } from '../../music/presets';
import { ftom, snapToScale } from '../../music/theory';
import { pitchMarks, psola } from './psola';
import { pitchTrack, type PitchTrack } from './yin';

export interface TuneParams { mode: TuneMode; key: number; scale: ScaleName; retune: number }

export const SHIFT_SEMITONES = 4;

/**
 * Décalage de hauteur (en demi-tons) à appliquer à chaque image.
 * Autotune : `retune` 0 = correction douce et lente (voix naturelle), 100 = recalage instantané (effet robotique).
 */
export function correction(track: PitchTrack, p: TuneParams): Float32Array {
  const f0 = track.f0, off = new Float32Array(f0.length);
  if (p.mode === 'grave' || p.mode === 'aigu') {
    const s = p.mode === 'grave' ? -SHIFT_SEMITONES : SHIFT_SEMITONES;
    for (let i = 0; i < f0.length; i++) off[i] = f0[i] ? s : 0;
    return off;
  }
  if (p.mode !== 'autotune') return off;
  const a = Math.max(0, Math.min(1, p.retune / 100));
  const strength = 0.5 + 0.5 * a, tau = 0.2 * (1 - a) * (1 - a);
  const alpha = tau <= 1e-4 ? 1 : 1 - Math.exp(-(track.hop / track.sr) / tau);
  let cur = 0, prevTarget: number | null = null;
  for (let i = 0; i < f0.length; i++) {
    if (!f0[i]) { prevTarget = null; continue; }
    const m = ftom(f0[i]);
    let target = snapToScale(m, p.key, p.scale);
    // Hystérésis : on ne change de note visée que si la voix s'en est nettement rapprochée (évite le « yo-yo » sur le vibrato).
    if (prevTarget !== null && target !== prevTarget && Math.abs(m - prevTarget) < Math.abs(m - target) + 0.3) target = prevTarget;
    const want = (target - m) * strength;
    cur = prevTarget === null ? want : cur + (want - cur) * alpha;
    off[i] = cur; prevTarget = target;
  }
  return off;
}

export interface VoiceResult {
  out: Float32Array;
  /** Courbes pour l'affichage, en notes MIDI (NaN = non voisé), sous-échantillonnées. */
  rawMidi: Float32Array;
  outMidi: Float32Array;
}

export function curves(track: PitchTrack, off: Float32Array, maxPoints = 600) {
  const n = track.f0.length, step = Math.max(1, Math.ceil(n / maxPoints)), len = Math.ceil(n / step);
  const raw = new Float32Array(len), cor = new Float32Array(len);
  for (let j = 0; j < len; j++) {
    const i = j * step, f = track.f0[i];
    raw[j] = f ? ftom(f) : NaN; cor[j] = f ? ftom(f) + off[i] : NaN;
  }
  return { raw, cor };
}

export function processVoice(x: Float32Array, sr: number, p: TuneParams, track: PitchTrack = pitchTrack(x, sr)): VoiceResult {
  const off = correction(track, p);
  const { raw, cor } = curves(track, off);
  if (p.mode === 'none') return { out: x, rawMidi: raw, outMidi: cor };
  const marks = pitchMarks(x, track);
  const ratio = new Float32Array(marks.pos.length);
  for (let k = 0; k < ratio.length; k++) {
    const fpos = marks.pos[k] / track.hop, i = Math.floor(fpos), fr = fpos - i;
    const o = (off[i] ?? 0) * (1 - fr) + (off[i + 1] ?? off[i] ?? 0) * fr;
    ratio[k] = Math.pow(2, o / 12);
  }
  return { out: psola(x, marks, ratio), rawMidi: raw, outMidi: cor };
}
