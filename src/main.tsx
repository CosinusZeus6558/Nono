import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { initPersistence } from './store/persist';
import { App } from './ui/App';
import './app.css';

registerSW({ immediate: true });
initPersistence().finally(() => {
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
});
