// Import de fichiers audio : chaque fichier devient une piste audio, comme une prise micro.
import { saveTake } from '../store/persist';
import { uid, useStore } from '../store/project';
import { engine } from './engine';
import { addTake, mixdown, removeTake } from './takes';

export const AUDIO_ACCEPT = 'audio/*,.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.webm';
const MAX_SEC = 600;
const isAudio = (f: File) => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|oga|opus|m4a|aac|flac|webm)$/i.test(f.name);

/** Importe les fichiers à la mesure de la tête de lecture. Renvoie l'id de la dernière piste créée. */
export async function importFiles(list: FileList | File[]): Promise<string | undefined> {
  const files = Array.from(list), audio = files.filter(isAudio), toast = (m: string) => useStore.getState().toast(m);
  if (!audio.length) { toast(files.length ? 'Ce n\'est pas un fichier audio' : 'Aucun fichier sélectionné'); return; }
  const c = engine.ensure();
  let last: string | undefined, ok = 0;
  for (const f of audio) {
    const name = f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Import';
    toast(`Import de « ${name} »…`);
    let buf: AudioBuffer;
    try {
      buf = await c.decodeAudioData(await f.arrayBuffer());
    } catch {
      toast(`Format illisible par ce navigateur : ${f.name} (essayez MP3 ou WAV)`);
      continue;
    }
    if (buf.duration > MAX_SEC) { toast(`« ${name} » dépasse 10 minutes : import refusé`); continue; }
    if (buf.duration < 0.05) { toast(`« ${name} » est vide`); continue; }
    const channels = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, i) => buf.getChannelData(i).slice());
    const stereo = channels.length > 1 ? channels : undefined;
    const takeId = uid('take'), id = uid('rec'), S = useStore.getState();
    addTake(takeId, mixdown(channels), buf.sampleRate, stereo);
    try {
      await saveTake(takeId, channels[0], buf.sampleRate, stereo);
    } catch {
      removeTake(takeId);
      toast('Plus assez de place pour sauvegarder ce fichier dans le navigateur');
      continue;
    }
    S.set({
      tracks: [...useStore.getState().tracks, {
        id, name, kind: 'rec', source: 'file', hue: 150, vol: 85, pan: 0, mute: false,
        takeId, startStep: Math.floor(S.step / 16) * 16, offsetMs: 0, tune: 'none', retune: 70, fx: 'none',
      }],
      sel: id,
    });
    last = id; ok++;
  }
  if (ok) {
    engine.refresh();
    toast(ok === 1 ? 'Piste importée' : `${ok} pistes importées`);
  }
  return last;
}
