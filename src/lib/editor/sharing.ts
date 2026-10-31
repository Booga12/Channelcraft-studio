// Making a theme's look your own design, and sharing: designs as small .ccdesign files, and a
// whole theme as one .zip with its preview picture.
// Part of the editor (editor.svelte.ts): each function is a method of the editor (`this`),
// attached to it there, so callers use ed.<name>(...).

import type { Editor } from '../editor.svelte';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { api } from '../api';
import { basename } from '../path';
import { designGameLayout, GAME_VIEWS } from '../theme/designs';
import { BUILT_IN_DESIGNS } from '../theme/designCatalog';
import { designFileText, myDesigns, newDesignId, putMyDesign, readDesignFile, type SavedDesign } from '../theme/designList.svelte';
import { appliedDesign, appliedGameLayout, appliedSystemLayout } from '../theme/presets';
import { FONT_CATALOG } from '../theme/fonts';
import { GALLERY_SITE } from '../gallery';

/** The catalog font a part of the theme uses, by its file name. */
function fontOf(ed: Editor, view: string, names: string[]): string | undefined {
  const v = (ed.themeRes ?? ed.res)?.views.get(view);
  for (const n of names) {
    const file = basename(v?.elements.get(n)?.props.get('fontPath')?.value.trim() ?? '').toLowerCase();
    const f = file && FONT_CATALOG.find((x) => x.file.toLowerCase() === file);
    if (f) return f.id;
  }
  return undefined;
}

/**
 * The theme's look as a design you can keep: the design it was made from, with the colours,
 * depth, console screen layout, game list layout and fonts it has now. Null for a theme that
 * wasn't made from a design.
 */
export function lookAsDesign(this: Editor, label: string): SavedDesign | null {
  const p = this.project;
  if (!p) return null;
  const used = appliedDesign(p, 'detailed') ?? appliedDesign(p, 'system') ?? GAME_VIEWS.map((v) => appliedDesign(p, v)).find(Boolean) ?? null;
  if (!used) return null;
  // A design you saved before is made from a ready-made one: keep that as the base.
  const base = BUILT_IN_DESIGNS.find((d) => d.id === used.id) ?? BUILT_IN_DESIGNS.find((d) => d.id === myDesigns.list.find((s) => s.id === used.id)?.base);
  if (!base) return null;
  const listView = ['detailed', 'basic', 'video'].find((v) => appliedDesign(p, v)) ?? 'detailed';
  return {
    id: newDesignId(label),
    label: label.trim().slice(0, 40),
    base: base.id,
    palette: this.designColours() ?? { ...used.palette },
    depth: this.depth ?? used.depth,
    system: appliedSystemLayout(p) ?? used.system,
    gameLayout: appliedGameLayout(p, listView) ?? designGameLayout(used),
    font: fontOf(this, listView, ['gamelist', 'md_description', 'md_name']) ?? used.font,
    titleFont: fontOf(this, listView, ['ccs_title', 'md_name']) ?? fontOf(this, 'system', ['ccs_systemname']) ?? used.titleFont,
  };
}

/** Whether the theme's look can be saved as a design (it was made from one). */
export function canSaveDesign(this: Editor): boolean {
  void this.rev;
  return !!this.project && !!this.lookAsDesign('x');
}

/** Saves the theme's look as your own design, shown first in every design picker. */
export function saveAsMyDesign(this: Editor, label: string) {
  const s = this.lookAsDesign(label);
  if (!s) return void this.notify('Only themes made from a design can be saved as one. Pick a design in Presets first.', 'error');
  const d = putMyDesign(s);
  this.notify(`Saved “${d.label}” to My designs. Use it on any theme from Presets or New theme.`, 'info', 6000, { label: 'Share', run: () => this.shareMyDesign(d.id) });
}

/** Saves one of your designs as a .ccdesign file to send to someone. */
export async function shareMyDesign(this: Editor, id: string) {
  const s = myDesigns.list.find((d) => d.id === id);
  if (!s) return;
  const dest = await saveDialog({ title: 'Share design', defaultPath: `${s.label.replace(/[<>:"/\\|?*]+/g, '').trim() || 'design'}.ccdesign`, filters: [{ name: 'ChannelCraft design', extensions: ['ccdesign'] }] });
  if (!dest) return;
  try {
    await api.writeDesignFile(dest, designFileText(s));
    this.notify(`Saved ${basename(dest)}. Others add it with Presets → Import a design.`, 'info', 6000, { label: 'Show file', run: () => void revealItemInDir(dest) });
  } catch (e) {
    this.notify(`Couldn't save the design: ${e}`, 'error');
  }
}

/** Adds a design from a .ccdesign file to My designs. */
export async function importMyDesign(this: Editor) {
  const path = await openDialog({ title: 'Import a design', multiple: false, filters: [{ name: 'ChannelCraft design', extensions: ['ccdesign'] }] });
  if (typeof path !== 'string') return;
  try {
    const got = readDesignFile((await api.readText(path)).text);
    if (typeof got === 'string') return void this.notify(got, 'error');
    const d = putMyDesign(got);
    this.notify(`Added “${d.label}” to My designs.`, 'info', 6000, this.project ? { label: 'Use it', run: () => void this.applyDesign(d) } : undefined);
  } catch (e) {
    this.notify(`Couldn't read the design: ${e}`, 'error');
  }
}

/**
 * Shares the whole theme as one .zip, ready to post anywhere: saved first, with a preview
 * picture (taken from the screen when the theme has none). Others open it with Import.
 */
export async function shareTheme(this: Editor) {
  const p = this.project;
  if (!p) return;
  const dest = await saveDialog({ title: 'Share theme', defaultPath: `${p.name}.zip`, filters: [{ name: 'Zip', extensions: ['zip'] }] });
  if (!dest) return;
  try {
    if (this.dirtyCount) await this.save();
    if (this.dirtyCount) return void this.notify('The theme couldn’t be saved, so it wasn’t shared.', 'error');
    if (!p.assets.some((a) => a.rel.toLowerCase() === 'preview.png')) await this.makePreviewImage();
    this.notify(`Packing “${p.name}”… With many pictures this can take a little while.`, 'info', 600000);
    await api.exportTheme(p.dir, dest);
    this.notify(`“${p.name}” is ready to share as ${basename(dest)}. Others add it with Import a theme on the start screen.`, 'info', 8000, { label: 'Show file', run: () => void revealItemInDir(dest) });
  } catch (e) {
    this.notify(`Sharing failed: ${e}`, 'error');
  }
}

/** Whether the theme has a preview.png to show in the gallery. */
export function hasPreview(this: Editor): boolean {
  void this.rev;
  return !!this.project?.assets.some((a) => a.rel.toLowerCase() === 'preview.png');
}

/**
 * Publishes the theme to the gallery as Share theme makes it: saved first, with a preview
 * picture (taken from the screen when the theme has none). Throws a sentence to show.
 */
export async function publishToGallery(this: Editor, name: string, maker: string): Promise<{ slug: string; url: string; leftOut: string[] }> {
  const p = this.project;
  if (!p) throw 'Open a theme first.';
  if (this.dirtyCount) await this.save();
  if (this.dirtyCount) throw 'The theme couldn’t be saved, so it wasn’t published.';
  if (!this.hasPreview()) await this.makePreviewImage();
  return api.publishTheme(p.dir, name.trim(), maker.trim(), GALLERY_SITE, this.systems.map((s) => s.theme));
}
