// Détection de hauteur YIN (de Cheveigné & Kawahara, 2002), image par image.

export interface PitchTrack {
  sr: number;
  /** Pas entre deux images, en échantillons du signal d'origine. */
  hop: number;
  /** Fréquence fondamentale par image, en Hz ; 0 = non voisé (souffle, silence, consonne). */
  f0: Float32Array;
}

export interface YinOptions { hop?: number; minF?: number; maxF?: number; threshold?: number }

/** Passe-bas biquad (RBJ), appliqué sur place. */
function lowpass(x: Float32Array, sr: number, fc: number) {
  const w = 2 * Math.PI * fc / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * Math.SQRT1_2);
  const a0 = 1 + al, b0 = (1 - cw) / 2 / a0, b1 = (1 - cw) / a0, b2 = b0, a1 = -2 * cw / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y;
  }
}

/** Ramène le signal vers ~16 kHz : largement suffisant pour une voix (fondamentale < 1 kHz) et bien plus rapide. */
function decimate(x: Float32Array, sr: number) {
  const q = Math.max(1, Math.floor(sr / 16000));
  if (q === 1) return { y: x, q, sr };
  const t = Float32Array.from(x), nsr = sr / q;
  lowpass(t, sr, nsr * 0.42); lowpass(t, sr, nsr * 0.42);
  const y = new Float32Array(Math.floor(x.length / q));
  for (let i = 0; i < y.length; i++) y[i] = t[i * q];
  return { y, q, sr: nsr };
}

/** Période (en échantillons, fractionnaire) de la fenêtre `x[start .. start+W+tauMax]`, ou 0 si non voisée. */
export function yinPeriod(x: Float32Array, start: number, W: number, tauMin: number, tauMax: number, threshold: number, d: Float32Array) {
  d[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) { const v = x[start + j] - x[start + j + tau]; s += v * v; }
    run += s;
    d[tau] = run > 0 ? s * tau / run : 1;
  }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
      tau = t; break;
    }
  }
  if (tau < 0) return 0;
  if (tau > 1 && tau < tauMax) {
    const a = d[tau - 1], b = d[tau], c = d[tau + 1], den = a - 2 * b + c;
    if (den > 0) return tau + 0.5 * (a - c) / den;
  }
  return tau;
}

export function pitchTrack(signal: Float32Array, sr: number, opts: YinOptions = {}): PitchTrack {
  const hop = opts.hop ?? 256, minF = opts.minF ?? 70, maxF = opts.maxF ?? 1000, thr = opts.threshold ?? 0.15;
  const { y, q, sr: dsr } = decimate(signal, sr);
  const tauMax = Math.ceil(dsr / minF), tauMin = Math.max(2, Math.floor(dsr / maxF)), W = tauMax;
  const frames = Math.max(0, Math.floor(signal.length / hop) + 1);
  const f0 = new Float32Array(frames), rms = new Float32Array(frames), d = new Float32Array(tauMax + 1);
  const span = W + tauMax;
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    const start = Math.round(i * hop / q) - (span >> 1);
    if (start < 0 || start + span >= y.length) continue;
    let s = 0;
    for (let j = 0; j < span; j++) s += y[start + j] * y[start + j];
    rms[i] = Math.sqrt(s / span);
    peak = Math.max(peak, rms[i]);
    const p = yinPeriod(y, start, W, tauMin, tauMax, thr, d);
    if (p > 0) f0[i] = dsr / p;
  }
  // Porte de bruit : les images trop faibles par rapport au passage le plus fort sont considérées non voisées.
  const gate = Math.max(1e-4, peak * 0.02);
  for (let i = 0; i < frames; i++) if (rms[i] < gate) f0[i] = 0;
  cleanTrack(f0);
  return { sr, hop, f0 };
}

/** Lisse la courbe : corrige les sauts d'octave, comble les micro-trous, supprime les îlots trop courts. */
function cleanTrack(f0: Float32Array) {
  const n = f0.length, src = Float32Array.from(f0);
  for (let i = 0; i < n; i++) {
    if (!src[i]) continue;
    const win: number[] = [];
    for (let k = i - 2; k <= i + 2; k++) if (k >= 0 && k < n && src[k]) win.push(src[k]);
    win.sort((a, b) => a - b);
    const med = win[win.length >> 1];
    let v = src[i];
    if (Math.abs(Math.log2(v / med) - 1) < 0.1) v /= 2;
    else if (Math.abs(Math.log2(v / med) + 1) < 0.1) v *= 2;
    f0[i] = v;
  }
  for (let i = 1; i < n; i++) {
    if (f0[i] || !f0[i - 1]) continue;
    let j = i; while (j < n && !f0[j]) j++;
    if (j < n && j - i <= 2 && Math.abs(Math.log2(f0[j] / f0[i - 1])) < 0.25) {
      for (let k = i; k < j; k++) f0[k] = f0[i - 1] + (f0[j] - f0[i - 1]) * (k - i + 1) / (j - i + 1);
    }
    i = j;
  }
  for (let i = 0; i < n; i++) {
    if (!f0[i]) continue;
    let j = i; while (j < n && f0[j]) j++;
    if (j - i < 3) for (let k = i; k < j; k++) f0[k] = 0;
    i = j;
  }
}

/** Fréquence à l'échantillon `n`, interpolée entre images ; 0 si l'image la plus proche est non voisée. */
export function f0At(t: PitchTrack, n: number) {
  const p = n / t.hop, i = Math.floor(p), fr = p - i, a = t.f0[i] ?? 0, b = t.f0[i + 1] ?? 0;
  if (a && b) return a + (b - a) * fr;
  return fr < 0.5 ? a : b;
}
