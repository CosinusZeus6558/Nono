import { useEffect, useMemo, useReducer, useSyncExternalStore } from 'react';
import type { TuneParams } from '../audio/dsp/autotune';
import { ensureProcessed, onTakesChange } from '../audio/takes';
import type { Screen } from '../store/types';

export const col = (h: number, l = 0.72, c = 0.14) => `oklch(${l} ${c} ${h})`;

let takesVersion = 0;
onTakesChange(() => { takesVersion++; });
/** Re-rendu quand une prise est ajoutée ou qu'un traitement se termine. */
export const useTakesVersion = () => useSyncExternalStore(onTakesChange, () => takesVersion);

/** Lance (avec un léger délai, pour les curseurs) le traitement d'une prise pour ces réglages. */
export function useProcessed(takeId: string | undefined, p: TuneParams, delay = 250) {
  const v = useTakesVersion();
  const key = takeId ? `${takeId}|${p.mode}|${p.key}|${p.scale}|${p.retune}` : '';
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!takeId) return;
    const t = setTimeout(() => { ensureProcessed(takeId, p).catch(() => force()); }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, v]);
}

/** Forme d'onde en barres, dessinée en un seul chemin SVG. */
export function Wave({ values, className, style }: { values: ArrayLike<number>; className?: string; style?: React.CSSProperties }) {
  const d = useMemo(() => {
    const n = values.length;
    if (!n) return '';
    let s = '';
    for (let i = 0; i < n; i++) {
      const h = Math.max(0.04, Math.min(1, values[i])) * 50;
      s += `M${(i + 0.5).toFixed(1)} ${(50 - h).toFixed(1)}V${(50 + h).toFixed(1)}`;
    }
    return s;
  }, [values]);
  return (
    <svg className={className} style={style} viewBox={`0 0 ${Math.max(1, values.length)} 100`} preserveAspectRatio="none">
      <path d={d} stroke="currentColor" strokeWidth={0.7} fill="none" />
    </svg>
  );
}

export const SCREENS: { id: Screen; name: string; sub: string; title: string; subtitle: string; icon: React.ReactNode }[] = [
  {
    id: 'studio', name: 'Studio', sub: 'Multipiste', title: 'Studio', subtitle: 'Enregistrez et arrangez vos pistes',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h10M4 12h16M4 17h7" /></svg>,
  },
  {
    id: 'beats', name: 'Beats', sub: 'Séquenceur et pads', title: 'Beats', subtitle: 'Composez un motif pas à pas, jouez sur les pads',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>,
  },
  {
    id: 'voix', name: 'Voix', sub: 'Autotune et effets', title: 'Voix', subtitle: 'Autotune, robot, écho : transformez votre voix',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>,
  },
  {
    id: 'instru', name: 'Instru', sub: 'Génération guidée', title: 'Instru', subtitle: 'Choisissez un style et une ambiance, Studio Nono compose le reste',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8 5v8M12 5v8M16 5v8" /></svg>,
  },
];

export const PlayIcon = ({ size = 20 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" /></svg>;
export const PauseIcon = ({ size = 20 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>;
export const DownloadIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
