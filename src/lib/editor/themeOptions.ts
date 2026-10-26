// RetroBat's Theme Configuration menu options, console artwork from other themes, and featured games.
// Part of the editor (editor.svelte.ts): each function is a method of the editor (`this`),
// attached to it there, so callers use ed.<name>(...).

import type { Editor } from '../editor.svelte';
import { type Choice, COVER_EL, FEATURED_FILE, FEATURED_MEDIA, type FeaturedState, featuredXml, pickGame, readFeatured, VIDEO_EL } from '../theme/featured';
import { addElementChange, type Change } from '../theme/edits';
import { designAssets, DESIGNS, recoloured } from '../theme/designs';
import { type MenuChoices, planMenuOptions, readMenuState } from '../theme/menuOptions';
import { api } from '../api';
import { patchInsertChild } from '../xml/cst';
import { join } from '../path';

/**
 * For each console in `choices`: picks the game (automatic or chosen) whose video and cover both
 * exist, copies the two files into the theme and writes featured.xml, plus the two elements and
 * the include in theme.xml if they're missing. One undo step. Returns problems to show.
 */
export async function applyFeatured(this: Editor, choices: Record<string, Choice>): Promise<string[]> {
  const p = this.project;
  if (!p) return [];
  if (this.screenFile !== 'theme.xml') this.showScreen({ view: 'system', file: 'theme.xml' });
  await this.ensureBackup();
  const prev = readFeatured(p.fileAt(FEATURED_FILE)?.src);
  const state: FeaturedState = { choices: { ...prev.choices, ...choices }, pairs: { ...prev.pairs } };
  const problems: string[] = [];
  for (const [sys, choice] of Object.entries(choices)) {
    const info = this.systems.find((s) => s.name === sys);
    const label = info?.fullName ?? sys;
    if (choice === 'none') {
      delete state.pairs[sys];
      continue;
    }
    await this.loadGamesFor(sys);
    const games = this.games[sys];
    // The ROM folder can't be read (drive unplugged?): keep the pair saved earlier.
    if (!games) continue;
    const paths = [...new Set(games.flatMap((g) => [g.media.video, g.media.boxart, g.media.thumbnail, g.media.image].filter((x): x is string => !!x)))];
    const found = await api.existingFiles(paths).catch(() => paths.map(() => false));
    const exist = new Set(paths.filter((_, i) => found[i]));
    const pick = pickGame(games, choice, (x) => exist.has(x));
    if (!pick) {
      if (choice === 'auto') delete state.pairs[sys];
      else problems.push(`${label}: that game needs both a video and a cover that exist on disk. Pick another game, or Automatic.`);
      continue;
    }
    try {
      const video = await api.copyMediaIntoTheme(p.dir, pick.video, FEATURED_MEDIA);
      const cover = await api.copyMediaIntoTheme(p.dir, pick.cover, FEATURED_MEDIA);
      state.pairs[sys] = { theme: info?.theme ?? sys, game: pick.game.path, name: pick.game.name, video, cover };
    } catch (e) {
      problems.push(`${label}: couldn't copy its video and cover (${e}).`);
    }
  }
  if (this.project !== p) return problems;
  // Nothing could be set up (or changed): leave the theme as it is.
  if (problems.length && JSON.stringify(state.pairs) === JSON.stringify(prev.pairs)) return problems;
  p.setAssets(await api.listThemeFiles(p.dir));
  const res = this.res;
  const entry = p.fileAt('theme.xml');
  if (!res || !entry?.doc.root) return problems;
  const changes: Change[] = [];
  const file = p.fileAt(FEATURED_FILE) ?? p.addFile(FEATURED_FILE, '<theme>\n</theme>\n');
  changes.push({ file, patch: { start: 0, end: file.src.length, text: featuredXml(state) } });
  // The include goes first in this list: inserts at the same spot land before the ones after
  // them, so the elements' own definitions stay above the include that overrides them.
  if (!res.usedFiles.has(file)) changes.push({ file: entry, patch: patchInsertChild(entry.doc, entry.doc.root, `<include>./${FEATURED_FILE}</include>`) });
  const sys = res.views.get('system')?.elements;
  if (!sys?.has(VIDEO_EL)) changes.push(addElementChange(p, res, 'system', 'video', VIDEO_EL, '<pos>0.25 0.5</pos>\n<origin>0.5 0.5</origin>\n<maxSize>0.36 0.36</maxSize>\n<delay>0.4</delay>\n<showSnapshotNoVideo>false</showSnapshotNoVideo>\n<visible>false</visible>\n<zIndex>24</zIndex>', true));
  if (!sys?.has(COVER_EL)) changes.push(addElementChange(p, res, 'system', 'image', COVER_EL, '<pos>0.5 0.5</pos>\n<origin>0.5 0.5</origin>\n<maxSize>0.16 0.32</maxSize>\n<visible>false</visible>\n<zIndex>25</zIndex>', true));
  this.commit('matching game video and cover', changes);
  const n = Object.keys(state.pairs).length;
  this.notify(`${n} console${n === 1 ? '' : 's'} now show${n === 1 ? 's' : ''} one game's video and cover together. Save to keep it.`);
  return problems;
}

/** With menu options, styles are chosen there: a design or layout applied directly would override them. */
export function menuGuard(this: Editor): boolean {
  if (!this.project || !readMenuState(this.project)) return false;
  this.notify('This theme’s styles are RetroBat menu options now. Add or change styles in RetroBat menu options.');
  this.showMenuOptions = true;
  return true;
}

/**
 * Writes the choices as RetroBat theme options (see menuOptions.ts) in one undo step: option
 * files, colour sets, artwork per design and colour set, and the options include in theme.xml.
 */
export async function applyMenuOptions(this: Editor, choices: MenuChoices): Promise<boolean> {
  const p = this.project;
  const base = this.menuBase;
  if (!p || !base) return false;
  if (this.screenFile !== 'theme.xml') this.showScreen({ view: 'system', file: 'theme.xml' });
  await this.ensureBackup();
  // Fonts first: the option files point at them.
  const fontIds = new Set<string>();
  for (const id of [base.design.id, ...choices.gameDesigns]) {
    const d = DESIGNS.find((x) => x.id === id);
    if (d) [d.font, d.titleFont].forEach((f) => f && fontIds.add(f));
  }
  const fonts: Record<string, string | null> = {};
  for (const id of fontIds) fonts[id] = await this.ensureFont(id);
  if (this.project !== p) return false;
  const res = this.themeRes;
  if (!res) return false;
  const plan = planMenuOptions(p, res, choices, base.design, base.systemLayout, fonts);
  let wrote = true;
  for (const a of plan.art) {
    if (p.assets.some((x) => x.rel.toLowerCase().startsWith(`${a.dir.toLowerCase()}/`))) continue;
    wrote = (await this.writeArt(a.dir, designAssets(recoloured(a.design, a.palette)))) && wrote;
  }
  if (this.project !== p) return false;
  const changes: Change[] = plan.changes(p);
  for (const [rel, xml] of Object.entries(plan.files)) {
    const f = p.fileAt(rel) ?? p.addFile(rel, '');
    changes.push({ file: f, patch: { start: 0, end: f.src.length, text: xml } });
  }
  this.commit('RetroBat menu options', changes);
  this.selected = null;
  this.notify(wrote ? 'RetroBat menu options added. Save, then look in RetroBat under Main menu → UI settings → Theme configuration. Ctrl+Z undoes it.' : 'Menu options were added in the preview only (files can’t be written here).');
  return true;
}

/** Cached per theme folder: scanning a big theme takes a moment. */
export function findConsoleArt(this: Editor, themeDir: string) {
  let p = this.consoleArtCache.get(themeDir);
  if (!p) {
    p = this.scanConsoleArt(themeDir);
    this.consoleArtCache.set(themeDir, p);
    p.catch(() => this.consoleArtCache.delete(themeDir));
  }
  return p;
}

export async function scanConsoleArt(this: Editor, themeDir: string): Promise<{ logos: string | null; consoles: string | null; logoCount: number; consoleCount: number }> {
  const files = await api.listThemeFiles(themeDir);
  const names = new Set(this.systems.map((s) => s.theme.toLowerCase()));
  const counts = new Map<string, number>();
  for (const f of files) {
    if (f.kind !== 'image') continue;
    const i = f.rel.lastIndexOf('/');
    const dir = i < 0 ? '' : f.rel.slice(0, i);
    const stem = f.rel.slice(i + 1).replace(/\.[^.]+$/, '').toLowerCase();
    if (names.has(stem)) counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  const pick = (re: RegExp) => [...counts].filter(([d, n]) => re.test(d) && n >= 5).sort((a, b) => b[1] - a[1])[0];
  const logos = pick(/logo|wheel|marquee/i) ?? [...counts].sort((a, b) => b[1] - a[1])[0];
  const consoles = pick(/console|device|controller|hardware/i);
  return {
    logos: logos ? logos[0] : null,
    consoles: consoles ? consoles[0] : null,
    logoCount: logos?.[1] ?? 0,
    consoleCount: consoles?.[1] ?? 0,
  };
}

/** Copies system logos and console pictures from an installed theme into this one. */
export async function importConsoleArt(this: Editor, fromThemeDir: string) {
  const p = this.project;
  if (!p) return;
  const found = await this.findConsoleArt(fromThemeDir);
  let n = 0;
  try {
    if (found.logos !== null) n += await api.copyFolderIntoTheme(join(fromThemeDir, found.logos), p.dir, '_inc/systems/logos');
    if (found.consoles) n += await api.copyFolderIntoTheme(join(fromThemeDir, found.consoles), p.dir, '_inc/systems/consoles');
    p.setAssets(await api.listThemeFiles(p.dir));
    this.rev++;
    this.notify(`Copied ${n} logo and console pictures into the theme`);
  } catch (e) {
    this.notify(`Couldn't copy the console art: ${e}`, 'error');
  }
}
