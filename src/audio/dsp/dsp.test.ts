import { describe, expect, it } from 'vitest';
import { processVoice } from './autotune';
import { pitchMarks, psola } from './psola';
import { pitchTrack } from './yin';

const SR = 48000;

function tone(freq: (t: number) => number, sec: number, sr = SR) {
  const x = new Float32Array(Math.round(sec * sr));
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    ph += 2 * Math.PI * freq(i / sr) / sr;
    // fondamentale + harmoniques, comme une voix très simplifiée
    x[i] = 0.5 * Math.sin(ph) + 0.25 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph);
  }
  return x;
}

function medianF0(x: Float32Array, sr = SR) {
  const f = Array.from(pitchTrack(x, sr).f0).filter(v => v > 0).sort((a, b) => a - b);
  expect(f.length).toBeGreaterThan(10);
  return f[f.length >> 1];
}

describe('YIN', () => {
  it('détecte une note tenue à ±1 %', () => {
    for (const hz of [110, 220, 450, 700]) expect(Math.abs(medianF0(tone(() => hz, 1)) / hz - 1)).toBeLessThan(0.01);
  });

  it('suit un vibrato', () => {
    const x = tone(t => 300 * Math.pow(2, 0.5 * Math.sin(2 * Math.PI * 5 * t) / 12), 1);
    const tr = pitchTrack(x, SR);
    const voiced = Array.from(tr.f0).filter(v => v > 0);
    expect(voiced.length / tr.f0.length).toBeGreaterThan(0.8);
    expect(Math.min(...voiced)).toBeLessThan(295);
    expect(Math.max(...voiced)).toBeGreaterThan(305);
  });

  it('ignore le silence', () => {
    const tr = pitchTrack(new Float32Array(SR), SR);
    expect(Array.from(tr.f0).every(v => v === 0)).toBe(true);
  });
});

describe('PSOLA', () => {
  it('baisse la hauteur sans changer la durée', () => {
    const x = tone(() => 300, 1);
    const tr = pitchTrack(x, SR), marks = pitchMarks(x, tr);
    const y = psola(x, marks, new Float32Array(marks.pos.length).fill(0.8));
    expect(y.length).toBe(x.length);
    expect(Math.abs(medianF0(y) / 240 - 1)).toBeLessThan(0.01);
    expect(y.every(Number.isFinite)).toBe(true);
  });

  it('ratio 1 : quasi identique à l\'original', () => {
    const x = tone(() => 220, 0.5);
    const tr = pitchTrack(x, SR), marks = pitchMarks(x, tr);
    const y = psola(x, marks, new Float32Array(marks.pos.length).fill(1));
    let err = 0, ref = 0;
    for (let i = 2000; i < x.length - 2000; i++) { err += (x[i] - y[i]) ** 2; ref += x[i] ** 2; }
    expect(err / ref).toBeLessThan(0.05);
  });
});

describe('Autotune', () => {
  it('ramène 450 Hz sur La (440 Hz) en La mineur', () => {
    const y = processVoice(tone(() => 450, 1), SR, { mode: 'autotune', key: 9, scale: 'mineur', retune: 100 }).out;
    expect(Math.abs(medianF0(y) / 440 - 1)).toBeLessThan(0.005);
  });

  it('ramène 285 Hz sur Ré (293,7 Hz) en Do majeur', () => {
    const y = processVoice(tone(() => 285, 1), SR, { mode: 'autotune', key: 0, scale: 'majeur', retune: 100 }).out;
    expect(Math.abs(medianF0(y) / 293.66 - 1)).toBeLessThan(0.005);
  });

  it('écrase le vibrato à 100 %', () => {
    const x = tone(t => 440 * Math.pow(2, 0.4 * Math.sin(2 * Math.PI * 5 * t) / 12), 1.5);
    const y = processVoice(x, SR, { mode: 'autotune', key: 9, scale: 'mineur', retune: 100 }).out;
    const f = Array.from(pitchTrack(y, SR).f0).slice(20, -20).filter(v => v > 0);
    const dev = f.map(v => Math.abs(12 * Math.log2(v / 440)));
    dev.sort((a, b) => a - b);
    expect(dev[Math.floor(dev.length * 0.9)]).toBeLessThan(0.12);
  });

  it('Grave descend de 4 demi-tons, durée identique', () => {
    const x = tone(() => 330, 1);
    const y = processVoice(x, SR, { mode: 'grave', key: 0, scale: 'majeur', retune: 0 }).out;
    expect(y.length).toBe(x.length);
    expect(Math.abs(medianF0(y) / (330 * Math.pow(2, -4 / 12)) - 1)).toBeLessThan(0.01);
  });
});

describe('Prise réaliste', () => {
  it('mélodie avec silences : chaque note est recalée, 30 s traitées en moins de 3 s', () => {
    // notes légèrement fausses (+35 cents) en Do majeur : Do4, Mi4, Sol4, séparées de silences
    const notes = [261.63, 329.63, 392.0].map(f => f * Math.pow(2, 0.35 / 12));
    const seg = SR * 0.6, gap = SR * 0.15, n = Math.round(30 * SR);
    const x = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const cyc = Math.floor(i / (seg + gap)), local = i - cyc * (seg + gap);
      if (local >= seg) continue;
      const f = notes[cyc % 3], env = Math.min(1, local / 400, (seg - local) / 400);
      ph += 2 * Math.PI * f / SR;
      x[i] = env * (0.5 * Math.sin(ph) + 0.25 * Math.sin(2 * ph));
    }
    const t0 = performance.now();
    const y = processVoice(x, SR, { mode: 'autotune', key: 0, scale: 'majeur', retune: 100 }).out;
    expect(performance.now() - t0).toBeLessThan(3000);
    for (let k = 0; k < 3; k++) {
      const start = Math.round(k * (seg + gap) + 0.15 * SR), part = y.subarray(start, start + Math.round(0.35 * SR));
      const want = [261.63, 329.63, 392.0][k];
      expect(Math.abs(12 * Math.log2(medianF0(part) / want))).toBeLessThan(0.08);
    }
  });
});
