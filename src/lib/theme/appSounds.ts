// The app's own songs and scroll sounds as assets: shown in Assets ("Made by the app") and in the
// sound pickers next to your own files. They aren't files yet, so each has a made-up path
// (ccs-sound:music/lofi.wav) that is turned into a .wav in the theme when it is used.

import { MUSIC, MUSIC_DIR, SCROLL_SOUNDS, SOUND_DIR, wavBytes, type SoundPreset } from './sounds';

const PREFIX = 'ccs-sound:';

export interface AppSound {
  /** Its made-up path, used like a file path (dragging, picking). */
  path: string;
  group: 'music' | 'scroll';
  preset: SoundPreset;
  /** The theme folder it is written into. */
  dir: string;
}

export const APP_SOUNDS: AppSound[] = [
  ...MUSIC.map((preset) => ({ path: `${PREFIX}music/${preset.id}.wav`, group: 'music' as const, preset, dir: MUSIC_DIR })),
  ...SCROLL_SOUNDS.map((preset) => ({ path: `${PREFIX}scroll/${preset.id}.wav`, group: 'scroll' as const, preset, dir: SOUND_DIR })),
];

/** The app's own sound a path stands for, if it is one. */
export function appSound(path: string): AppSound | null {
  if (!path.startsWith(PREFIX)) return null;
  return APP_SOUNDS.find((s) => s.path === path) ?? null;
}

const urls = new Map<string, string>();

/** A URL to listen to one of the app's sounds (made the first time it is asked for). */
export function appSoundUrl(s: AppSound): string {
  let u = urls.get(s.path);
  if (!u) urls.set(s.path, (u = URL.createObjectURL(new Blob([wavBytes(s.preset.make()) as BlobPart], { type: 'audio/wav' }))));
  return u;
}
