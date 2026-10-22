/** Encode des canaux flottants en WAV PCM 16 bits. */
export function encodeWav(channels: Float32Array[], sr: number): ArrayBuffer {
  const nch = channels.length, len = channels[0]?.length ?? 0, bytes = len * nch * 2;
  const buf = new ArrayBuffer(44 + bytes), v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nch, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nch * 2, true); v.setUint16(32, nch * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, bytes, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < nch; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
    }
  }
  return buf;
}
