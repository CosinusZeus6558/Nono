// Données musicales reprises du prototype Claude Design (design/Studio Nono.dc.html).

export type DrumId = 'kick' | 'snare' | 'clap' | 'hat' | 'open' | 'perc';
export type StyleId = 'trap' | 'lofi' | 'afro' | 'pop' | 'drill' | 'house';
export type PresetId = StyleId | 'vide';
export type ScaleName = 'majeur' | 'mineur';
export type SectionName = 'Intro' | 'Couplet' | 'Refrain' | 'Pont' | 'Outro';

export const ROWS: { id: DrumId; name: string; key: string; hue: number }[] = [
  { id: 'kick', name: 'Kick', key: 'Q', hue: 265 },
  { id: 'snare', name: 'Caisse claire', key: 'S', hue: 305 },
  { id: 'clap', name: 'Clap', key: 'D', hue: 345 },
  { id: 'hat', name: 'Charley', key: 'F', hue: 175 },
  { id: 'open', name: 'Charley ouvert', key: 'G', hue: 205 },
  { id: 'perc', name: 'Perc', key: 'H', hue: 70 },
];

export const PATTERNS: Record<PresetId, string[]> = {
  trap: ['x......x..x.....', '........x.......', '........x.......', 'x.x.x.x.xxx.x.xx', '..............x.', '................'],
  lofi: ['x.....x...x.....', '....x.......x...', '................', 'x.x.x.x.x.x.x.x.', '................', '......x.......x.'],
  afro: ['x..x..x...x..x..', '....x.......x...', '..........x.....', 'x.xxx.xxx.xxx.xx', '................', '..x...x....x..x.'],
  pop: ['x...x...x...x...', '....x.......x...', '....x.......x...', '..x...x...x...x.', '................', '................'],
  drill: ['x......x.x......', '........x.......', '................', 'x..x..x.x..x..x.', '................', '...x.......x....'],
  house: ['x...x...x...x...', '................', '....x.......x...', 'x.x.x.x.x.x.x.x.', '..x...x...x...x.', '.......x.......x'],
  vide: ['................', '................', '................', '................', '................', '................'],
};

export const BASS: Record<StyleId, string> = {
  trap: 'x.......x.x.....', lofi: 'x.....x...x.....', afro: 'x..x....x..x.x..',
  pop: 'x.x...x.x.x...x.', drill: 'x.....x..x......', house: '..x...x...x...x.',
};

export const STYLES: { id: StyleId; name: string; bpm: number; desc: string; forms: SectionName[][] }[] = [
  { id: 'trap', name: 'Trap', bpm: 140, desc: '808 et charleys rapides', forms: [['Intro', 'Couplet', 'Refrain', 'Couplet', 'Refrain', 'Outro'], ['Intro', 'Refrain', 'Couplet', 'Refrain']] },
  { id: 'lofi', name: 'Lo-fi', bpm: 82, desc: 'Doux et posé', forms: [['Intro', 'Couplet', 'Refrain', 'Couplet'], ['Intro', 'Couplet', 'Pont', 'Refrain', 'Outro']] },
  { id: 'afro', name: 'Afro', bpm: 104, desc: 'Rythmes chaloupés', forms: [['Intro', 'Couplet', 'Refrain', 'Couplet', 'Refrain'], ['Intro', 'Refrain', 'Pont', 'Refrain']] },
  { id: 'pop', name: 'Pop', bpm: 112, desc: 'Simple et efficace', forms: [['Intro', 'Couplet', 'Refrain', 'Pont', 'Refrain', 'Outro'], ['Couplet', 'Refrain', 'Couplet', 'Refrain']] },
  { id: 'drill', name: 'Drill', bpm: 142, desc: 'Sombre et syncopé', forms: [['Intro', 'Refrain', 'Couplet', 'Refrain'], ['Intro', 'Couplet', 'Refrain', 'Outro']] },
  { id: 'house', name: 'House', bpm: 124, desc: 'Kick sur chaque temps', forms: [['Intro', 'Couplet', 'Refrain', 'Pont', 'Refrain'], ['Intro', 'Refrain', 'Refrain', 'Outro']] },
];

export const MOODS: { id: string; scale: ScaleName; progs: number[][]; keys: number[] }[] = [
  { id: 'Mélancolique', scale: 'mineur', progs: [[0, 5, 2, 6], [0, 3, 5, 4]], keys: [9, 4, 2] },
  { id: 'Sombre', scale: 'mineur', progs: [[0, 5, 0, 4], [0, 3, 4, 0]], keys: [4, 7, 1] },
  { id: 'Joyeux', scale: 'majeur', progs: [[0, 4, 5, 3], [0, 3, 0, 4]], keys: [0, 7, 2] },
  { id: 'Énergique', scale: 'mineur', progs: [[0, 6, 5, 6], [0, 5, 6, 4]], keys: [11, 6, 9] },
  { id: 'Planant', scale: 'majeur', progs: [[0, 2, 3, 3], [3, 4, 2, 5]], keys: [5, 3, 10] },
];

export const SECTIONS: Record<SectionName, { drums: 'full' | 'light' | 'none'; bass: boolean }> = {
  Intro: { drums: 'light', bass: false },
  Couplet: { drums: 'full', bass: true },
  Refrain: { drums: 'full', bass: true },
  Pont: { drums: 'light', bass: true },
  Outro: { drums: 'none', bass: false },
};

export type TuneMode = 'none' | 'autotune' | 'grave' | 'aigu';
export type ColorFx = 'none' | 'robot' | 'radio' | 'echo' | 'choeur';

export const TUNES: { id: TuneMode; name: string; desc: string }[] = [
  { id: 'none', name: 'Aucun', desc: 'Hauteur naturelle' },
  { id: 'autotune', name: 'Autotune', desc: 'Corrige la justesse' },
  { id: 'grave', name: 'Grave', desc: '4 demi-tons plus bas' },
  { id: 'aigu', name: 'Aigu', desc: '4 demi-tons plus haut' },
];

export const COLOR_FX: { id: ColorFx; name: string; desc: string }[] = [
  { id: 'none', name: 'Aucun', desc: 'Voix sèche' },
  { id: 'robot', name: 'Robot', desc: 'Timbre métallique' },
  { id: 'radio', name: 'Radio', desc: 'Filtre téléphone' },
  { id: 'echo', name: 'Écho', desc: 'Répétitions en rythme' },
  { id: 'choeur', name: 'Chœur', desc: 'Voix doublées' },
];

export const parsePattern = (p: string[]) => p.map(s => s.split('').map(c => c === 'x'));
