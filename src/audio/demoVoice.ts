// Voix de démonstration synthétique (reprise du prototype), légèrement fausse exprès pour entendre l'autotune.
import type { ScaleName } from '../music/presets';
import { mtof, scaleNote } from '../music/theory';

export async function renderDemoVoice(key: number, scale: ScaleName): Promise<{ pcm: Float32Array; sr: number }> {
  const mel = [[0, .5], [2, .4], [4, .7], [3, .35], [2, .45], [1, .4], [2, .9], [-1, .4], [0, .7]];
  const off = [.38, -.42, .3, -.34, .45, -.28, .36, -.4, .32];
  const tonic = 52 + ((key - 4 + 12) % 12);
  const starts: number[] = []; let acc = 0; mel.forEach(m => { starts.push(acc); acc += m[1]; });
  const dur = acc, N = 720, raw: number[] = [], env: number[] = [];
  for (let i = 0; i < N; i++) {
    const tt = i / (N - 1) * dur;
    let k = 0; while (k < mel.length - 1 && starts[k + 1] <= tt) k++;
    const lt = tt - starts[k], L = mel[k][1];
    const tgt = scaleNote(scale, tonic, mel[k][0]) + off[k];
    const prev = k ? scaleNote(scale, tonic, mel[k - 1][0]) + off[k - 1] : tgt - 1.5;
    let p = tgt + (prev - tgt) * Math.exp(-lt / 0.07);
    if (lt > 0.12) p += 0.3 * Math.sin(2 * Math.PI * 5.5 * tt) * Math.min(1, (lt - 0.12) / 0.25);
    raw.push(p);
    env.push(Math.max(0, Math.min(1, lt / 0.03, (L - lt) / 0.06)) * 0.85);
  }
  env[N - 1] = 0;
  const sr = 44100, c = new OfflineAudioContext(1, Math.ceil((dur + 0.3) * sr), sr);
  const amp = c.createGain(); amp.gain.value = 0; amp.gain.setValueCurveAtTime(Float32Array.from(env), 0.1, dur); amp.connect(c.destination);
  const sum = c.createGain();
  [[700, 6, 1], [1150, 7, 0.6], [2600, 9, 0.25]].forEach(([f, q, gg]) => {
    const b = c.createBiquadFilter(), bg = c.createGain();
    b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; bg.gain.value = gg * 2.4;
    sum.connect(b).connect(bg).connect(amp);
  });
  const freqs = Float32Array.from(raw.map(mtof));
  const o = c.createOscillator(), og = c.createGain();
  o.type = 'sawtooth'; o.frequency.value = freqs[0]; o.frequency.setValueCurveAtTime(freqs, 0.1, dur);
  og.gain.value = 0.5; o.connect(og).connect(sum); o.start(0.1); o.stop(0.1 + dur + 0.05);
  const buf = await c.startRendering();
  return { pcm: buf.getChannelData(0).slice(), sr };
}
