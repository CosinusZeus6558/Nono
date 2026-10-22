/// <reference lib="webworker" />
// Traitement des voix hors du fil de l'interface : l'analyse YIN est gardée en cache par prise.
import { processVoice, type TuneParams } from './autotune';
import { pitchTrack, type PitchTrack } from './yin';

export type WorkerRequest =
  | { type: 'process'; req: number; takeId: string; pcm: Float32Array; sr: number; params: TuneParams }
  | { type: 'forget'; takeId: string };

export interface WorkerResponse { req: number; out: Float32Array | null; rawMidi: Float32Array; outMidi: Float32Array; error?: string }

const tracks = new Map<string, PitchTrack>();

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const m = e.data;
  if (m.type === 'forget') { tracks.delete(m.takeId); return; }
  try {
    let tr = tracks.get(m.takeId);
    if (!tr) { tr = pitchTrack(m.pcm, m.sr); tracks.set(m.takeId, tr); }
    const r = processVoice(m.pcm, m.sr, m.params, tr);
    const out = m.params.mode === 'none' ? null : r.out;
    const res: WorkerResponse = { req: m.req, out, rawMidi: r.rawMidi, outMidi: r.outMidi };
    (self as unknown as Worker).postMessage(res, out ? [out.buffer, r.rawMidi.buffer, r.outMidi.buffer] : [r.rawMidi.buffer, r.outMidi.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ req: m.req, out: null, rawMidi: new Float32Array(), outMidi: new Float32Array(), error: String(err) });
  }
};
