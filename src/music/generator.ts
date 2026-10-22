import { MOODS, PATTERNS, STYLES, parsePattern, type ScaleName, type SectionName, type StyleId } from './presets';

export interface Instru {
  style: StyleId; mood: string; variant: number; bpm: number; key: number; scale: ScaleName;
  grid: boolean[][]; blocks: SectionName[];
}

/** Compose une instru à partir d'un style et d'une ambiance. Déterministe : même entrée, même sortie. */
export function generate(styleId: StyleId, moodId: string, variant: number): Instru {
  const st = STYLES.find(s => s.id === styleId) ?? STYLES[0];
  const md = MOODS.find(m => m.id === moodId) ?? MOODS[0];
  return {
    style: st.id, mood: md.id, variant, bpm: st.bpm, scale: md.scale,
    key: md.keys[variant % md.keys.length],
    grid: parsePattern(PATTERNS[st.id]),
    blocks: st.forms[variant % st.forms.length],
  };
}

export function progression(moodId: string, variant: number) {
  const m = MOODS.find(m => m.id === moodId) ?? MOODS[0];
  return m.progs[variant % m.progs.length];
}
