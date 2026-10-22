// Registre des prises audio (PCM mono d'origine) et de leurs versions traitées (autotune, grave, aigu).
import type { TuneParams } from './dsp/autotune';
import type { WorkerRequest, WorkerResponse } from './dsp/worker';

/** `pcm` : mono, pour l'analyse et le traitement. `channels` : original stéréo d'un fichier importé, pour la lecture. */
export interface Take { pcm: Float32Array; sr: number; channels?: Float32Array[] }
export interface Processed { key: string; buf: AudioBuffer | null; rawMidi: Float32Array; outMidi: Float32Array }

const takes = new Map<string, Take>();
const original = new Map<string, AudioBuffer>();
/** Versions traitées par prise, indexées par réglages (on en garde quelques-unes pour passer de l'une à l'autre sans recalcul). */
const processed = new Map<string, Map<string, Processed>>();
const inflight = new Map<string, Promise<Processed>>();
const listeners = new Set<() => void>();

export const onTakesChange = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => listeners.forEach(fn => fn());

let worker: Worker | null = null, reqN = 0;
const waiting = new Map<number, (r: WorkerResponse) => void>();
function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./dsp/worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => { waiting.get(e.data.req)?.(e.data); waiting.delete(e.data.req); };
  }
  return worker;
}
const post = (m: WorkerRequest) => getWorker().postMessage(m);

export const paramsKey = (p: TuneParams) => p.mode === 'none' ? 'none' : `${p.mode}|${p.key}|${p.scale}|${p.mode === 'autotune' ? p.retune : 0}`;

export function mixdown(channels: Float32Array[]) {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length, out = new Float32Array(n), g = 1 / channels.length;
  for (const ch of channels) for (let i = 0; i < n; i++) out[i] += ch[i] * g;
  return out;
}

export function addTake(id: string, pcm: Float32Array, sr: number, channels?: Float32Array[]) {
  takes.set(id, { pcm, sr, channels }); original.delete(id); processed.delete(id);
  if (worker) post({ type: 'forget', takeId: id });
  notify();
}
export function removeTake(id: string) {
  takes.delete(id); original.delete(id); processed.delete(id);
  if (worker) post({ type: 'forget', takeId: id });
  notify();
}
export const getTake = (id: string) => takes.get(id);
export const takeDuration = (id: string) => { const t = takes.get(id); return t ? t.pcm.length / t.sr : 0; };

function toBuffer(pcm: Float32Array | Float32Array[], sr: number) {
  const chans = Array.isArray(pcm) ? pcm : [pcm];
  const b = new AudioBuffer({ length: Math.max(1, chans[0].length), sampleRate: sr, numberOfChannels: chans.length });
  chans.forEach((ch, i) => b.copyToChannel(ch as Float32Array<ArrayBuffer>, i));
  return b;
}

export function originalBuffer(id: string) {
  let b = original.get(id);
  const t = takes.get(id);
  if (!b && t) { b = toBuffer(t.channels ?? t.pcm, t.sr); original.set(id, b); }
  return b;
}

/** Résultat du traitement s'il est à jour pour ces réglages. */
export function processedFor(id: string, p: TuneParams) {
  return processed.get(id)?.get(paramsKey(p));
}

/** Tampon à jouer : la version traitée si elle est prête, sinon l'original. */
export function playable(id: string, p: TuneParams) {
  if (p.mode === 'none') return originalBuffer(id);
  return processedFor(id, p)?.buf ?? originalBuffer(id);
}

export function isProcessing(id: string, p: TuneParams) {
  return inflight.has(id + '#' + paramsKey(p));
}

export function ensureProcessed(id: string, p: TuneParams): Promise<Processed | undefined> {
  const t = takes.get(id);
  if (!t) return Promise.resolve(undefined);
  const done = processedFor(id, p);
  if (done) return Promise.resolve(done);
  const key = paramsKey(p), fk = id + '#' + key;
  let pr = inflight.get(fk);
  if (!pr) {
    const req = ++reqN;
    pr = new Promise<Processed>((resolve, reject) => {
      waiting.set(req, r => {
        inflight.delete(fk);
        if (r.error) { reject(new Error(r.error)); notify(); return; }
        const res: Processed = { key, buf: r.out ? toBuffer(r.out, t.sr) : null, rawMidi: r.rawMidi, outMidi: r.outMidi };
        if (takes.get(id) === t) {
          const m = processed.get(id) ?? new Map<string, Processed>();
          m.delete(key); m.set(key, res);
          // 'none' (analyse seule, pour le graphe) est toujours gardé ; sinon on limite à 4 versions.
          for (const k of m.keys()) { if (m.size <= 4) break; if (k !== 'none') m.delete(k); }
          processed.set(id, m);
        }
        notify();
        resolve(res);
      });
      post({ type: 'process', req, takeId: id, pcm: t.pcm, sr: t.sr, params: p });
    });
    inflight.set(fk, pr);
    notify();
  }
  return pr;
}

/** Crêtes par tranche de `sec` secondes, pour dessiner la forme d'onde. */
export function peaks(id: string, sec: number, useProcessed?: TuneParams) {
  const t = takes.get(id);
  if (!t) return new Float32Array();
  const buf = useProcessed ? playable(id, useProcessed) : undefined;
  const d = buf ? buf.getChannelData(0) : t.pcm;
  const n = Math.max(1, Math.round(sec * t.sr)), len = Math.ceil(d.length / n), out = new Float32Array(len);
  let mx = 1e-6;
  for (let i = 0; i < len; i++) {
    let p = 0;
    for (let j = i * n, e = Math.min(d.length, j + n); j < e; j += 4) { const v = Math.abs(d[j]); if (v > p) p = v; }
    out[i] = p; if (p > mx) mx = p;
  }
  // Normalisation douce : une prise faible reste visible sans être écrasée.
  const g = Math.min(4, 0.95 / mx);
  for (let i = 0; i < len; i++) out[i] = Math.min(1, out[i] * g);
  return out;
}
