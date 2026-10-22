// Export : le morceau est rejoué dans un OfflineAudioContext avec exactement la même partition que la lecture.
import { projectOf, stepDur, totalSteps, useStore } from '../store/project';
import type { Project } from '../store/types';
import { ensureProcessed } from './takes';
import { makeMix, playStep, tuneOf } from './song';
import { encodeWav } from './wav';

export async function renderMix(S: Project, solo?: string): Promise<AudioBuffer> {
  // Les voix traitées doivent être prêtes avant le rendu.
  await Promise.all(S.tracks.filter(t => t.kind === 'rec' && t.takeId && t.tune !== 'none').map(t => ensureProcessed(t.takeId!, tuneOf(t, S)).catch(() => undefined)));
  const sr = 44100, total = totalSteps(S), sd = stepDur(S.bpm), dur = total * sd + 2.5;
  const c = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
  const master = c.createGain(); master.gain.value = S.master / 100;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp).connect(c.destination);
  const mix = makeMix(c, master, S.tracks, solo);
  for (let s = 0; s < total; s++) playStep(mix, S, s, 0.05 + s * sd, false);
  return c.startRendering();
}

function download(data: ArrayBuffer, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type: 'audio/wav' }));
  const a = document.createElement('a');
  a.href = url; a.download = name.replace(/[\\/:*?"<>|]+/g, '-') + '.wav';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function exportWav(solo?: string) {
  const st = useStore.getState(), S = projectOf(st);
  const name = solo ? `${S.name} - ${S.tracks.find(t => t.id === solo)?.name ?? 'piste'}` : S.name;
  st.toast('Export en cours…');
  try {
    const buf = await renderMix(S, solo);
    download(encodeWav([buf.getChannelData(0), buf.getChannelData(1)], buf.sampleRate), name);
    useStore.getState().toast('Export terminé : ' + name + '.wav');
  } catch (e) {
    console.error(e);
    useStore.getState().toast('L\'export a échoué');
  }
}
