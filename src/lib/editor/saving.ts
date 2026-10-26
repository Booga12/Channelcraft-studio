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

/** Every 20 s: keep unsaved edits in a recovery file, and save if autosave is on and due. */
export function startAutosave(this: Editor) {
  clearInterval(this.autosaveTimer);
  this.autosaveTimer = setInterval(() => {
    const p = this.project;
    if (!p || this.busy) return;
    const dirty = p.dirtyFiles;
    if (!dirty.length) return;
    if (prefs.v.autosaveMinutes > 0 && Date.now() - this.lastSave > prefs.v.autosaveMinutes * 60_000) {
      this.save();
      return;
    }
    if (prefs.v.keepRecovery) {
      const data = JSON.stringify({ dir: p.dir, time: Date.now(), files: dirty.map((f) => ({ rel: f.rel, src: f.src, base: f.savedSrc.length })) });
      api.saveRecovery(this.recoveryKey(p.dir), data).catch(() => {});
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
  const when = new Date(data.time).toLocaleString();
  const restore = await ask(`ChannelCraft kept unsaved changes to ${data.files.length} file(s) of this theme from ${when}. Restore them?`, {
    title: 'Restore unsaved changes',
    kind: 'info',
    okLabel: 'Restore',
    cancelLabel: 'Discard them',
  });
  if (restore) {
    for (const f of data.files) {
      const file = project.files.get(pathKey(join(project.dir, f.rel)));
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
    api.clearRecovery(this.recoveryKey(p.dir)).catch(() => {});
    this.notify(`Saved ${dirty.length} file${dirty.length === 1 ? '' : 's'}${backup ? ' (backup made first)' : ''}`);
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

/** Captures the current screen as the theme's preview.png (shown in RetroBat and here). */
export async function makePreviewImage(this: Editor) {
  const p = this.project;
  const stage = document.querySelector<HTMLElement>('.stage');
  if (!p || !stage) return;
  try {
    const { toPng } = await import('html-to-image');
    const { width, height } = screenSize(this.settings);
    const keep = this.selection;
    this.selection = [];
    await new Promise((r) => setTimeout(r, 50));
    const url = await toPng(stage, { width, height, pixelRatio: 1, style: { transform: 'none' }, filter: (n) => !(n instanceof HTMLElement && n.classList.contains('overlay')) });
    this.selection = keep;
    await api.writeBinary(join(p.dir, 'preview.png'), url.split(',')[1]);
    p.setAssets(await api.listThemeFiles(p.dir));
    await this.refreshThemes();
    this.notify('Saved preview.png from this screen');
  } catch (e) {
    this.notify(`Couldn't capture the screen: ${e}`, 'error');
  }
}
