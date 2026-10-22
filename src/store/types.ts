import type { ColorFx, PresetId, ScaleName, SectionName, StyleId, TuneMode } from '../music/presets';

export type Screen = 'studio' | 'beats' | 'voix' | 'instru';
export type TrackKind = 'drums' | 'bass' | 'chords' | 'rec';

export interface Track {
  id: string; name: string; kind: TrackKind; hue: number;
  vol: number; pan: number; mute: boolean;
  /** Prises micro uniquement. */
  takeId?: string; startStep?: number;
  /** Calage fin de la prise, en ms (positif = plus tard). */
  offsetMs?: number;
  tune: TuneMode; retune: number; fx: ColorFx;
}

/** Ce qui est sauvegardé. */
export interface Project {
  id: string; name: string;
  bpm: number; master: number;
  grid: boolean[][]; rowMute: Record<string, boolean>; preset: PresetId;
  style: StyleId; mood: string; key: number; scale: ScaleName; variant: number; blocks: SectionName[];
  tracks: Track[];
}

export interface VoiceSettings { tune: TuneMode; retune: number; fx: ColorFx }
