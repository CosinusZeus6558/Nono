// TD-PSOLA : change la hauteur d'une voix sans changer sa durée, en conservant le timbre (formants).
import { f0At, type PitchTrack } from './yin';

export interface Marks { pos: Int32Array; period: Float32Array; voiced: Uint8Array }

/** Place une marque par période sur les zones voisées (calée sur le pic local), et toutes les 10 ms ailleurs. */
export function pitchMarks(x: Float32Array, track: PitchTrack): Marks {
  const N = x.length, sr = track.sr, unv = Math.round(sr / 100);
  const pos: number[] = [], period: number[] = [], voiced: number[] = [];
  let n = 0, prevVoiced = false;
  while (n < N) {
    const f = f0At(track, n);
    if (f > 0) {
      const P = sr / f;
      const lo = prevVoiced ? Math.round(n - P / 4) : Math.round(n), hi = prevVoiced ? Math.round(n + P / 4) : Math.round(n + P);
      let m = Math.max(0, lo), best = -Infinity;
      for (let k = Math.max(0, lo); k <= Math.min(N - 1, hi); k++) if (x[k] > best) { best = x[k]; m = k; }
      pos.push(m); period.push(P); voiced.push(1);
      n = m + P; prevVoiced = true;
    } else {
      pos.push(Math.round(n)); period.push(unv); voiced.push(0);
      n = Math.round(n) + unv; prevVoiced = false;
    }
  }
  return { pos: Int32Array.from(pos), period: Float32Array.from(period), voiced: Uint8Array.from(voiced) };
}

/** Resynthèse : `ratio[k]` multiplie la hauteur autour de la marque k (1 = inchangé). */
export function psola(x: Float32Array, marks: Marks, ratio: Float32Array): Float32Array {
  const N = x.length, M = marks.pos.length;
  const out = new Float32Array(N), wsum = new Float32Array(N);
  if (!M) return Float32Array.from(x);
  let ts = marks.pos[0], k = 0;
  while (ts < N) {
    while (k + 1 < M && Math.abs(marks.pos[k + 1] - ts) <= Math.abs(marks.pos[k] - ts)) k++;
    // Pas local = écart réel jusqu'à la marque suivante : à ratio 1, la synthèse retombe exactement sur l'analyse.
    const Pf = k + 1 < M ? marks.pos[k + 1] - marks.pos[k] : marks.period[k];
    const P = Math.max(2, Math.round(Pf)), a = marks.pos[k], c = Math.round(ts);
    const r = marks.voiced[k] ? ratio[k] : 1;
    for (let j = -P; j <= P; j++) {
      const s = a + j, d = c + j;
      if (s < 0 || s >= N || d < 0 || d >= N) continue;
      const w = 0.5 + 0.5 * Math.cos(Math.PI * j / P);
      out[d] += w * x[s]; wsum[d] += w;
    }
    ts += Pf / r;
  }
  // Division par la somme des fenêtres : chaque échantillon est une moyenne pondérée des grains, donc borné.
  for (let i = 0; i < N; i++) out[i] = wsum[i] > 1e-3 ? out[i] / wsum[i] : x[i];
  return out;
}
