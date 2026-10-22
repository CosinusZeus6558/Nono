// Installation de l'appli (PWA) : Chrome et Edge proposent une boîte native via `beforeinstallprompt` ;
// les autres navigateurs demandent une manipulation manuelle, expliquée dans l'appli.
import { useSyncExternalStore } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let version = 0;
const subs = new Set<() => void>();
const emit = () => { version++; subs.forEach(f => f()); };

const standalone = window.matchMedia('(display-mode: standalone)');
const isInstalled = () => standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// Écouteurs posés dès le chargement du module : l'événement peut arriver avant le premier rendu.
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallPromptEvent; emit(); });
window.addEventListener('appinstalled', () => { deferred = null; emit(); });
standalone.addEventListener?.('change', emit);

export function useInstall() {
  useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => version);
  return { canPrompt: !!deferred, installed: isInstalled() };
}

/** Ouvre la boîte d'installation native ; `false` si le navigateur n'en propose pas. */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  await e.prompt();
  await e.userChoice.catch(() => null);
  deferred = null; emit();
  return true;
}

export type Browser = 'ios' | 'safari' | 'firefox' | 'android' | 'chromium';
export function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/firefox|fxios/i.test(ua)) return 'firefox';
  if (/^((?!chrome|chromium|crios|edg|android).)*safari/i.test(ua)) return 'safari';
  if (/android/i.test(ua)) return 'android';
  return 'chromium';
}
