// Sounds and music: the theme's menu music (RetroBat's "bgsound" on the system screen, which
// plays on every screen) and the scroll sound of the console carousel, grids and game lists.
// Part of the editor (editor.svelte.ts): each function is a method of the editor (`this`),
// attached to it there, so callers use ed.<name>(...).

import type { Editor } from '../editor.svelte';
import { ask } from '@tauri-apps/plugin-dialog';
import { api } from '../api';
import { basename, join } from '../path';
import { addElementChange, addPropChange, insertTarget, setTextChange, type Change } from '../theme/edits';
import { resolveAsset, type PropDef, type ResolvedElement } from '../theme/resolver';
import type { ThemeProject, ThemeFile } from '../theme/project';
import { MUSIC, MUSIC_DIR, SCROLL_SOUNDS, SCROLL_TYPES, SOUND_DIR, toBase64, wavBytes, type SoundPreset } from '../theme/sounds';
import { patchRemoveNode } from '../xml/cst';
import { appSound } from '../theme/appSounds';

/** What the theme plays: a song or sound of the app's own (by id), a file of its own, or nothing. */
export interface SoundChoice {
  /** The value in the theme, e.g. ./_inc/ccs/music/lofi.wav. */
  path: string;
  /** The app's own sound it is, if it is one. */
  preset: string | null;
  /** The file on disk, to listen to it here. */
  abs: string | null;
  label: string;
}

const presetOf = (raw: string, dir: string, list: { id: string }[]) => {
  const m = raw.replace(/\\/g, '/').match(new RegExp(`${dir}/([\\w-]+)\\.wav$`, 'i'));
  return m && list.some((s) => s.id === m[1]) ? m[1] : null;
};

function choiceOf(this: Editor, d: PropDef | undefined, dir: string, list: { id: string; label: string }[]): SoundChoice | null {
  const p = this.project;
  const res = this.themeRes ?? this.res;
  const raw = d?.value.trim();
  if (!p || !res || !d || !raw) return null;
  const preset = presetOf(raw, dir, list);
  return { path: raw, preset, abs: resolveAsset(d, res, p, this.env), label: preset ? list.find((s) => s.id === preset)!.label : basename(raw) };
}

/** The theme's menu music, if it has some. */
export function themeMusic(this: Editor): SoundChoice | null {
  void this.rev;
  const el = (this.themeRes ?? this.res)?.views.get('system')?.elements.get('bgsound');
  return this.choiceOf(el?.props.get('path'), MUSIC_DIR, MUSIC);
}

/** Every carousel, grid and list that can have a scroll sound, on each screen. */
function scrollParts(this: Editor) {
  const res = this.themeRes ?? this.res;
  const out: { view: string; el: ResolvedElement }[] = [];
  if (!res) return out;
  for (const view of this.viewNames) {
    if (!['system', 'basic', 'detailed', 'video', 'grid', 'gamecarousel'].includes(view)) continue;
    for (const el of res.views.get(view)?.elements.values() ?? []) {
      if (!SCROLL_TYPES.has(el.type) || el.name.includes('.')) continue;
      const vis = el.props.get('visible')?.value.trim();
      if (vis === 'false' || vis === '0') continue;
      out.push({ view, el });
    }
  }
  return out;
}

/** The scroll sound most of the theme's carousels and lists use, if any. */
export function themeScrollSound(this: Editor): SoundChoice | null {
  void this.rev;
  const withSound = this.scrollParts().map(({ el }) => el.props.get('scrollSound')).filter((d) => d?.value.trim());
  return this.choiceOf(withSound[0], SOUND_DIR, SCROLL_SOUNDS);
}

/** Writes one of the app's own sounds into the theme (once); its path for the theme. */
async function writeSound(this: Editor, dir: string, id: string, make: () => Float32Array): Promise<string | null> {
  const p = this.project;
  if (!p) return null;
  const rel = `${dir}/${id}.wav`;
  if (!p.assets.some((a) => a.rel.toLowerCase() === rel.toLowerCase())) {
    await this.ensureBackup();
    try {
      await api.writeBinary(join(p.dir, rel), toBase64(wavBytes(make())));
    } catch (e) {
      this.notify(`Couldn't write the sound into the theme: ${e}`, 'error');
      return null;
    }
    p.setAssets([...p.assets, { rel, kind: 'sound', size: 0 }]);
  }
  return `./${rel}`;
}

/** Copies a song or sound file into the theme; its path for the theme. */
async function copySound(this: Editor, dir: string, file: string): Promise<string | null> {
  const p = this.project;
  if (!p) return null;
  await this.ensureBackup();
  try {
    const rel = await api.copySoundIntoTheme(p.dir, file, dir);
    if (!p.assets.some((a) => a.rel === rel)) p.setAssets([...p.assets, { rel, kind: 'sound', size: 0 }]);
    return `./${rel}`;
  } catch (e) {
    this.notify(String(e), 'error');
    return null;
  }
}

/**
 * The theme path for a sound choice: one of the app's own (by id, or by its made-up path from
 * Assets) is written into the theme, a file is copied in. Null when that failed.
 */
async function soundPath(this: Editor, choice: { preset: string } | { file: string }, dir: string, list: SoundPreset[]): Promise<string | null> {
  if ('preset' in choice) {
    const s = list.find((x) => x.id === choice.preset);
    return s ? this.writeSound(dir, s.id, s.make) : null;
  }
  // Written into this slot's folder, so a song used as a scroll sound sits with the sounds.
  const own = appSound(choice.file);
  if (own) return this.writeSound(dir, own.preset.id, own.preset.make);
  return this.copySound(dir, choice.file);
}

/** Whether a file is one of this theme's own (not RetroBat's or another theme's). */
const own = (p: ThemeProject, f: ThemeFile) => p.files.get(f.key) === f;

/** Removes the definitions of a property that are in this theme's own files. */
function removeDefs(defs: PropDef[] | undefined): Change[] {
  return (defs ?? []).filter((d) => d.node.parent).map((d) => ({ file: d.file, patch: patchRemoveNode(d.file.doc, d.node) }));
}

/**
 * Sets the theme's menu music: one of the app's own songs (by id), a file you chose, or none.
 * One undo step. RetroBat plays it on every screen. Returns whether the theme changed.
 */
export async function setMusic(this: Editor, choice: { preset: string } | { file: string } | null): Promise<boolean> {
  const p = this.project;
  if (!p || this.sharedOnly('Music')) return false;
  const path = choice ? await this.soundPath(choice, MUSIC_DIR, MUSIC) : null;
  if (choice && !path) return false;
  const res = this.themeRes ?? this.res;
  if (!res || this.project !== p) return false;
  const el = res.views.get('system')?.elements.get('bgsound');
  const defs = el?.history.get('path')?.filter((d) => own(p, d.file));
  let changes: Change[];
  if (!path) changes = removeDefs(defs);
  else if (defs?.length) changes = [setTextChange(defs[defs.length - 1].file, defs[defs.length - 1].node, path)];
  else {
    const target = el ? insertTarget(el, 'system') : null;
    changes = [target ? addPropChange(target, 'path', path) : addElementChange(p, res, 'system', 'sound', 'bgsound', `<path>${path}</path>`, false)];
  }
  if (!changes.length) return false;
  this.commit(path ? 'menu music' : 'no menu music', changes);
  const presetId = choice && ('preset' in choice ? choice.preset : appSound(choice.file)?.preset.id);
  const preset = MUSIC.find((x) => x.id === presetId);
  const name = preset ? `“${preset.label}”` : path ? `“${basename(path)}”` : '';
  this.notify(path ? `Menu music set to ${name}. Save, then Try in RetroBat to hear it.` : 'The theme has no menu music now; RetroBat plays its own music folder.', 'info', 5000, path && !this.retrobatMusicOn() ? { label: 'Turn music on in RetroBat', run: () => void this.enableRetrobatMusic() } : undefined);
  return true;
}

/**
 * Sets the scroll sound of every carousel, grid and game list: one of the app's own, a file, or
 * none. Returns whether the theme changed.
 */
export async function setScrollSound(this: Editor, choice: { preset: string } | { file: string } | null): Promise<boolean> {
  const p = this.project;
  if (!p || this.sharedOnly('Sounds')) return false;
  const path = choice ? await this.soundPath(choice, SOUND_DIR, SCROLL_SOUNDS) : null;
  if (choice && !path) return false;
  const res = this.themeRes ?? this.res;
  if (!res || this.project !== p) return false;
  const changes: Change[] = [];
  // A definition shared by several screens (or parts) is changed once.
  const done = new Set<object>();
  for (const { view, el } of this.scrollParts()) {
    const defs = el.history.get('scrollSound')?.filter((d) => own(p, d.file));
    if (!path) {
      for (const c of removeDefs(defs?.filter((d) => !done.has(d.node)))) changes.push(c);
      defs?.forEach((d) => done.add(d.node));
      continue;
    }
    const last = defs?.[defs.length - 1];
    if (last) {
      if (!done.has(last.node)) changes.push(setTextChange(last.file, last.node, path));
      done.add(last.node);
      continue;
    }
    const target = insertTarget(el, view);
    if (target && own(p, target.file)) {
      if (!done.has(target.node)) changes.push(addPropChange(target, 'scrollSound', path));
      done.add(target.node);
    } else changes.push(addElementChange(p, res, view, el.type, el.name, `<scrollSound>${path}</scrollSound>`, false));
  }
  if (!changes.length) {
    this.notify(path ? 'This theme has no carousel or list to give a scroll sound.' : 'There was no scroll sound to remove.');
    return false;
  }
  this.commit(path ? 'scroll sound' : 'no scroll sound', changes);
  this.notify(path ? 'Scroll sound set for the console carousel and the game lists. Save to keep it.' : 'Scroll sounds removed: RetroBat uses its own.');
  return true;
}

/** Whether RetroBat plays menu music and lets the theme choose it. */
export function retrobatMusicOn(this: Editor): boolean {
  const es = this.root?.es;
  return !es || (es.music && es.themeMusic);
}

/** Turns RetroBat's menu music on, and lets themes choose it (closing RetroBat first if needed). */
export async function enableRetrobatMusic(this: Editor) {
  try {
    if (await api.retrobatRunning()) {
      const ok = await ask('RetroBat is open. It has to close to change its music setting, or it puts the old one back. Close it now?', { title: 'Turn music on', kind: 'warning', okLabel: 'Close RetroBat', cancelLabel: 'Not now' });
      if (!ok) return;
      await api.closeRetrobat();
    }
    await api.enableThemeMusic();
    this.root = await api.rootStatus();
    this.notify('Menu music is on in RetroBat, and themes can choose it.');
  } catch (e) {
    this.notify(`Couldn't change RetroBat's music setting: ${e}`, 'error');
  }
}

export { choiceOf, scrollParts, writeSound, copySound, soundPath };
