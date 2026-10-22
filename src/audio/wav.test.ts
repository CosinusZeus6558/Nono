import { describe, expect, it } from 'vitest';
import { encodeWav } from './wav';

describe('encodeWav', () => {
  it('écrit un en-tête RIFF valide', () => {
    const l = new Float32Array([0, 0.5, -1, 1]), r = new Float32Array([0, -0.5, 1, -1]);
    const v = new DataView(encodeWav([l, r], 44100));
    const tag = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map(i => v.getUint8(o + i)));
    expect(tag(0)).toBe('RIFF'); expect(tag(8)).toBe('WAVE'); expect(tag(36)).toBe('data');
    expect(v.byteLength).toBe(44 + 4 * 2 * 2);
    expect(v.getUint32(4, true)).toBe(v.byteLength - 8);
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getInt16(44 + 4 * 2, true)).toBe(-32768);
    expect(v.getInt16(44 + 4 * 3, true)).toBe(32767);
  });
});
