import { engine } from '../../audio/engine';
import { chordsOf } from '../../audio/song';
import { MOODS, SECTIONS, STYLES } from '../../music/presets';
import { NOTES, fmtTime } from '../../music/theory';
import { stepDur, totalSteps, useStore } from '../../store/project';
import { col } from '../common';

export function Instru() {
  const S = useStore();
  const total = totalSteps(S), bars = total / 16, cur = Math.min(S.step, total - 1);
  const curBar = Math.floor(cur / 16), curBlock = Math.floor(curBar / 4), songMode = S.playing && S.screen !== 'beats';
  const chords = chordsOf(S), styleName = STYLES.find(s => s.id === S.style)?.name ?? '';
  const pending = S.selStyle !== S.style || S.selMood !== S.mood;
  const selStyleName = STYLES.find(s => s.id === S.selStyle)!.name;

  const generate = () => {
    S.applyInstru();
    engine.refresh();
    const s = useStore.getState();
    s.toast('Instru prête : ' + (STYLES.find(x => x.id === s.style)?.name ?? '') + ' · ' + s.mood);
  };

  const lane = (hue: number, fn: (s: (typeof SECTIONS)[keyof typeof SECTIONS]) => number) =>
    S.blocks.map(b => fn(SECTIONS[b])).map(v => (v === 2 ? col(hue, 0.7, 0.14) : v === 1 ? col(hue, 0.42, 0.08) : 'oklch(0.22 0.012 280)'));
  const rows = [
    { name: 'Batterie', cells: lane(265, s => (s.drums === 'full' ? 2 : s.drums === 'light' ? 1 : 0)) },
    { name: 'Basse', cells: lane(175, s => (s.bass ? 2 : 0)) },
    { name: 'Accords', cells: lane(305, () => 2) },
  ];

  return (
    <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', alignItems: 'stretch' }}>
      <div className="card" style={{ gap: 24 }}>
        <div className="field" style={{ gap: 12 }}>
          <div className="step-title"><i>1</i><b>Style</b></div>
          <div className="styles">
            {STYLES.map(s => (
              <button key={s.id} className={'choice' + (S.selStyle === s.id ? ' on' : '')} onClick={() => S.set({ selStyle: s.id })}>
                <b>{s.name}</b><span>{s.desc}</span><span className="mono">{s.bpm} BPM</span>
              </button>
            ))}
          </div>
        </div>
        <div className="field" style={{ gap: 12 }}>
          <div className="step-title"><i>2</i><b>Ambiance</b></div>
          <div className="moods">
            {MOODS.map(m => <button key={m.id} className={'mood' + (S.selMood === m.id ? ' on' : '')} onClick={() => S.set({ selMood: m.id })}>{m.id}</button>)}
          </div>
        </div>
        <button className="generate" onClick={generate}>{pending ? `Générer l'instru ${selStyleName} · ${S.selMood}` : 'Générer une nouvelle version'}</button>
      </div>

      <div className="card" style={{ gap: 22 }}>
        <div className="field" style={{ gap: 6 }}>
          <div className="hint" style={{ fontWeight: 600 }}>Votre instru</div>
          <div className="instru-title">{styleName} · {S.mood}</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{NOTES[S.key]} {S.scale} · {S.bpm} BPM · {bars} mesures · {fmtTime(total * stepDur(S.bpm))}</div>
        </div>
        <div className="field">
          <div className="field-head"><span>Accords</span></div>
          <div className="chords">
            {chords.map((c, i) => <div key={i} className={'chord' + (songMode && curBar % 4 === i ? ' on' : '')}><b>{c.name}</b><span className="mono">{c.roman}</span></div>)}
          </div>
        </div>
        <div className="field">
          <div className="field-head"><span>Structure</span></div>
          <div className="arr">
            <div />
            <div className="arr-cells arr-head">
              {S.blocks.map((b, i) => <div key={i} className={songMode && i === curBlock ? 'on' : ''}>{b}</div>)}
            </div>
            {rows.map(r => [
              <div key={r.name + 'n'} className="arr-name">{r.name}</div>,
              <div key={r.name + 'c'} className="arr-cells">{r.cells.map((bg, i) => <div key={i} className="arr-cell" style={{ background: bg }} />)}</div>,
            ])}
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 'auto' }}>
          <button className="btn light" onClick={() => engine.toggle()}>{S.playing ? 'Pause' : 'Écouter l\'instru'}</button>
          <button className="btn" onClick={() => { S.set({ selStyle: S.style, selMood: S.mood }); generate(); }}>Une autre version</button>
          <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => S.set({ screen: 'studio' })}>Ouvrir dans le studio</button>
        </div>
      </div>
    </div>
  );
}
