import { create } from 'zustand';
import { takeDuration } from '../audio/takes';
import { generate } from '../music/generator';
import { PATTERNS, STYLES, parsePattern, type PresetId, type StyleId } from '../music/presets';
import type { Project, Screen, Track, VoiceSettings } from './types';

export const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function newProject(name = 'Nouveau projet'): Project {
  const ins = generate('lofi', 'Mélancolique', 0);
  return {
    id: uid('p'), name, bpm: ins.bpm, master: 80,
    grid: ins.grid, rowMute: {}, preset: 'lofi',
    style: ins.style, mood: ins.mood, key: ins.key, scale: ins.scale, variant: 0, blocks: ins.blocks,
    tracks: [
      { id: 'drums', name: 'Batterie', kind: 'drums', hue: 265, vol: 85, pan: 0, mute: false, tune: 'none', retune: 0, fx: 'none' },
      { id: 'bass', name: 'Basse', kind: 'bass', hue: 175, vol: 75, pan: 0, mute: false, tune: 'none', retune: 0, fx: 'none' },
      { id: 'chords', name: 'Accords', kind: 'chords', hue: 305, vol: 65, pan: -10, mute: false, tune: 'none', retune: 0, fx: 'none' },
    ],
  };
}

export interface UIState {
  screen: Screen; playing: boolean; step: number;
  recording: boolean; recId: string | null; countIn: number; liveLevels: number[];
  sel: string;
  /** Source affichée dans l'écran Voix : 'demo' ou l'id d'une piste de prise. */
  voiceSrc: string; demo: VoiceSettings;
  selStyle: StyleId; selMood: string; generating: boolean;
  toastMsg: string | null; padHit: string | null; projectsOpen: boolean;
  voicePlaying: 'raw' | 'fx' | null;
  installOpen: boolean;
  /** Incrémenté quand une prise ou son traitement change (force le rafraîchissement des formes d'onde). */
  takesRev: number;
}

interface Actions {
  set: (p: Partial<Project & UIState>) => void;
  setProject: (p: Project) => void;
  updTrack: (id: string, patch: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  toggleCell: (r: number, st: number) => void;
  setPreset: (id: PresetId) => void;
  applyInstru: () => void;
  toast: (msg: string) => void;
}

export type Store = Project & UIState & Actions;

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<Store>()((set, get) => ({
  ...newProject('Nuit blanche'),
  screen: 'studio', playing: false, step: 0,
  recording: false, recId: null, countIn: 0, liveLevels: [],
  sel: 'drums', voiceSrc: 'demo', demo: { tune: 'autotune', retune: 85, fx: 'none' },
  selStyle: 'lofi', selMood: 'Mélancolique', generating: false,
  toastMsg: null, padHit: null, projectsOpen: false, voicePlaying: null, installOpen: false, takesRev: 0,

  set: p => set(p),
  setProject: p => set({ ...p, step: 0, sel: p.tracks[0]?.id ?? '', voiceSrc: 'demo', selStyle: p.style, selMood: p.mood }),
  updTrack: (id, patch) => set(s => ({ tracks: s.tracks.map(t => (t.id === id ? { ...t, ...patch } : t)) })),
  removeTrack: id => set(s => ({
    tracks: s.tracks.filter(t => t.id !== id),
    sel: s.sel === id ? 'drums' : s.sel,
    voiceSrc: s.voiceSrc === id ? 'demo' : s.voiceSrc,
  })),
  toggleCell: (r, st) => set(s => ({ grid: s.grid.map((row, i) => (i === r ? row.map((v, j) => (j === st ? !v : v)) : row)) })),
  setPreset: id => {
    const st = STYLES.find(s => s.id === id);
    set({ grid: parsePattern(PATTERNS[id]), preset: id, ...(st ? { bpm: st.bpm } : {}) });
  },
  applyInstru: () => {
    const s = get(), same = s.style === s.selStyle && s.mood === s.selMood;
    const ins = generate(s.selStyle, s.selMood, same ? s.variant + 1 : 0);
    set({ ...ins, preset: ins.style, step: 0 });
  },
  toast: msg => {
    set({ toastMsg: msg });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toastMsg: null }), 2600);
  },
}));

export const PROJECT_KEYS: (keyof Project)[] = ['id', 'name', 'bpm', 'master', 'grid', 'rowMute', 'preset', 'style', 'mood', 'key', 'scale', 'variant', 'blocks', 'tracks'];

export function projectOf(s: Store): Project {
  const p: Record<string, unknown> = {};
  for (const k of PROJECT_KEYS) p[k] = s[k];
  return p as unknown as Project;
}

export const stepDur = (bpm: number) => 60 / bpm / 4;

/** Longueur du morceau en pas : l'instru générée, prolongée jusqu'à la fin de la piste audio la plus longue (arrondi à la mesure). */
export function totalSteps(s: Pick<Project, 'blocks' | 'tracks' | 'bpm'>, duration: (takeId: string) => number = takeDuration) {
  let n = Math.max(1, s.blocks.length) * 64;
  const sd = stepDur(s.bpm);
  for (const t of s.tracks) {
    if (!t.takeId || t.startStep === undefined) continue;
    const d = duration(t.takeId);
    if (d > 0) n = Math.max(n, Math.ceil((t.startStep + ((t.offsetMs ?? 0) / 1000 + d) / sd) / 16) * 16);
  }
  return n;
}
