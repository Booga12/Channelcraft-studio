// Saving, backups, recovering unsaved edits, exporting, and handing the theme to RetroBat.
// Part of the editor (editor.svelte.ts): each function is a method of the editor (`this`),
// attached to it there, so callers use ed.<name>(...).

import type { Editor } from '../editor.svelte';
import { type ThemeFile, ThemeProject } from '../theme/project';
import { api } from '../api';
import { ask, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { join, pathKey } from '../path';
import { prefs } from '../prefs.svelte';
import { screenSize } from '../theme/context';
import { themeFontCss } from '../preview.svelte';

/** Makes a backup zip of the open theme once per session, before anything is written to it. */
export async function ensureBackup(this: Editor) {
  const p = this.project;
  if (!p || this.backedUp.has(p.dir)) return;
  try {
    await api.backupTheme(p.dir, prefs.v.backupsKeep, 'before saving');
    this.backedUp.add(p.dir);
  } catch {
    // Browser preview or no access: nothing gets written anyway.
  }
}

export function recoveryKey(this: Editor, dir: string) {
  return dir.replace(/[^A-Za-z0-9]+/g, '_').slice(-120);
}

/** Recovery files written in this session (by key), so one can be cleared when it's no longer needed. */
const keptRecovery = new Set<string>();

/**
 * The kept files that still differ from the theme as it is now (`current` gives a file's text by
 * its relative path, or undefined when the file is gone). Undoing back to the saved theme leaves
 * nothing to restore (#43).
 */
export function changedSinceKept<F extends { rel: string; src: string }>(files: F[], current: (rel: string) => string | undefined): F[] {
  return files.filter((f) => {
    const now = current(f.rel);
    return now !== undefined && now !== f.src;
  });
}

/** Undone (or redone) back to the saved theme: the kept copy would only bring the undone edits back. */
export function forgetRecoveryIfClean(this: Editor) {
  const p = this.project;
  if (!p || p.dirtyFiles.length) return;
  const key = this.recoveryKey(p.dir);
  if (keptRecovery.delete(key)) api.clearRecovery(key).catch(() => {});
}

/** Every 20 s: keep unsaved edits in a recovery file, and save if autosave is on and due. */
export function startAutosave(this: Editor) {
  clearInterval(this.autosaveTimer);
  this.autosaveTimer = setInterval(() => {
    const p = this.project;
    if (!p || this.busy) return;
    const dirty = p.dirtyFiles;
    if (!dirty.length) return this.forgetRecoveryIfClean();
    if (prefs.v.autosaveMinutes > 0 && Date.now() - this.lastSave > prefs.v.autosaveMinutes * 60_000) {
      this.save();
      return;
    }
    if (prefs.v.keepRecovery) {
      const data = JSON.stringify({ dir: p.dir, time: Date.now(), files: dirty.map((f) => ({ rel: f.rel, src: f.src, base: f.savedSrc.length })) });
      api.saveRecovery(this.recoveryKey(p.dir), data).catch(() => {});
      keptRecovery.add(this.recoveryKey(p.dir));
    }
  }, 20_000);
}

/** Offers back unsaved edits kept from a session that ended without saving. */
export async function offerRecovery(this: Editor, project: ThemeProject) {
  let raw: string | null = null;
  try {
    raw = await api.loadRecovery(this.recoveryKey(project.dir));
  } catch {
    return;
  }
  if (!raw) return;
  const data = JSON.parse(raw) as { time: number; files: { rel: string; src: string }[] };
  const fileOf = (rel: string) => project.files.get(pathKey(join(project.dir, rel)));
  const files = changedSinceKept(data.files, (rel) => fileOf(rel)?.src);
  if (!files.length) {
    // Nothing kept differs from the theme as saved: no question.
    await api.clearRecovery(this.recoveryKey(project.dir)).catch(() => {});
    return;
  }
  const when = new Date(data.time).toLocaleString();
  const restore = await ask(`ChannelCraft kept unsaved changes to ${files.length} file${files.length === 1 ? '' : 's'} of this theme from ${when}. Restore them?`, {
    title: 'Restore unsaved changes',
    kind: 'info',
    okLabel: 'Restore',
    cancelLabel: 'Discard them',
  });
  if (restore) {
    for (const f of files) {
      const file = fileOf(f.rel);
      if (file) project.setSource(file, f.src);
    }
    this.rev++;
    this.notify('Unsaved changes restored. Save to keep them.');
  } else {
    await api.clearRecovery(this.recoveryKey(project.dir)).catch(() => {});
  }
}

export async function save(this: Editor) {
  const p = this.project;
  if (!p || this.busy) return;
  const dirty = p.dirtyFiles;
  if (!dirty.length) {
    this.notify('Nothing to save');
    return;
  }
  this.busy = true;
  try {
    let backup = '';
    if (!this.backedUp.has(p.dir)) {
      backup = await api.backupTheme(p.dir, prefs.v.backupsKeep, 'before saving');
      this.backedUp.add(p.dir);
    }
    // What is written is exactly what was there when Save was pressed; edits made while
    // saving stay unsaved.
    const sent = dirty.map((f) => ({ file: f, src: f.src }));
    // A file ChannelCraft made and then undid is empty now: it is deleted, never saved empty
    // (RetroBat can't read a theme that includes an empty file).
    const gone = (file: ThemeFile, src: string) => file !== p.entry && !src.trim();
    const files = sent.map(({ file, src }) => ({ rel: file.rel, text: src, bom: file.bom, remove: gone(file, src) }));
    try {
      await api.saveFiles(p.dir, files, false);
    } catch (e) {
      const msg = String(e);
      if (!msg.startsWith('CHANGED_OUTSIDE:')) throw e;
      const changed = JSON.parse(msg.slice('CHANGED_OUTSIDE:'.length)) as string[];
      const overwrite = await ask(
        `Another program changed ${changed.length === 1 ? 'this file' : 'these files'} since ChannelCraft read ${changed.length === 1 ? 'it' : 'them'}: ${changed.join(', ')}.\n\nSaving now replaces those changes with yours. (A backup of the theme was made when you first saved this session.)`,
        { title: 'Files changed outside ChannelCraft', kind: 'warning', okLabel: 'Save mine anyway', cancelLabel: 'Don’t save' },
      );
      if (!overwrite) {
        this.notify('Not saved. To see the other changes, use File → Reload from disk (your unsaved edits would be lost).');
        return;
      }
      await api.saveFiles(p.dir, files, true);
    }
    for (const { file, src } of sent) {
      file.savedSrc = src;
      file.dirty = file.src !== src;
    }
    this.rev++;
    this.lastSave = Date.now();
    keptRecovery.delete(this.recoveryKey(p.dir));
    api.clearRecovery(this.recoveryKey(p.dir)).catch(() => {});
    const saved = `Saved ${dirty.length} file${dirty.length === 1 ? '' : 's'}${backup ? ' (backup made first)' : ''}`;
    const issues = this.healthIssues.length;
    if (issues) this.notify(`${saved}. The health check found ${issues} thing${issues === 1 ? '' : 's'} worth a look.`, 'info', 6000, { label: 'Check', run: () => (this.showHealth = true) });
    else this.notify(saved);
  } catch (e) {
    this.notify(`Save failed: ${e}`, 'error');
  } finally {
    this.busy = false;
  }
}

export async function setActive(this: Editor) {
  const p = this.project;
  if (!p) return;
  try {
    await api.setActiveTheme(p.name);
    await this.refreshThemes();
    this.notify(`${p.name} is now RetroBat's theme`);
  } catch (e) {
    this.notify(String(e), 'error');
  }
}

export async function launch(this: Editor) {
  try {
    await api.launchRetrobat();
    this.notify('Starting RetroBat…');
  } catch (e) {
    this.notify(String(e), 'error');
  }
}

/**
 * Try it on the TV: saves, makes this RetroBat's theme and starts RetroBat. RetroBat writes its
 * settings back when it closes, so if it's open it is closed first (after asking), or it would
 * put its old theme back.
 */
export async function tryInRetroBat(this: Editor) {
  const p = this.project;
  if (!p || this.busy) return;
  if (this.dirtyCount) {
    await this.save();
    if (this.dirtyCount) return; // Save failed or was cancelled; it said why.
  }
  try {
    if (await api.retrobatRunning()) {
      const go = await ask('RetroBat is open. To show this theme it has to restart. Close RetroBat and open it again with this theme?', {
        title: 'Try it in RetroBat',
        kind: 'info',
        okLabel: 'Restart RetroBat',
        cancelLabel: 'Not now',
      });
      if (!go) return;
      this.notify('Closing RetroBat…', 'info', 20000);
      await api.closeRetrobat();
    }
    await api.setActiveTheme(p.name);
    await this.refreshThemes();
    await api.launchRetrobat();
    this.notify(`Starting RetroBat with ${p.name}…`);
  } catch (e) {
    this.notify(String(e), 'error');
  }
}

/** Saves the theme as a zip, ready to share or copy to another RetroBat. */
export async function exportZip(this: Editor) {
  const p = this.project;
  if (!p) return;
  const dest = await saveDialog({ title: 'Export theme', defaultPath: `${p.name}.zip`, filters: [{ name: 'Zip', extensions: ['zip'] }] });
  if (!dest) return;
  try {
    if (this.dirtyCount) await this.save();
    this.notify(`Exporting “${p.name}”… With many pictures this can take a little while.`, 'info', 600000);
    await api.exportTheme(p.dir, dest);
    this.notify(`Exported to ${dest}. To install it, unzip it into RetroBat's themes folder.`);
  } catch (e) {
    this.notify(`Export failed: ${e}`, 'error');
  }
}

/** Waits until the preview has drawn: its fonts and pictures loaded (at most `ms`). */
async function stageReady(stage: HTMLElement, ms = 4000) {
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await frame();
  const end = Date.now() + ms;
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, ms))]);
  while (Date.now() < end && [...stage.querySelectorAll('img')].some((i) => !i.complete)) await new Promise((r) => setTimeout(r, 100));
  await frame();
}

/**
 * Makes preview.png from the System menu, the screen RetroBat's theme list and the gallery show
 * (#31, #40), then goes back to the screen that was showing. Quiet: a failure is only a missing
 * picture.
 */
export async function makePreviewFromSystemMenu(this: Editor) {
  const back = { view: this.view, file: this.screenFile };
  const keep = this.selection;
  const moved = this.viewNames.includes('system') && (back.view !== 'system' || back.file !== 'theme.xml');
  if (moved) this.showScreen({ view: 'system', file: 'theme.xml' });
  // Not if the user moved to another screen meanwhile (Share doesn't block the window).
  await this.makePreviewImage(true, () => !moved || (this.view === 'system' && this.screenFile === 'theme.xml'));
  if (moved && this.view === 'system' && this.screenFile === 'theme.xml') {
    this.showScreen(back);
    this.selection = keep;
  }
}

/**
 * Captures the current screen as the theme's preview.png (shown in RetroBat and here). `quiet`:
 * no message, and a failure is only a missing picture (used when a theme is made).
 */
export async function makePreviewImage(this: Editor, quiet = false, still: () => boolean = () => true) {
  const p = this.project;
  // No page to capture (the tests run the editor without one).
  if (typeof document === 'undefined') return;
  const stage = document.querySelector<HTMLElement>('.stage');
  if (!p || !stage) return;
  try {
    if (quiet) await stageReady(stage);
    const { toPng } = await import('html-to-image');
    const { width, height } = screenSize(this.settings);
    // Only the fonts this screen uses, inlined (#44), loaded first while the screen stays as it is.
    const used = new Set([...stage.querySelectorAll('*')].flatMap((n) => getComputedStyle(n).fontFamily.split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''))));
    const fontEmbedCSS = await themeFontCss((fam) => used.has(fam));
    if (!still()) return;
    await loadPictureFonts(fontEmbedCSS);
    if (!still()) return;
    const options = {
      width,
      height,
      pixelRatio: 1,
      // Text whose font still isn't ready shows in the next font, never left out (#46).
      fontEmbedCSS: fontEmbedCSS.replace(/@font-face \{/g, '@font-face { font-display: swap;'),
      style: { transform: 'none' },
      // A picture that can't be loaded (a missing console logo) is left blank, as on screen,
      // instead of failing the whole capture (#46).
      imagePlaceholder: BLANK_PNG,
      onImageErrorHandler: () => {},
      // It remembers pictures by address; without the part after "?" every file the dev server
      // sends (/__dev/file?path=…) would count as one picture on the next capture.
      includeQueryParams: true,
      filter: (n: Node) => !(n instanceof HTMLElement && (n.classList.contains('overlay') || n.classList.contains('behind'))) && copyable(n),
    };
    // Without the selection outline. It comes back after, unless something else was picked meanwhile.
    const keep = this.selection;
    this.selection = [];
    let url: string;
    try {
      await new Promise((r) => setTimeout(r, 50));
      if (!still()) return;
      url = await toPng(stage, options);
    } finally {
      if (!this.selection.length) this.selection = keep;
    }
    await api.writeBinary(join(p.dir, 'preview.png'), url.split(',')[1]);
    p.setAssets(await api.listThemeFiles(p.dir));
    this.rev++;
    await this.refreshThemes();
    if (!quiet) this.notify('Saved preview.png from this screen');
  } catch (e) {
    if (!quiet) this.notify(`Couldn't capture the screen: ${e instanceof Event ? 'a picture or font on it couldn’t be read' : e}`, 'error');
  }
}

/**
 * Gets the fonts of a picture loaded before it's drawn. A picture is drawn once, while a big font
 * (RetroBat's spare fonts are 5 MB) is still loading inside it, which leaves that text out. So a
 * small picture with a line in each font is drawn until every line shows, at most `ms`; the
 * browser keeps the fonts for the real one (#46).
 */
async function loadPictureFonts(css: string, ms = 5000) {
  const families = [...css.matchAll(/font-family: '([^']+)'/g)].map((m) => m[1]);
  if (!families.length) return;
  const W = 64;
  const H = 24;
  const style = css.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lines = families.map((f, i) => `<div style="position:absolute;left:0;top:${i * H}px;font:20px &quot;${f}&quot;;color:#000">AW</div>`).join('');
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = families.length * H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const end = Date.now() + ms;
  for (let n = 0; Date.now() < end; n++) {
    // A new picture each time (the comment makes it new): each is only drawn once.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${canvas.height}"><!--${n}--><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="background:#fff;width:${W}px;height:100%"><style>${style}</style>${lines}</div></foreignObject></svg>`;
    const src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, canvas.height);
      ctx.drawImage(img, 0, 0);
      // A line shows once its font has loaded (or failed, so the next font is used).
      if (families.every((_, i) => ctx.getImageData(0, i * H, W, H).data.some((v, k) => k % 4 === 0 && v < 128))) return;
    } catch {
      return; // Can't tell: the capture goes ahead, and text shows in the next font at worst.
    } finally {
      URL.revokeObjectURL(src);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Whether a video or canvas can be copied into a picture. One the browser won't let the app read
 * (from a source that didn't allow it) would stop the whole capture, so it's left out (#46).
 */
function copyable(n: Node): boolean {
  // A picture that didn't load shows nothing on screen. Leaving it out also stops the capture
  // remembering it as blank after the file is added (#46).
  if (n instanceof HTMLImageElement) return !(n.complete && n.naturalWidth === 0);
  if (!(n instanceof HTMLVideoElement || n instanceof HTMLCanvasElement)) return true;
  // A video with no size on screen would be copied as an empty picture, which fails the capture.
  if (n instanceof HTMLVideoElement && (!n.clientWidth || !n.clientHeight)) return false;
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx?.drawImage(n, 0, 0, 1, 1);
    ctx?.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

/** A see-through 1×1 picture, drawn where a picture can't be loaded. */
const BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
