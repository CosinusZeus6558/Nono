import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { exportWav } from '../audio/render';
import { NOTES, fmtTime } from '../music/theory';
import { deleteProject, listProjects, openProject, saveProject, type ProjectMeta } from '../store/persist';
import { newProject, projectOf, stepDur, totalSteps, useStore } from '../store/project';
import { DownloadIcon, PauseIcon, PlayIcon, SCREENS, useTakesVersion } from './common';
import { detectBrowser, promptInstall, useInstall } from './install';

const InstallIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 7v6M9.5 10.5 12 13l2.5-2.5M8 20h8" /></svg>;

async function install() {
  if (!(await promptInstall())) useStore.setState({ installOpen: true });
}

function InstallButton({ className, iconOnly }: { className: string; iconOnly?: boolean }) {
  const { installed } = useInstall();
  if (installed) return null;
  return (
    <button className={className} onClick={install} aria-label="Installer l'appli" title="Installer Studio Nono sur cet appareil">
      <InstallIcon />{!iconOnly && 'Installer l\'appli'}
    </button>
  );
}

const go = (screen: (typeof SCREENS)[number]['id']) => {
  if (screen !== useStore.getState().screen && useStore.getState().playing && !useStore.getState().recording) {
    // Le mode boucle (Beats) et le mode morceau ne jouent pas la même chose : on relance proprement.
    useStore.setState({ screen }); engine.refresh();
  } else useStore.setState({ screen });
};

export function Sidebar() {
  const screen = useStore(s => s.screen), name = useStore(s => s.name);
  const bpm = useStore(s => s.bpm), key = useStore(s => s.key), scale = useStore(s => s.scale), blocks = useStore(s => s.blocks), tracks = useStore(s => s.tracks);
  useTakesVersion();
  const bars = totalSteps({ blocks, tracks, bpm }) / 16;
  return (
    <aside className="side">
      <div className="brand"><div className="logo" />Studio Nono</div>
      <nav className="nav">
        <div className="nav-title">Créer</div>
        {SCREENS.map(s => (
          <button key={s.id} className={'nav-btn' + (screen === s.id ? ' on' : '')} onClick={() => go(s.id)}>
            <span className="nav-ico">{s.icon}</span>
            <span className="nav-txt"><b>{s.name}</b><span>{s.sub}</span></span>
          </button>
        ))}
      </nav>
      <div className="proj">
        <div className="proj-label">Projet en cours</div>
        <div className="proj-name">{name}</div>
        <div className="proj-meta">
          <span>{bpm} BPM · {NOTES[key]} {scale}</span>
          <span>{bars} mesures · {fmtTime(bars * 16 * stepDur(bpm))}</span>
        </div>
        <button className="btn small" onClick={() => useStore.setState({ projectsOpen: true })}>Mes projets</button>
        <InstallButton className="btn small primary" />
      </div>
    </aside>
  );
}

export function TabBar() {
  const screen = useStore(s => s.screen);
  return (
    <nav className="tabbar">
      {SCREENS.map(s => (
        <button key={s.id} className={screen === s.id ? 'on' : ''} onClick={() => go(s.id)}>{s.icon}{s.name}</button>
      ))}
    </nav>
  );
}

export function Header() {
  const screen = useStore(s => s.screen), sc = SCREENS.find(s => s.id === screen)!;
  return (
    <header className="hdr">
      <div className="hdr-txt">
        <div className="hdr-title">{sc.title}</div>
        <div className="hdr-sub">{sc.subtitle}</div>
      </div>
      <InstallButton className="btn hdr-proj hdr-install" iconOnly />
      <button className="btn hdr-proj" onClick={() => useStore.setState({ projectsOpen: true })}>Projets</button>
      <button className="btn primary" onClick={() => exportWav()}><DownloadIcon />Exporter</button>
    </header>
  );
}

export function Transport() {
  const step = useStore(s => s.step), bpm = useStore(s => s.bpm), blocks = useStore(s => s.blocks), tracks = useStore(s => s.tracks);
  const playing = useStore(s => s.playing), recording = useStore(s => s.recording), master = useStore(s => s.master);
  useTakesVersion();
  const total = totalSteps({ blocks, tracks, bpm }), sd = stepDur(bpm), cur = Math.min(step, total - 1);
  const setBpm = (b: number) => useStore.setState({ bpm: Math.max(60, Math.min(180, b)) });
  return (
    <footer className="transport">
      <div className="t-time">
        <span className="now">{fmtTime(cur * sd)}</span>
        <span className="tot">/ {fmtTime(total * sd)}</span>
        <span className="pos">Mesure {Math.floor(cur / 16) + 1} · Temps {Math.floor((cur % 16) / 4) + 1}</span>
      </div>
      <div className="t-ctl">
        <button className="round" title="Début" aria-label="Revenir au début" onClick={() => engine.seek(0)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="2.5" height="14" rx="1" /><path d="M19 5.5v13L9 12z" /></svg>
        </button>
        <button className="round play" title="Lecture (Espace)" aria-label={playing ? 'Pause' : 'Lecture'} onClick={() => engine.toggle()}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button className={'round rec' + (recording ? ' on' : '')} title="Enregistrer (R)" aria-label="Enregistrer" onClick={() => engine.toggleRec()}><span /></button>
      </div>
      <div className="t-right">
        <div className="bpm">
          <button aria-label="Ralentir" onClick={() => setBpm(bpm - 2)}>−</button>
          <span>{bpm} BPM</span>
          <button aria-label="Accélérer" onClick={() => setBpm(bpm + 2)}>+</button>
        </div>
        <label className="master" title="Volume général">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(0.7 0.015 280)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M4 9.5h4l5-4v13l-5-4H4z" /><path d="M16.5 9a4 4 0 0 1 0 6" /></svg>
          <input type="range" min={0} max={100} value={master} aria-label="Volume général" onChange={e => useStore.setState({ master: +e.target.value })} />
        </label>
      </div>
    </footer>
  );
}

export function Overlays() {
  const toast = useStore(s => s.toastMsg), countIn = useStore(s => s.countIn), open = useStore(s => s.projectsOpen), installOpen = useStore(s => s.installOpen);
  return (
    <>
      {countIn > 0 && <div className="countin"><div>{countIn}</div></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
      {open && <Projects />}
      {installOpen && <InstallHelp />}
    </>
  );
}

function Projects() {
  const [list, setList] = useState<ProjectMeta[]>([]);
  const id = useStore(s => s.id), name = useStore(s => s.name);
  const close = () => useStore.setState({ projectsOpen: false });
  const refresh = () => listProjects().then(setList).catch(() => setList([]));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { refresh(); }, []);
  const switchTo = async (fn: () => Promise<unknown>) => {
    engine.pause();
    await saveProject(projectOf(useStore.getState()));
    await fn();
    close();
  };
  return (
    <div className="modal-bg" onClick={close}>
      <div className="card modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Mes projets">
        <div className="row"><div className="card-title">Mes projets</div><button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={close}>Fermer</button></div>
        <div className="field">
          <div className="field-head"><span>Nom du projet en cours</span></div>
          <input ref={input} className="text-in" value={name} maxLength={60} onChange={e => useStore.setState({ name: e.target.value })} />
        </div>
        <button className="btn primary" onClick={() => switchTo(async () => { const p = newProject(); useStore.getState().setProject(p); await saveProject(p); })}>Nouveau projet</button>
        <div className="proj-list">
          {list.map(m => (
            <div key={m.id} className={'proj-item' + (m.id === id ? ' on' : '')}>
              <div><b>{m.id === id ? name : m.name}</b><span className="hint">{new Date(m.updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
              {m.id !== id && <button className="btn small" onClick={() => switchTo(() => openProject(m.id))}>Ouvrir</button>}
              {m.id !== id && <button className="btn small danger" onClick={async () => { if (confirm(`Supprimer « ${m.name} » et ses prises ?`)) { await deleteProject(m.id); refresh(); } }}>Supprimer</button>}
            </div>
          ))}
        </div>
        <div className="hint">Les projets sont enregistrés dans ce navigateur, sur cet appareil. Exportez en WAV pour garder vos morceaux ailleurs.</div>
      </div>
    </div>
  );
}

const HELP: Record<ReturnType<typeof detectBrowser>, { title: string; steps: string[] }> = {
  chromium: { title: 'Chrome ou Edge', steps: ['Cliquez sur l\'icône d\'installation à droite de la barre d\'adresse (un écran avec une flèche).', 'Ou ouvrez le menu ⋮ → « Installer Studio Nono » (Chrome) / « Applications → Installer ce site en tant qu\'application » (Edge).'] },
  safari: { title: 'Safari sur Mac', steps: ['Menu Fichier → « Ajouter au Dock ».', 'Il faut macOS Sonoma (14) ou plus récent.'] },
  ios: { title: 'iPhone ou iPad', steps: ['Ouvrez ce site dans Safari.', 'Touchez le bouton Partager, puis « Sur l\'écran d\'accueil ».'] },
  android: { title: 'Android', steps: ['Ouvrez le menu ⋮ de Chrome → « Installer l\'application » ou « Ajouter à l\'écran d\'accueil ».'] },
  firefox: { title: 'Firefox', steps: ['Firefox ne permet pas d\'installer ce type d\'appli sur ordinateur.', 'Ouvrez ce site dans Chrome ou Edge, puis cliquez sur « Installer l\'appli ».'] },
};

function InstallHelp() {
  const b = detectBrowser(), close = () => useStore.setState({ installOpen: false });
  const others = (Object.keys(HELP) as (keyof typeof HELP)[]).filter(k => k !== b);
  return (
    <div className="modal-bg" onClick={close}>
      <div className="card modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Installer l'appli">
        <div className="row"><div className="card-title">Installer Studio Nono</div><button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={close}>Fermer</button></div>
        <div className="status">Une fois installée, l'appli s'ouvre dans sa propre fenêtre, depuis une icône sur le bureau ou l'écran d'accueil, et fonctionne même sans connexion.</div>
        <div className="box">
          <div className="hint">Sur votre navigateur ({HELP[b].title})</div>
          <ol className="install-steps">{HELP[b].steps.map(s => <li key={s}>{s}</li>)}</ol>
        </div>
        <details className="install-more">
          <summary>Autres navigateurs</summary>
          {others.map(k => <div key={k}><b>{HELP[k].title}</b><ol className="install-steps">{HELP[k].steps.map(s => <li key={s}>{s}</li>)}</ol></div>)}
        </details>
      </div>
    </div>
  );
}
