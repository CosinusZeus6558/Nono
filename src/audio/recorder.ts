// Capture du micro en PCM brut via AudioWorklet : chaque bloc est horodaté dans l'horloge audio,
// ce qui permet de caler précisément la prise sur le tempo (MediaRecorder ne le permet pas).

const WORKLET = `
class NonoCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(2048); this.n = 0; this.t0 = 0; this.on = true;
    this.port.onmessage = e => { if (e.data === 'stop') { this.flush(); this.on = false; this.port.postMessage({ done: true }); } };
  }
  flush() { if (this.n) { this.port.postMessage({ t: this.t0, d: this.buf.slice(0, this.n) }); this.n = 0; } }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && this.on) {
      for (let i = 0; i < ch.length; i++) {
        if (this.n === 0) this.t0 = currentTime + i / sampleRate;
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) this.flush();
      }
    }
    return this.on;
  }
}
registerProcessor('nono-capture', NonoCapture);
`;

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Charge le worklet une fois par contexte ; `false` s'il est indisponible ou ne répond pas. */
function loadWorklet(c: AudioContext) {
  let p = loaded.get(c);
  if (!p) {
    p = !c.audioWorklet ? Promise.resolve(false) : Promise.race([
      c.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))).then(() => true, () => false),
      new Promise<boolean>(res => setTimeout(() => res(false), 2500)),
    ]);
    loaded.set(c, p);
  }
  return p;
}

export class Recorder {
  private stream?: MediaStream;
  private node?: AudioWorkletNode | ScriptProcessorNode;
  private src?: MediaStreamAudioSourceNode;
  private sink?: GainNode;
  private chunks: { t: number; d: Float32Array }[] = [];
  private done?: () => void;
  private rms = 0;
  inputLatency = 0;

  get armed() { return !!this.node; }
  level() { return this.rms; }

  async arm(c: AudioContext) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Micro non pris en charge par ce navigateur');
    // Traitements « visio » désactivés : ils abîment la voix chantée.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    const settings = this.stream.getAudioTracks()[0]?.getSettings() as MediaTrackSettings & { latency?: number };
    this.inputLatency = typeof settings?.latency === 'number' ? settings.latency : 0;
    this.chunks = [];
    this.src = c.createMediaStreamSource(this.stream);
    const push = (t: number, d: Float32Array) => {
      this.chunks.push({ t, d });
      let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      this.rms = Math.min(1, Math.sqrt(s / d.length) * 5);
    };
    if (await loadWorklet(c)) {
      const node = new AudioWorkletNode(c, 'nono-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
      node.port.onmessage = e => { if (e.data.done) this.done?.(); else push(e.data.t, e.data.d); };
      this.node = node;
    } else {
      // Repli pour les navigateurs sans AudioWorklet : horodatage approximatif (le réglage « Calage » permet d'ajuster).
      const node = c.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = e => { const d = e.inputBuffer.getChannelData(0); push(c.currentTime - d.length / c.sampleRate, d.slice()); };
      this.node = node;
    }
    this.sink = c.createGain(); this.sink.gain.value = 0;
    this.src.connect(this.node).connect(this.sink).connect(c.destination);
  }

  /** Arrête la capture et renvoie le son à partir de l'instant `from` (horloge audio). */
  async finish(from: number, sr: number): Promise<Float32Array> {
    if (!this.node) return new Float32Array();
    const node = this.node;
    if (node instanceof ScriptProcessorNode) node.onaudioprocess = null;
    else await new Promise<void>(res => { this.done = res; node.port.postMessage('stop'); setTimeout(res, 400); });
    const chunks = this.chunks;
    this.release();
    if (!chunks.length) return new Float32Array();
    const t0 = chunks[0].t, total = chunks.reduce((n, c) => n + c.d.length, 0);
    const all = new Float32Array(total);
    let o = 0; for (const c of chunks) { all.set(c.d, o); o += c.d.length; }
    const skip = Math.round((from - t0) * sr);
    if (skip >= 0) return all.slice(Math.min(skip, total));
    const out = new Float32Array(total - skip); out.set(all, -skip);
    return out;
  }

  release() {
    this.stream?.getTracks().forEach(t => t.stop());
    try { this.src?.disconnect(); this.node?.disconnect(); this.sink?.disconnect(); } catch { /* déjà déconnecté */ }
    this.stream = undefined; this.node = undefined; this.src = undefined; this.sink = undefined; this.chunks = []; this.rms = 0;
  }
}
