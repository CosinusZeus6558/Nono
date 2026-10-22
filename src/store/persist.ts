// Sauvegarde locale (IndexedDB du navigateur) : projets en JSON, prises en PCM brut.
import { del, get, set } from 'idb-keyval';
import { addTake, mixdown } from '../audio/takes';
import { newProject, projectOf, useStore } from './project';
import type { Project } from './types';

export interface ProjectMeta { id: string; name: string; updatedAt: number }

const K = {
  index: 'nono:index', last: 'nono:last',
  project: (id: string) => 'nono:project:' + id,
  take: (id: string) => 'nono:take:' + id,
};

export const listProjects = async () => ((await get<ProjectMeta[]>(K.index)) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);

export async function saveProject(p: Project) {
  await set(K.project(p.id), p);
  const idx = (await get<ProjectMeta[]>(K.index)) ?? [];
  const meta = { id: p.id, name: p.name, updatedAt: Date.now() };
  await set(K.index, [meta, ...idx.filter(m => m.id !== p.id)]);
  await set(K.last, p.id);
}

interface StoredTake { pcm?: Float32Array; sr: number; channels?: Float32Array[] }

/** Un fichier stéréo n'est stocké qu'une fois (ses canaux) ; le mono est recalculé au chargement. */
export const saveTake = (id: string, pcm: Float32Array, sr: number, channels?: Float32Array[]) =>
  set(K.take(id), channels ? { sr, channels } : { pcm, sr });

async function loadTakes(p: Project) {
  await Promise.all(p.tracks.filter(t => t.takeId).map(async t => {
    const tk = await get<StoredTake>(K.take(t.takeId!));
    if (tk?.channels) addTake(t.takeId!, mixdown(tk.channels), tk.sr, tk.channels);
    else if (tk?.pcm) addTake(t.takeId!, tk.pcm, tk.sr);
  }));
}

export async function openProject(id: string) {
  const p = await get<Project>(K.project(id));
  if (!p) return false;
  await loadTakes(p);
  useStore.getState().setProject({ ...newProject(), ...p });
  await set(K.last, id);
  return true;
}

export async function deleteProject(id: string) {
  const p = await get<Project>(K.project(id));
  if (p) await Promise.all(p.tracks.filter(t => t.takeId).map(t => del(K.take(t.takeId!))));
  await del(K.project(id));
  const idx = (await get<ProjectMeta[]>(K.index)) ?? [];
  await set(K.index, idx.filter(m => m.id !== id));
}

export const deleteTake = (id: string) => del(K.take(id));

let timer: ReturnType<typeof setTimeout> | undefined;

/** Recharge le dernier projet puis sauvegarde automatiquement à chaque modification. */
export async function initPersistence() {
  try {
    navigator.storage?.persist?.();
    const last = await get<string>(K.last);
    if (!last || !(await openProject(last))) await saveProject(projectOf(useStore.getState()));
  } catch (e) {
    console.warn('Sauvegarde locale indisponible', e);
    return;
  }
  let prev = projectOf(useStore.getState());
  useStore.subscribe(s => {
    const cur = projectOf(s);
    if ((Object.keys(cur) as (keyof Project)[]).every(k => cur[k] === prev[k])) return;
    prev = cur;
    clearTimeout(timer);
    timer = setTimeout(() => saveProject(cur).catch(e => console.warn(e)), 600);
  });
}
