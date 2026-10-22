import { engine } from '../../audio/engine';
import { ROWS, STYLES } from '../../music/presets';
import { useStore } from '../../store/project';
import { col } from '../common';

const PRESETS = [...STYLES.map(s => ({ id: s.id, name: s.name })), { id: 'vide' as const, name: 'Vide' }];

export function Beats() {
  const S = useStore();
  const on = S.playing && S.screen === 'beats', cur = S.step % 16;
  const toggle = (r: number, st: number) => {
    if (!S.grid[r][st]) engine.hit(ROWS[r].id);
    S.toggleCell(r, st);
  };
  return (
    <div className="page">
      <div className="card">
        <div className="row">
          <div className="card-title">Motif</div>
          <div className="seg">
            {PRESETS.map(p => <button key={p.id} className={S.preset === p.id ? 'on' : ''} onClick={() => S.setPreset(p.id)}>{p.name}</button>)}
          </div>
          <div className="hint" style={{ marginLeft: 'auto' }}>Touchez une case pour l'activer · 16 pas = 1 mesure</div>
        </div>
        <div className="beat-rows">
          {ROWS.map((r, i) => {
            const m = !!S.rowMute[r.id];
            return (
              <div key={r.id} className="beat-row">
                <div className="beat-name" style={{ opacity: m ? 0.45 : 1 }}>
                  <button className={'mute' + (m ? ' on' : '')} title="Muet" aria-pressed={m} onClick={() => S.set({ rowMute: { ...S.rowMute, [r.id]: !m } })}>M</button>
                  <button className="beat-label" onClick={() => engine.hit(r.id)}><span className="dot" style={{ background: col(r.hue) }} /><span>{r.name}</span></button>
                </div>
                <div className="beat-groups">
                  {[0, 1, 2, 3].map(g => (
                    <div key={g} className="beat-group">
                      {[0, 1, 2, 3].map(c => {
                        const st = g * 4 + c, v = S.grid[i][st], here = on && st === cur;
                        const bg = v ? (here ? col(r.hue, 0.86, 0.12) : col(r.hue, m ? 0.45 : 0.7, m ? 0.05 : 0.14)) : (here ? 'oklch(0.34 0.02 280)' : g % 2 ? 'oklch(0.235 0.012 280)' : 'oklch(0.265 0.014 280)');
                        return (
                          <button key={c} className="cell" aria-label={`${r.name}, pas ${st + 1}`} aria-pressed={v} onClick={() => toggle(i, st)}
                            style={{ background: bg, transform: v && here ? 'scale(1.06)' : undefined, boxShadow: v && !m ? `0 0 14px oklch(0.7 0.14 ${r.hue} / ${here ? 0.6 : 0.22})` : 'none' }} />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="beat-row" style={{ marginTop: 4 }}>
            <div />
            <div className="step-nums">
              {[0, 1, 2, 3].map(g => (
                <div key={g}>{[0, 1, 2, 3].map(c => <span key={c} className={on && g * 4 + c === cur ? 'on' : ''}>{c === 0 ? g + 1 : '·'}</span>)}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
          <div className="card-title">Pads</div>
          <div className="hint">Jouez en direct au doigt, à la souris ou au clavier</div>
        </div>
        <div className="pads">
          {ROWS.map((r, i) => {
            const lit = S.padHit === r.id || (on && S.grid[i][cur] && !S.rowMute[r.id]);
            return (
              <button key={r.id} className="pad" onPointerDown={e => { e.preventDefault(); engine.hit(r.id); }}
                style={{ background: lit ? col(r.hue, 0.72, 0.15) : col(r.hue, 0.25, 0.04), color: lit ? 'oklch(0.15 0.02 280)' : 'var(--ink)', borderColor: col(r.hue, lit ? 0.8 : 0.4, 0.1), transform: lit ? 'scale(0.97)' : undefined }}>
                <span className="mono">{r.key}</span>
                <b>{r.name}</b>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
