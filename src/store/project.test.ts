import { describe, expect, it } from 'vitest';
import { newProject, stepDur, totalSteps } from './project';

describe('totalSteps', () => {
  const p = newProject();
  const base = p.blocks.length * 64;

  it('vaut la longueur de l\'instru sans piste audio', () => {
    expect(totalSteps(p, () => 0)).toBe(base);
  });

  it('s\'étend jusqu\'à la fin d\'une piste longue, arrondi à la mesure', () => {
    const sd = stepDur(p.bpm), dur = (base + 37) * sd; // dépasse de 37 pas
    const S = { ...p, tracks: [...p.tracks, { ...p.tracks[0], id: 'r', kind: 'rec' as const, takeId: 't', startStep: 0 }] };
    const n = totalSteps(S, () => dur);
    expect(n % 16).toBe(0);
    expect(n).toBe(base + 48);
  });

  it('tient compte du point de départ de la piste', () => {
    const sd = stepDur(p.bpm);
    const S = { ...p, tracks: [{ ...p.tracks[0], id: 'r', kind: 'rec' as const, takeId: 't', startStep: base }] };
    expect(totalSteps(S, () => 16 * sd)).toBe(base + 16);
  });
});
