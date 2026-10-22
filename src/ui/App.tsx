import { useEffect } from 'react';
import { engine } from '../audio/engine';
import { useStore } from '../store/project';
import { Beats } from './screens/Beats';
import { Instru } from './screens/Instru';
import { Studio } from './screens/Studio';
import { Voix } from './screens/Voix';
import { Header, Overlays, Sidebar, TabBar, Transport } from './Shell';

export function App() {
  const screen = useStore(s => s.screen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'text' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space') { e.preventDefault(); engine.toggle(); return; }
      if (e.repeat) return;
      if (e.key === 'r' || e.key === 'R') { engine.toggleRec(); return; }
      if (useStore.getState().screen === 'beats') engine.hitKey(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Sidebar />
      <div className="col">
        <Header />
        <main className="content">
          {screen === 'studio' && <Studio />}
          {screen === 'beats' && <Beats />}
          {screen === 'voix' && <Voix />}
          {screen === 'instru' && <Instru />}
        </main>
        <Transport />
        <TabBar />
      </div>
      <Overlays />
    </div>
  );
}
