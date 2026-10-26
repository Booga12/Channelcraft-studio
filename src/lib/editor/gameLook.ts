// One game's own look: RetroBat's per-game theme files.
// Part of the editor (editor.svelte.ts): each function is a method of the editor (`this`),
// attached to it there, so callers use ed.<name>(...).

import type { Editor } from '../editor.svelte';
import { type Change } from '../theme/edits';
import { applyToText, copyOfShared, draftFile, EMPTY_GAME_FILE, type GameEdit, gameEditChanges, gameExtrasChange, GAMES_README, ownFileGuards, screensWithoutGameExtras } from '../theme/perGame';
import { isOwnGamePath, perGameApplies, type PerGameInfo, romStem } from '../theme/resolver';
import { type ThemeFile } from '../theme/project';
import { api } from '../api';
import { attr, elements } from '../xml/cst';
import { dirname, join } from '../path';
import { elementLabel } from '../friendly';

/** The current game's own file for this screen: the one RetroBat would find, or where a new one goes. */
export function gameFilePath(this: Editor): string | null {
  const p = this.project;
  const res = this.res;
  const g = this.currentGame;
  if (!p || !res || !g?.path) return null;
  const info = res.perGame.get(this.view);
  const stem = romStem(g.path);
  if (!info) return join(p.dir, 'games', this.consoleTheme, stem, 'theme.xml');
  if (info.file && isOwnGamePath(info.file.abs, stem)) return info.file.abs;
  // The first file RetroBat would try that is named after the game; plain theme.xml rather than a
  // screen-ratio variant (theme-43.xml), which RetroBat also finds.
  const mine = info.candidates.filter((c) => isOwnGamePath(c, stem));
  return mine.find((c) => /[\\/]theme\.xml$/i.test(c)) ?? mine[0] ?? null;
}

/** @internal */
export function gameSetMany(this: Editor, label: string, updates: Record<string, Record<string, string>>, coalesce?: string) {
  const v = this.currentView;
  if (!v) return false;
  const edits = Object.entries(updates)
    .filter(([name]) => v.elements.has(name))
    .map(([name, props]) => ({ name, type: v.elements.get(name)!.type, props }));
  return this.gameSet(label, edits, coalesce);
}

/**
 * Writes edits into the current game's own file (made if needed), and points the theme's
 * game-list screens at the per-game folder the first time. Parts RetroBat draws once for the
 * whole list are refused with a message, since a game's file can't change them.
 */
export function gameSet(this: Editor, label: string, edits: GameEdit[], coalesce?: string): boolean {
  const p = this.project;
  const res = this.res;
  const abs = this.gameFilePath();
  const entry = p?.fileAt('theme.xml');
  if (!p || !res || !abs || !entry || !p.isInside(abs)) return false;
  const view = this.currentView;
  const ok: GameEdit[] = [];
  const refused: string[] = [];
  for (const e of edits) {
    const el = view?.elements.get(e.name);
    // Defined by the per-game files (this game's, or the shared fallback it uses) alone, or
    // re-declared there with extra="true": RetroBat rebuilds it for each game (ThemeData, extra 3).
    const onlyHere = !!el && (el.defs.every((d) => res.perGameFiles.has(d.file)) || el.defs.some((d) => res.perGameFiles.has(d.file) && attr(d.node, 'extra') !== undefined));
    if (e.extra || onlyHere || perGameApplies(el, e.name, false)) ok.push(e);
    else refused.push(e.name);
  }
  if (refused.length) {
    const names = refused.map(elementLabel).join(', ');
    this.notify(`RetroBat draws ${names} once for the whole game list, so ${refused.length === 1 ? 'it' : 'they'} can’t change for one game. The game parts (cover, video, name, description…) can, and so can anything you add while “Only this game” is on.`, 'error');
  }
  if (!ok.length) return false;
  const rel = abs.slice(p.dir.length + 1).replace(/\\/g, '/');
  // A drag or typing sends many edits. The first one makes the game's file, later ones change
  // values in it, so their patches differ and wouldn't merge: fold them into one undo step by
  // taking the previous step back first and writing the whole change again.
  const key = coalesce ? `${coalesce}@game:${rel}` : undefined;
  const last = this.undoStack[this.undoStack.length - 1];
  if (key && last?.coalesce === key && Date.now() - last.time < 1200) this.undo(true);
  const existing = p.file(abs);
  const file = existing?.doc.root ? existing : existing ? (p.setSource(existing, EMPTY_GAME_FILE), existing) : p.addFile(rel, EMPTY_GAME_FILE);
  // A game that used a shared fallback (its console's default look) starts from a copy of it,
  // since RetroBat reads only one per-game file and such looks hide parts once a game has its own.
  const shared = this.gameSharedFile;
  const fresh = !elements(file.doc.root!).length;
  const custom = !!this.currentView?.custom;
  let changes: Change[];
  if (fresh && shared?.doc.root) {
    const copy = copyOfShared(shared.src, dirname(shared.abs), dirname(abs), ownFileGuards(this.themeRes ?? res));
    const text = applyToText(copy, gameEditChanges(draftFile(file, copy), this.view, ok, { custom }));
    changes = [{ file, patch: { start: 0, end: file.src.length, text } }];
  } else {
    changes = gameEditChanges(file, this.view, ok, { custom });
  }
  const decl = screensWithoutGameExtras(this.themeRes ?? res).includes(this.view) ? gameExtrasChange(entry, [this.view]) : null;
  if (decl) changes.push(decl);
  this.commit(`${label} for ${this.gameName}`, changes, key);
  return true;
}

/**
 * Removes the current game's own file for this screen (deleted on save, after a backup), so it
 * looks like the other games again. Undoable.
 */
export function resetGame(this: Editor) {
  const f = this.gameFile;
  if (!f) return;
  this.commit(`${this.gameName}'s own look`, [{ file: f, patch: { start: 0, end: f.src.length, text: '' } }]);
  this.notify(`${this.gameName} uses the shared look again. Saving deletes its own file (${f.rel}); Ctrl+Z undoes it.`);
}

/** Where RetroBat would look for another game's own file, following the current game's. */
export function ownFileFor(this: Editor, info: PerGameInfo, stem: string): ThemeFile | null {
  const p = this.project!;
  const swap = (c: string) =>
    c
      .split(/([\\/]+)/)
      .map((part) => (part.toLowerCase() === info.stem.toLowerCase() ? stem : part.toLowerCase() === `${info.stem}.xml`.toLowerCase() ? `${stem}.xml` : part))
      .join('');
  for (const c of info.candidates.filter((c) => isOwnGamePath(c, info.stem))) {
    const f = p.file(swap(c));
    if (f?.src.trim()) return f;
  }
  return null;
}

/**
 * The per-game folders of a theme: games/<console>/ for every console that has games (by its
 * theme name, as {game:system:theme} gives it), with a README. A failure here never stops a theme
 * from being made; the folders are a convenience, RetroBat finds files without them.
 */
export async function makeGameFolders(this: Editor, themeDir: string) {
  try {
    if (!this.gameSystems.length) await this.loadGames();
    const consoles = [...new Set(this.systems.filter((s) => this.gameSystems.includes(s.name)).map((s) => s.theme || s.name))]
      .filter((t) => /^[\w.+-]+$/.test(t))
      .sort();
    await api.makeThemeDirs(themeDir, ['games', 'games/_default', ...consoles.map((c) => `games/${c}`)]);
    await api.writeText(join(themeDir, 'games', 'README.txt'), GAMES_README.replace(/\n/g, '\r\n'), false);
  } catch (e) {
    console.warn('per-game folders', e);
  }
}
