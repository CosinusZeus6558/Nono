import type { ScaleName } from './presets';

export const NOTES = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
export const SCALES: Record<ScaleName, number[]> = { majeur: [0, 2, 4, 5, 7, 9, 11], mineur: [0, 2, 3, 5, 7, 8, 10] };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const ftom = (f: number) => 69 + 12 * Math.log2(f / 440);

/** Note MIDI du degré `deg` (peut déborder de l'octave) au-dessus de `base`. */
export function scaleNote(scale: ScaleName, base: number, deg: number) {
  const sc = SCALES[scale], o = Math.floor(deg / 7), i = ((deg % 7) + 7) % 7;
  return base + 12 * o + sc[i];
}

/** Note de la gamme (tonalité `key` 0–11) la plus proche de `midi`, fractionnaire accepté. */
export function snapToScale(midi: number, key: number, scale: ScaleName) {
  const sc = SCALES[scale];
  let best = midi, bd = Infinity;
  const oct = Math.floor((midi - key) / 12);
  for (let o = oct - 1; o <= oct + 1; o++) {
    for (const iv of sc) {
      const c = key + 12 * o + iv, d = Math.abs(c - midi);
      if (d < bd) { bd = d; best = c; }
    }
  }
  return best;
}

export function chordInfo(key: number, scale: ScaleName, deg: number) {
  const notes = [0, 2, 4].map(k => scaleNote(scale, 48 + key, deg + k));
  const third = notes[1] - notes[0], fifth = notes[2] - notes[0];
  const q = fifth === 6 ? '°' : third === 3 ? 'm' : '';
  const roman = q ? ROMAN[deg % 7].toLowerCase() + (q === '°' ? '°' : '') : ROMAN[deg % 7];
  return { notes, root: notes[0], name: NOTES[notes[0] % 12] + (q ? ' ' + q : ''), roman };
}

export function fmtTime(sec: number) {
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return String(m).padStart(2, '0') + ':' + s.toFixed(1).padStart(4, '0');
}
