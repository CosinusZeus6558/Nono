import { useEffect, useMemo, useRef } from 'react';
import { renderDemoVoice } from '../../audio/demoVoice';
import type { TuneParams } from '../../audio/dsp/autotune';
import { engine } from '../../audio/engine';
import { AUDIO_ACCEPT, importFiles } from '../../audio/importer';
import { addTake, getTake, isProcessing, peaks, processedFor, takeDuration } from '../../audio/takes';
import { COLOR_FX, TUNES, type ScaleName } from '../../music/presets';
import { NOTES, SCALES } from '../../music/theory';
import { useStore } from '../../store/project';
import type { VoiceSettings } from '../../store/types';
import { PlayIcon, Wave, useProcessed, useTakesVersion } from '../common';
import { voiceLabel } from './Studio';

const DEMO = 'demo';
let demoFor = '';
function ensureDemo(key: number, scale: ScaleName) {
  const k = key + '|' + scale;
  if (demoFor === k) return;
  demoFor = k;
  renderDemoVoice(key, scale).then(({ pcm, sr }) => { if (demoFor === k) addTake(DEMO, pcm, sr); }).catch(() => { demoFor = ''; });
}

const W = 600, H = 240;

function pathOf(arr: Float32Array, y: (m: number) => number) {
  let d = '', pen = false;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (!Number.isFinite(v)) { pen = false; continue; }
    d += (pen ? 'L' : 'M') + (i / Math.max(1, arr.length - 1) * W).toFixed(1) + ' ' + y(v).toFixed(1);
    pen = true;
  }
  return d;
}

export function Voix() {
  const S = useStore();
  useTakesVersion();
  const recs = S.tracks.filter(t => t.kind === 'rec' && t.takeId && getTake(t.takeId));
  const src = S.voiceSrc === DEMO ? undefined : recs.find(t => t.id === S.voiceSrc);
  const set: VoiceSettings = src ? { tune: src.tune, retune: src.retune, fx: src.fx } : S.demo;
  const update = (p: Partial<VoiceSettings>) => src ? S.updTrack(src.id, p) : S.set({ demo: { ...S.demo, ...p } });
  const takeId = src?.takeId ?? DEMO;
  const tune: TuneParams = { mode: set.tune, key: S.key, scale: S.scale, retune: set.retune };

  useEffect(() => { if (!src) ensureDemo(S.key, S.scale); }, [src, S.key, S.scale]);
  useProcessed(getTake(takeId) ? takeId : undefined, tune, 200);
  // Les courbes « avant » viennent de l'analyse seule (mode none), toujours utile pour le graphe.
  useProcessed(getTake(takeId) ? takeId : undefined, { ...tune, mode: 'none' }, 0);
  const res = processedFor(takeId, tune);
  const base = processedFor(takeId, { ...tune, mode: 'none' });
  const busy = set.tune !== 'none' && isProcessing(takeId, tune);
  const ready = !!getTake(takeId) && (set.tune === 'none' || !!res);

  const graph = useMemo(() => {
    const raw = base?.rawMidi, out = res?.outMidi ?? raw;
    if (!raw || !out) return null;
    let lo = Infinity, hi = -Infinity;
    for (const a of [raw, out]) for (const v of a) if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (!Number.isFinite(lo)) return { empty: true as const };
    lo = Math.floor(lo) - 1; hi = Math.ceil(hi) + 1;
    if (hi - lo < 8) { const mid = (hi + lo) / 2; lo = Math.floor(mid - 4); hi = Math.ceil(mid + 4); }
    const y = (m: number) => (hi - m) / (hi - lo) * H;
    const sc = SCALES[S.scale], lines: number[] = [];
    for (let m = lo; m <= hi; m++) if (sc.includes((((m - S.key) % 12) + 12) % 12)) lines.push(m);
    return {
      empty: false as const, raw: pathOf(raw, y), eff: pathOf(out, y),
      grid: lines.map(m => `M0 ${y(m).toFixed(1)}H${W}`).join(''),
      labels: lines.map(m => ({ m, name: NOTES[((m % 12) + 12) % 12], top: (12 + y(m)) / (H + 24) * 100, tonic: ((m % 12) + 12) % 12 === S.key })),
    };
  }, [base, res, S.key, S.scale]);

  const dur = takeDuration(takeId);
  const wave = useMemo(() => (getTake(takeId) ? peaks(takeId, Math.max(0.01, dur / 300)) : new Float32Array()), [takeId, dur]);

  const fileIn = useRef<HTMLInputElement>(null);
  const importVoice = async (files: FileList) => { const id = await importFiles(files); if (id) S.set({ voiceSrc: id }); };
  const vhead = useRef<HTMLDivElement>(null);
  useEffect(() => engine.onPreviewHead(p => {
    const el = vhead.current; if (!el) return;
    el.style.opacity = p < 0 ? '0' : '1'; el.style.left = Math.max(0, p) * 100 + '%';
  }), []);
  useEffect(() => () => engine.stopPreview(), []);

  const preview = (fx: boolean) => {
    if (S.voicePlaying === (fx ? 'fx' : 'raw')) { engine.stopPreview(); return; }
    if (engine.previewTake(takeId, fx ? tune : { ...tune, mode: 'none' }, fx ? set.fx : 'none')) S.set({ voicePlaying: fx ? 'fx' : 'raw' });
  };

  const effName = voiceLabel(set) || 'aucun effet';
  const retuneLabel = set.retune < 40 ? 'Naturel' : set.retune < 80 ? 'Équilibré' : 'Robotique';

  return (
    <div className="grid2">
      <div className="card" style={{ gap: 18 }}>
        <div className="row">
          <div className="card-title">{src ? src.name : 'Voix démo'}</div>
          <div className="seg" style={{ marginLeft: 'auto' }}>
            <button className={!src ? 'on' : ''} onClick={() => S.set({ voiceSrc: DEMO })}>Voix démo</button>
            {recs.map(t => <button key={t.id} className={src?.id === t.id ? 'on' : ''} onClick={() => S.set({ voiceSrc: t.id })}>{t.name}</button>)}
          </div>
        </div>

        <div className="graph">
          <div className="graph-labels">
            {graph && !graph.empty && graph.labels.map(l => <div key={l.m} className={l.tonic ? 'tonic' : ''} style={{ top: l.top + '%' }}>{l.name}</div>)}
          </div>
          <div className="graph-plot">
            {graph && !graph.empty ? (
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <path d={graph.grid} stroke="oklch(0.28 0.014 280)" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />
                <path d={graph.raw} fill="none" stroke="oklch(0.62 0.015 280)" strokeWidth="1.6" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                {set.tune !== 'none' && res && <path d={graph.eff} fill="none" stroke="oklch(0.74 0.15 265)" strokeWidth="2.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
              </svg>
            ) : (
              <div className="graph-empty">{graph?.empty ? 'Aucune note chantée détectée dans cette prise.' : 'Analyse de la voix…'}</div>
            )}
            <div ref={vhead} className="vhead" />
          </div>
        </div>
        <Wave className="mini-wave" values={wave} />

        <div className="row" style={{ gap: 18 }}>
          <div className="legend"><span style={{ width: 18, borderTop: '2px dashed oklch(0.62 0.015 280)' }} />Voix originale</div>
          <div className="legend eff"><span style={{ width: 18, height: 3, borderRadius: 2, background: 'oklch(0.74 0.15 265)' }} />Avec {effName.toLowerCase()}</div>
          <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
            <button className="btn" disabled={!getTake(takeId)} onClick={() => preview(false)}>{S.voicePlaying === 'raw' ? 'Stop' : 'Écouter l\'original'}</button>
            <button className="btn primary" disabled={!ready} onClick={() => preview(true)}>
              <PlayIcon size={14} />{busy ? 'Traitement…' : S.voicePlaying === 'fx' ? 'Stop' : 'Écouter avec l\'effet'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <div className="card">
          <div className="card-title">Hauteur</div>
          <div className="choices">
            {TUNES.map(f => (
              <button key={f.id} className={'choice' + (set.tune === f.id ? ' on' : '')} onClick={() => update({ tune: f.id })}><b>{f.name}</b><span>{f.desc}</span></button>
            ))}
          </div>
        </div>

        {set.tune === 'autotune' && (
          <div className="card">
            <div className="card-title">Réglages autotune</div>
            <div className="field">
              <div className="field-head"><span>Tonalité</span><span className="hint">partagée avec l'instru</span></div>
              <div className="keys">
                {NOTES.map((n, i) => <button key={n} className={S.key === i ? 'on' : ''} onClick={() => S.set({ key: i })}>{n}</button>)}
              </div>
            </div>
            <div className="field">
              <div className="field-head"><span>Gamme</span></div>
              <div className="seg two">
                {(['majeur', 'mineur'] as const).map(s => <button key={s} className={S.scale === s ? 'on' : ''} onClick={() => S.set({ scale: s })}>{s === 'majeur' ? 'Majeure' : 'Mineure'}</button>)}
              </div>
            </div>
            <div className="field">
              <div className="field-head"><span>Correction</span><span className="mono">{set.retune}% · {retuneLabel}</span></div>
              <input type="range" min={0} max={100} value={set.retune} aria-label="Force de correction" onChange={e => update({ retune: +e.target.value })} />
              <div className="field-foot"><span>Naturel</span><span>Robotique</span></div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-title">Effet</div>
          <div className="choices">
            {COLOR_FX.map(f => (
              <button key={f.id} className={'choice' + (set.fx === f.id ? ' on' : '')} onClick={() => update({ fx: f.id })}><b>{f.name}</b><span>{f.desc}</span></button>
            ))}
          </div>
        </div>

        <div className="card" style={{ gap: 12 }}>
          {src ? (
            <div className="status">Ces réglages s'appliquent directement à <b>« {src.name} »</b> : on les entend dans le studio et à l'export. L'enregistrement d'origine est conservé.</div>
          ) : (
            <>
              <div className="status">La <b>voix démo</b> sert à essayer les effets. Enregistrez votre voix ou importez un fichier pour la transformer à son tour.</div>
              <button className="btn light" onClick={() => engine.toggleRec()}>Enregistrer une prise</button>
            </>
          )}
          <button className="btn" onClick={() => fileIn.current?.click()}>Importer une voix (MP3, WAV…)</button>
          <input ref={fileIn} type="file" accept={AUDIO_ACCEPT} hidden onChange={e => { if (e.target.files) importVoice(e.target.files); e.target.value = ''; }} />
        </div>
      </div>
    </div>
  );
}
