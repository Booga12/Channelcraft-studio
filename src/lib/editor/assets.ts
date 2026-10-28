// Pictures, videos, sounds and fonts: bringing them into a theme, the asset library, dropping and pasting.
// Part of the editor (editor.svelte.ts): each function is a method of the editor (`this`),
// attached to it there, so callers use ed.<name>(...).

import type { Editor } from '../editor.svelte';
import { addsAsNew, ASSET_KIND_LABEL, ASSET_THEME_DIR, type AssetKind, dropFit, dropPropLabel, kindOfFile, nameFromFile, newAssetBody, pastedFormat, pastedPath } from '../theme/assetDrop';
import { type ThemeFile, ThemeProject } from '../theme/project';
import { addElementChange, insertTarget, varRef } from '../theme/edits';
import { api } from '../api';
import { ask, open as openDialog } from '@tauri-apps/plugin-dialog';
import { basename, dirname, insideDir, join, relative } from '../path';
import { blobBase64 } from '../raster';
import { catalogFont } from '../theme/fonts';
import { elementLabel, propLabel } from '../friendly';
import { isDataBound } from '../theme/library';
import { zOf } from '../render';

export async function loadLibrary(this: Editor) {
  try {
    this.library = await api.listLibraryAssets();
  } catch (e) {
    this.notify(`Couldn't read the asset library: ${e}`, 'error');
  }
  this.libraryLoaded = true;
}

/** Copies files into the library (checked like imports, never over an existing file). */
export async function addToLibrary(this: Editor, paths: string[]) {
  if (!paths.length) return;
  try {
    const r = await api.addLibraryAssets(paths);
    await this.loadLibrary();
    const parts: string[] = [];
    if (r.added.length) parts.push(`Added ${r.added.length} file${r.added.length === 1 ? '' : 's'} to Assets`);
    if (r.existing.length) parts.push(`${r.existing.length} ${r.existing.length === 1 ? 'was' : 'were'} already there`);
    if (r.problems.length) parts.push(r.problems.slice(0, 3).join(' ') + (r.problems.length > 3 ? ` (and ${r.problems.length - 3} more)` : ''));
    this.notify(parts.join('. ') + '.', r.problems.length && !r.added.length ? 'error' : 'info');
  } catch (e) {
    this.notify(String(e), 'error');
  }
}

export async function removeFromLibrary(this: Editor, path: string) {
  try {
    await api.removeLibraryAsset(path);
    this.library = this.library.filter((a) => a.path !== path);
    this.notify(`${basename(path)} was moved to the Recycle Bin`);
  } catch (e) {
    this.notify(String(e), 'error');
  }
}

/**
 * Links a file (from the library or Explorer) to an element on this screen: copies it into the
 * theme's _inc folder (an identical file there is reused, a different one with the same name is
 * kept and this one gets "-2"), then sets the property like any other edit, so it can be undone.
 */
export async function linkAsset(this: Editor, src: string, kind: AssetKind, elementName: string, forcedProp?: string): Promise<boolean> {
  const p = this.project;
  const el = this.currentView?.elements.get(elementName);
  if (!p || !el) return false;
  const fit = dropFit(el.type, el.name, kind, forcedProp);
  if (!fit.ok) {
    this.notify(fit.hint, 'error');
    return false;
  }
  const def = el.props.get(fit.prop);
  const raw = def?.raw ?? '';
  // Game data or per-console paths would become one fixed file for every game and console.
  if (isDataBound(raw) || /\{random|\$\{(?!\w+\})/.test(raw)) {
    const yes = await ask(`${elementLabel(elementName)} now uses “${raw.trim()}”, which changes with each game or console. Use this one file everywhere instead?`, { title: 'Replace with one file?', kind: 'warning' });
    if (!yes) return false;
  }
  let abs: string | null;
  try {
    abs = await this.importAsset(src, kind);
  } catch (e) {
    this.notify(String(e), 'error');
    return false;
  }
  if (!abs || this.project !== p || !this.currentView?.elements.has(elementName)) return false;
  // A path held by a single ${variable} is written relative to the variable's file, like typing it.
  const now = this.currentView.elements.get(elementName)!.props.get(fit.prop);
  const v = now ? varRef(now.raw) : null;
  const varDef = v && !this.gameEditing ? this.res?.vars.get(v) : undefined;
  const rel = varDef ? relative(dirname(varDef.file.abs), abs) : this.relativeAssetPath(elementName, fit.prop, abs);
  this.setProp(elementName, fit.prop, rel);
  this.selected = elementName;
  const renamed = basename(abs).toLowerCase() !== basename(src).toLowerCase();
  const what = dropPropLabel(fit.prop, kind, propLabel);
  this.notify(
    `${what[0].toUpperCase()}${what.slice(1)} of ${elementLabel(elementName)} is now ${basename(abs)}${fit.note ? ` (${fit.note})` : ''}.` +
      (renamed ? ` The theme already had a different ${basename(src)}, so this one was copied as ${basename(abs)}.` : '') +
      ' Save to keep it, or Ctrl+Z to undo.',
  );
  return true;
}

/**
 * Adds pictures and videos as new elements on this screen, centred on `at` (0–1 of the screen,
 * else the middle) and stepped a little apart, above everything else. Each file is copied into
 * the theme first. All of it is one undo step. Returns the new element names.
 */
export async function addAssets(this: Editor, files: { path: string; kind: AssetKind }[], at?: { x: number; y: number }, placed?: string[]): Promise<string[]> {
  const p = this.project;
  const res = this.res;
  if (!p || !res || !this.currentView) return [];
  const usable = files.filter((f): f is { path: string; kind: 'image' | 'video' } => addsAsNew(f.kind));
  const skipped = files.length - usable.length;
  if (!usable.length) {
    if (skipped) this.notify('Sounds and fonts go on an element: drag them onto text, a game list or a sound in Layers.', 'error');
    return [];
  }
  const view = this.view;
  const copied: { kind: 'image' | 'video'; abs: string; src: string }[] = [];
  for (const f of usable) {
    try {
      const abs = await this.importAsset(f.path, f.kind);
      if (abs) copied.push({ kind: f.kind, abs, src: f.path });
    } catch (e) {
      this.notify(String(e), 'error');
    }
  }
  const names = this.placeNewAssets(p, view, copied, at, skipped);
  // `placed` gets the source files that really became layers (all copied ones, or none).
  if (names.length) placed?.push(...copied.map((c) => c.src));
  return names;
}

/** Adds files already in the theme as new layers on `view`, centred on `at`. One undo step. */
export function placeNewAssets(this: Editor, p: ThemeProject, view: string, copied: { kind: 'image' | 'video'; abs: string; src: string }[], at?: { x: number; y: number }, skipped = 0): string[] {
  // The theme or screen may have changed while files were copied.
  if (!copied.length || this.project !== p || this.view !== view || !this.res || !this.currentView) return [];
  const gameFile = this.gameEditing ? this.gameFilePath() : null;
  const holder = gameFile ?? p.entry?.abs ?? p.dir;
  const top = Math.max(0, ...[...this.currentView.elements.values()].map(zOf).filter(Number.isFinite));
  const used = new Set(this.currentView.elements.keys());
  const centre = at ?? { x: 0.5, y: 0.5 };
  const added: { name: string; type: string; body: string }[] = [];
  copied.forEach((c, i) => {
    const base = nameFromFile(c.src, c.kind);
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base}${n}`;
    used.add(name);
    const rel = relative(dirname(holder), c.abs);
    added.push({ name, type: c.kind, body: newAssetBody(c.kind, rel, { x: centre.x + i * 0.04, y: centre.y + i * 0.04 }, Math.floor(top) + 1 + i) });
  });
  const label = added.length === 1 ? `adding ${ASSET_KIND_LABEL[added[0].type as AssetKind]} ${elementLabel(added[0].name)}` : `adding ${added.length} files`;
  if (this.gameEditing) {
    if (!this.gameSet(label, added.map((a) => ({ name: a.name, type: a.type, props: {}, extra: true, body: a.body })))) return [];
  } else {
    this.commit(label, added.map((a) => addElementChange(p, this.res!, view, a.type, a.name, a.body)));
  }
  const names = added.map((a) => a.name);
  this.selection = names;
  this.notify(
    (names.length === 1 ? `Added ${elementLabel(names[0])}.` : `Added ${names.length} new layers.`) +
      ' Drag to move it, pull a corner to resize, or Ctrl+Z to undo.' +
      (skipped ? ` ${skipped} sound or font file${skipped === 1 ? ' was' : 's were'} left out: drop those on an element instead.` : ''),
  );
  return names;
}

/**
 * Adds a picture from the clipboard (a screenshot, or a picture copied in a browser or
 * Explorer) as a new layer: saved into the theme's _inc/images, as PNG unless it is already a
 * PNG, JPEG or GIF.
 */
export async function pasteImage(this: Editor, file: File): Promise<string[]> {
  const p = this.project;
  const view = this.view;
  if (!p || !this.currentView) return [];
  if (file.size > 64 << 20) {
    this.notify('That picture is over 64 MB, too big for a theme. Make it smaller first.', 'error');
    return [];
  }
  if (file.type === 'image/svg+xml') {
    this.notify('Pasted SVG pictures aren’t supported. Save it as a file and drop it on the preview instead.', 'error');
    return [];
  }
  let data: string;
  const fmt = pastedFormat(file.type);
  try {
    // Decoding it first also checks that it really is a picture.
    const bitmap = await createImageBitmap(file);
    if (fmt.convert) {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
      data = canvas.toDataURL('image/png').split(',')[1];
    } else {
      data = await blobBase64(file);
    }
    bitmap.close();
  } catch {
    this.notify('The clipboard has something that isn’t a picture RetroBat can show.', 'error');
    return [];
  }
  const rel = pastedPath(file.name, fmt.ext, p.assets.map((a) => a.rel));
  const abs = join(p.dir, rel);
  try {
    await api.writeBinary(abs, data);
    p.setAssets(await api.listThemeFiles(p.dir));
    this.rev++;
  } catch (e) {
    this.notify(`Couldn't save the picture: ${e}`, 'error');
    return [];
  }
  return this.placeNewAssets(p, view, [{ kind: 'image', abs, src: rel }]);
}

/** Asks for pictures or videos and adds them to this screen. */
export async function pickAndAddAssets(this: Editor) {
  const picked = await openDialog({
    title: 'Add your own picture or video',
    multiple: true,
    filters: [{ name: 'Pictures and videos', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'mpg', 'mpeg'] }],
  });
  const paths = Array.isArray(picked) ? picked : typeof picked === 'string' ? [picked] : [];
  const files = paths.map((path) => ({ path, kind: kindOfFile(path) })).filter((f): f is { path: string; kind: AssetKind } => !!f.kind);
  if (files.length) await this.addAssets(files);
}

/** Downloads a catalogue font into the theme; returns its theme-relative path, or null. */
export async function ensureFont(this: Editor, id: string): Promise<string | null> {
  const p = this.project;
  const f = catalogFont(id);
  if (!p || !f) return null;
  const existing = p.assets.find((a) => a.rel.toLowerCase() === `_inc/fonts/${f.file}`.toLowerCase());
  if (existing) return existing.rel;
  try {
    const rel = await api.downloadFont(p.dir, f.url, f.file);
    p.setAssets([...p.assets, { rel, kind: 'font', size: 0 }]);
    return rel;
  } catch {
    return null;
  }
}

/** Downloads any Google Fonts family into the theme (with its licence); its theme-relative path. */
export async function ensureGoogleFont(this: Editor, family: string): Promise<string> {
  const p = this.project;
  if (!p) throw new Error('No theme is open');
  const f = await api.googleFontFile(family);
  const existing = p.assets.find((a) => a.rel.toLowerCase() === `_inc/fonts/${f.file_name}`.toLowerCase());
  if (existing) return existing.rel;
  const rel = await api.downloadFont(p.dir, f.url, f.file_name);
  p.setAssets([...p.assets, { rel, kind: 'font', size: 0 }]);
  return rel;
}

/** Path to store in a property for an asset, relative to the file that will hold it. */
export function relativeAssetPath(this: Editor, elementName: string, prop: string, abs: string): string {
  const gameFile = this.gameEditing ? this.gameFilePath() : null;
  if (gameFile) return relative(dirname(gameFile), abs);
  const el = this.currentView?.elements.get(elementName);
  const def = el?.props.get(prop);
  const holder: ThemeFile | undefined = def?.file ?? (el ? insertTarget(el, this.view)?.file : undefined) ?? this.project?.entry;
  return relative(dirname(holder?.abs ?? this.project!.dir), abs);
}

export async function importAsset(this: Editor, srcPath: string, kind: AssetKind): Promise<string | null> {
  const p = this.project;
  if (!p) return null;
  // A file already inside the theme (dragged from the Explorer's "This theme") is used where it is.
  if (insideDir(srcPath, p.dir)) return srcPath;
  const dir = ASSET_THEME_DIR[kind];
  const rel = await api.importAsset(p.dir, srcPath, dir);
  p.setAssets(await api.listThemeFiles(p.dir));
  this.rev++;
  return join(p.dir, rel);
}
