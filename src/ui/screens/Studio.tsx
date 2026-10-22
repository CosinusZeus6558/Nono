import { useEffect, useMemo, useRef } from 'react';
import { engine } from '../../audio/engine';
import { exportWav } from '../../audio/render';
import { chordsOf, tuneOf } from '../../audio/song';
import { isProcessing, peaks, takeDuration } from '../../audio/takes';
import { BASS, COLOR_FX, SECTIONS, STYLES, TUNES } from '../../music/presets';
import { stepDur, totalSteps, useStore } from '../../store/project';
import type { Track } from '../../store/types';
import { Wave, col, useProcessed, useTakesVersion } from '../common';

const rnd = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
type Voice = Pick<Track, 'tune' | 'fx'>;
const tuneName = (t: Voice) => TUNES.find(f => f.id === t.tune)!.name;
const fxName = (t: Voice) => COLOR_FX.find(f => f.id === t.fx)!.name;
export const voiceLabel = (t: Voice) => [t.tune !== 'none' && tuneName(t), t.fx !== 'none' && fxName(t)].filter(Boolean).join(' + ');

export function Studio() {
  const S = useStore();
  useTakesVersion();
  const total = totalSteps(S), bars = total / 16, sd = stepDur(S.bpm);
  const curBlock = Math.floor(Math.min(S.step, total - 1) / 64);
  const chords = chordsOf(S);
  const every = bars > 20 ? 4 : bars > 12 ? 2 : 1;
  const head = useRef<HTMLDivElement>(null);
  useEffect(() => engine.onHead(pos => { if (head.current) head.current.style.left = (pos / total * 100) + '%'; }), [total]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    engine.seek(Math.max(0, Math.min(total - 16, Math.floor((e.clientX - r.left) / r.width * bars) * 16)));
  };
  const sel = S.tracks.find(t => t.id === S.sel) ?? S.tracks[0];

  return (
    <div className="studio">
      <div className="tl-wrap">
        <div className="tl">
          <div className="tl-inner">
            <div className="tl-row tl-ruler">
              <div className="tl-ruler-head">Pistes <span className="mono">{S.tracks.length}</span></div>
              <div className="tl-ruler-lane" onClick={seek} title="Cliquez pour vous placer">
                {S.blocks.map((b, i) => (
                  <div key={i} className={'tl-sec' + (S.playing && i === curBlock ? ' on' : '')} style={{ left: `calc(${i * 4 / bars * 100}% + 2px)`, width: `calc(${4 / bars * 100}% - 4px)` }}>{b}</div>
                ))}
                {Array.from({ length: bars }, (_, i) => i).filter(i => i % every === 0).map(i => (
                  <div key={i} className="tl-bar" style={{ left: i / bars * 100 + '%' }}>{i + 1}</div>
                ))}
              </div>
            </div>
            {S.tracks.map(t => <TrackRow key={t.id} t={t} bars={bars} total={total} sd={sd} chords={chords.map(c => c.name)} />)}
            <div className="tl-row tl-add">
              <div style={{ borderRight: '1px solid var(--card-line)' }} />
              <div className="lane" style={{ padding: 10 }}>
                <button className="rec-cta" onClick={() => engine.toggleRec()}>
                  <span className="rec-dot" />{S.recording ? 'Arrêter l\'enregistrement' : 'Enregistrer une nouvelle prise au micro'}
                </button>
              </div>
            </div>
            <div className="playhead-layer"><div ref={head} className="playhead" style={{ left: Math.min(S.step, total) / total * 100 + '%' }} /></div>
          </div>
        </div>
      </div>
      {sel && <Inspector t={sel} />}
    </div>
  );
}

function TrackRow({ t, bars, total, sd, chords }: { t: Track; bars: number; total: number; sd: number; chords: string[] }) {
  const S = useStore(), selected = S.sel === t.id;
  const base = { color: col(t.hue, 0.76, 0.13), background: col(t.hue, 0.27, 0.05), borderColor: col(t.hue, 0.5, 0.1) };
  const label = col(t.hue, 0.86, 0.08);
  const blockPos = (i: number) => ({ left: `calc(${i * 4 / bars * 100}% + 2px)`, width: `calc(${4 / bars * 100}% - 4px)` });
  const tune = tuneOf(t, S), version = useTakesVersion();
  const tunedFor = t.tune !== 'none' ? `${t.tune}|${S.key}|${S.scale}|${t.retune}` : '';
  const recPeaks = useMemo(() => t.kind === 'rec' && t.takeId ? peaks(t.takeId, sd / 2, tunedFor ? tune : undefined) : new Float32Array(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t.takeId, sd, tunedFor, version]);
  useProcessed(t.kind === 'rec' && t.tune !== 'none' ? t.takeId : undefined, tune);

  const drumWave = useMemo(() => {
    if (t.kind !== 'drums' && t.kind !== 'bass') return [];
    const G = S.grid;
    return S.blocks.map((b, bi) => {
      const sec = SECTIONS[b], light = sec.drums === 'light', out = new Float32Array(64);
      for (let j = 0; j < 64; j++) {
        const st = j % 16;
        let k: number;
        if (t.kind === 'drums') k = (!light && G[0][st]) ? 1 : (!light && (G[1][st] || G[2][st])) ? 0.72 : (G[3][st] || G[4][st]) ? 0.34 : G[5][st] ? 0.26 : 0.05;
        else { const pat = BASS[S.style] || ''; const back = [0, 1, 2].find(o => pat[(st - o + 16) % 16] === 'x'); k = back === 0 ? 0.85 : back === 1 ? 0.55 : back === 2 ? 0.3 : 0.05; }
        out[j] = k * (0.88 + 0.12 * rnd(bi * 64 + j + t.hue));
      }
      return out;
    });
  }, [t.kind, t.hue, S.grid, S.blocks, S.style]);

  let clips: React.ReactNode = null;
  if (t.kind === 'drums' || t.kind === 'bass') {
    clips = S.blocks.map((b, bi) => {
      const sec = SECTIONS[b];
      if ((t.kind === 'drums' && sec.drums === 'none') || (t.kind === 'bass' && !sec.bass)) return null;
      return (
        <div key={bi} className="clip" style={{ ...base, ...blockPos(bi) }}>
          <div className="clip-label" style={{ color: label }}>{b}</div>
          <Wave className="clip-wave" values={drumWave[bi]} />
        </div>
      );
    });
  } else if (t.kind === 'chords') {
    clips = S.blocks.map((b, bi) => (
      <div key={bi} className="clip" style={{ ...base, ...blockPos(bi) }}>
        <div className="clip-label" style={{ color: label }}>{b}</div>
        <div className="clip-chords">{chords.map((c, k) => <div key={k} style={{ borderLeft: k ? `1px dashed ${base.borderColor}` : 0 }}>{c}</div>)}</div>
      </div>
    ));
  } else if (t.kind === 'rec' && t.takeId && t.startStep !== undefined) {
    const live = S.recId === t.id;
    const lenSteps = live ? Math.max(1, S.liveLevels.length) : Math.max(1, takeDuration(t.takeId) / sd);
    const shift = (t.offsetMs ?? 0) / 1000 / sd, start = t.startStep + shift;
    const values = live ? S.liveLevels : recPeaks;
    const busy = !live && t.tune !== 'none' && isProcessing(t.takeId, tune);
    clips = (
      <div className="clip" style={{ ...base, borderColor: live ? 'var(--rec)' : base.borderColor, left: `calc(${Math.max(0, start) / total * 100}% + 2px)`, width: `calc(${Math.min(lenSteps, total - Math.max(0, start)) / total * 100}% - 4px)` }}>
        <div className="clip-label" style={{ color: label }}>{live ? '● Enregistrement' : t.name + (busy ? ' · traitement…' : '')}</div>
        <Wave className="clip-wave" values={values} />
      </div>
    );
  }

  return (
    <div className={'tl-row tl-track' + (selected ? ' sel' : '')} onClick={() => S.set({ sel: t.id })}>
      <div className="tl-head">
        <div className="tl-name"><span className="dot" style={{ background: col(t.hue) }} /><span>{t.name}</span></div>
        <div className="tl-ctl">
          <button className={'mute' + (t.mute ? ' on' : '')} title="Muet" aria-pressed={t.mute} onClick={e => { e.stopPropagation(); S.updTrack(t.id, { mute: !t.mute }); }}>M</button>
          <div className="vol"><div style={{ width: t.vol + '%', background: col(t.hue) }} /></div>
          {t.kind === 'rec' && voiceLabel(t) && <span className="badge">{voiceLabel(t)}</span>}
        </div>
      </div>
      <div className="tl-lane" style={{ backgroundSize: `${100 / bars}% 100%`, opacity: t.mute ? 0.35 : 1 }}>{clips}</div>
    </div>
  );
}

function Inspector({ t }: { t: Track }) {
  const S = useStore();
  const styleName = STYLES.find(s => s.id === S.style)?.name ?? '';
  const kindLabel = { drums: 'Motif ' + styleName, bass: 'Synthé basse', chords: 'Nappe synthé', rec: 'Prise micro' }[t.kind];
  const isRec = t.kind === 'rec';
  return (
    <aside className="insp">
      <div className="insp-head">
        <span className="insp-sw" style={{ background: col(t.hue) }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          {isRec
            ? <input className="insp-name" value={t.name} maxLength={40} aria-label="Nom de la piste" onChange={e => S.updTrack(t.id, { name: e.target.value })} />
            : <div className="insp-name">{t.name}</div>}
          <div className="insp-kind">{kindLabel}</div>
        </div>
      </div>
      <div className="field">
        <div className="field-head"><span>Volume</span><span className="mono">{t.vol}%</span></div>
        <input type="range" min={0} max={100} value={t.vol} aria-label="Volume" onChange={e => S.updTrack(t.id, { vol: +e.target.value })} />
      </div>
      <div className="field">
        <div className="field-head"><span>Panoramique</span><span className="mono">{t.pan === 0 ? 'Centre' : (t.pan < 0 ? 'G ' : 'D ') + Math.abs(t.pan * 2)}</span></div>
        <input type="range" min={-50} max={50} value={t.pan} aria-label="Panoramique" onChange={e => S.updTrack(t.id, { pan: +e.target.value })} />
        <div className="field-foot"><span>Gauche</span><span>Droite</span></div>
      </div>
      {isRec && (
        <>
          <div className="box">
            <div className="hint">Effet de voix</div>
            <b>{voiceLabel(t) || 'Aucun'}</b>
          </div>
          <div className="field">
            <div className="field-head"><span>Calage</span><span className="mono">{(t.offsetMs ?? 0) > 0 ? '+' : ''}{t.offsetMs ?? 0} ms</span></div>
            <input type="range" min={-250} max={250} step={5} value={t.offsetMs ?? 0} aria-label="Calage de la prise" onChange={e => S.updTrack(t.id, { offsetMs: +e.target.value })} />
            <div className="field-foot"><span>Plus tôt</span><span>Plus tard</span></div>
          </div>
        </>
      )}
      <div className="stack">
        <button className="btn" onClick={() => isRec ? S.set({ screen: 'voix', voiceSrc: t.id }) : S.set({ screen: t.kind === 'drums' ? 'beats' : 'instru' })}>
          {isRec ? 'Changer l\'effet de voix' : t.kind === 'drums' ? 'Modifier le motif' : 'Modifier l\'instru'}
        </button>
        <button className="btn ghost" onClick={() => exportWav(t.id)}>Exporter cette piste seule</button>
        {isRec && <button className="btn danger" onClick={() => { if (confirm(`Supprimer « ${t.name} » ?`)) engine.deleteTrack(t.id); }}>Supprimer la prise</button>}
      </div>
    </aside>
  );
}
