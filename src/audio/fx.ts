// Effets de couleur appliqués en temps réel à la lecture (portés du prototype).
import type { ColorFx } from '../music/presets';

/** Construit la chaîne d'effet vers `dest` et renvoie son entrée. `end` borne la durée de vie des oscillateurs internes. */
export function buildFx(c: BaseAudioContext, id: ColorFx, dest: AudioNode, t: number, end: number, stepDur: number): AudioNode {
  const inp = c.createGain();
  if (id === 'robot') {
    const rm = c.createGain(), o = c.createOscillator(), mk = c.createGain();
    rm.gain.value = 0; o.frequency.value = 70; o.connect(rm.gain); o.start(t); o.stop(end); mk.gain.value = 1.6;
    inp.connect(rm).connect(mk).connect(dest);
  } else if (id === 'radio') {
    const hp = c.createBiquadFilter(), bp = c.createBiquadFilter(), ws = c.createWaveShaper(), g = c.createGain();
    hp.type = 'highpass'; hp.frequency.value = 500; bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 1.1;
    const cv = new Float32Array(256); for (let i = 0; i < 256; i++) cv[i] = Math.tanh((i / 128 - 1) * 3);
    ws.curve = cv; g.gain.value = 1.3;
    inp.connect(hp).connect(bp).connect(ws).connect(g).connect(dest);
  } else if (id === 'echo') {
    const d = c.createDelay(2), fb = c.createGain(), w = c.createGain();
    d.delayTime.value = Math.min(1.9, stepDur * 3); fb.gain.value = 0.42; w.gain.value = 0.55;
    inp.connect(dest); inp.connect(d); d.connect(fb).connect(d); d.connect(w).connect(dest);
  } else if (id === 'choeur') {
    inp.connect(dest);
    [0.017, 0.029].forEach((dt, i) => {
      const d = c.createDelay(0.1), l = c.createOscillator(), lg = c.createGain(), w = c.createGain(), p = c.createStereoPanner();
      d.delayTime.value = dt; l.frequency.value = 0.7 + i * 0.4; lg.gain.value = 0.004; l.connect(lg).connect(d.delayTime);
      l.start(t); l.stop(end); w.gain.value = 0.6; p.pan.value = i ? 0.6 : -0.6;
      inp.connect(d).connect(w).connect(p).connect(dest);
    });
  } else inp.connect(dest);
  return inp;
}
