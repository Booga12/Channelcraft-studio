import { load, type Store } from '@tauri-apps/plugin-store';
import { ask } from '@tauri-apps/plugin-dialog';
import { api, tauriFs, type LibraryAsset, type RootInfo, type ThemeInfo } from './api';
import { join, dirname } from './path';
import { parseGamelist, type GameInfo } from './theme/games';
import { type Environment, type PreviewSettings } from './theme/context';
import { addElementChange, addPropChange, applyChanges, insertTarget, inverse, OverlapError, setTextChange, uniqueName, varRef, type Applied, type Change } from './theme/edits';
import { ThemeProject, type ThemeFile } from './theme/project';
import { isGameListView, isOwnGamePath, resolveTheme, romStem, type ResolvedElement, type Resolution, type Source } from './theme/resolver';
import { STARTER_PROPS, VIEW_ORDER } from './theme/schema';
import { zOf } from './render';
import { DEPTH_VAR, depthLevel, MOTION_FEELS, MOTION_VAR, SCREEN_FX_VAR, screenFxOf, type Depth, type ScreenFx } from './theme/depth';
import { FALLBACK_SYSTEMS, parseEsSystems, type SystemInfo } from './theme/systems';
import { attr, elements, patchInsertChild, patchRemoveNode } from './xml/cst';

import { elementLabel, humanize, propLabel, typeLabel, viewLabel } from './friendly';
import { type LibraryItem } from './theme/library';
import { prefs } from './prefs.svelte';
import { tileStyleOfPath } from './theme/tiles';
import { appliedDesign, appliedSystemLayout, readability, designChanges, designVarsChange, LAYOUTS } from './theme/presets';
import { readMenuState, type MenuState } from './theme/menuOptions';
import { DESIGNS, designAssets, recoloured, type Design } from './theme/designs';
import { withOnlineArt } from './theme/libretro';
import { addConsoleProp, addConsoleVar, consoleValues, overrideIn, sharedIn, type ConsoleValue } from './theme/consoles';
import { FEATURED_FILE, readFeatured, type FeaturedState } from './theme/featured';
import { task } from './task.svelte';
import * as look from './editor/look';
import * as parts from './editor/parts';
import * as gameLook from './editor/gameLook';
import * as assets from './editor/assets';
import * as saving from './editor/saving';
import * as restyle from './editor/restyle';
import * as themeOptions from './editor/themeOptions';
import * as health from './editor/health';
import * as sharing from './editor/sharing';
import * as sound from './editor/sound';
import { checkTheme, type HealthIssue } from './theme/health';
import { splashTemplate } from './theme/splash';

/** RetroBat's loading screen files, read on their own (not through theme.xml). */
export const SPLASH_FILES = ['splash.xml', 'gamesplash.xml'] as const;

interface HistoryEntry {
  label: string;
  applied: Applied[];
  time: number;
  coalesce?: string;
  /** Several edits made one after another as one step (see `group`), in the order made. */
  parts?: Applied[][];
}

export interface Toast {
  text: string;
  kind: 'info' | 'error';
  id: number;
  /** How long it shows, if not the usual time. */
  ms?: number;
  /** A button on the message. */
  action?: { label: string; run: () => void };
}

const DEFAULT_SETTINGS: PreviewSettings = {
  system: FALLBACK_SYSTEMS[0],
  subsets: {},
  lang: 'en',
  region: 'us',
  ratio: '16/9',
  tinyScreen: false,
  verticalScreen: false,
  helpPrompts: true,
  cheevos: false,
};

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson<T extends object>(key: string): T {
  try {
    const v = JSON.parse(readPref(key) ?? '{}');
    return v && typeof v === 'object' ? v : ({} as T);
  } catch {
    return {} as T;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are a convenience; ignore storage failures.
  }
}

export class Editor {
  root = $state<RootInfo | null>(null);
  themes = $state<ThemeInfo[]>([]);
  systems = $state.raw<SystemInfo[]>(FALLBACK_SYSTEMS);
  project = $state.raw<ThemeProject | null>(null);
  /** Bumped on every edit; the resolution depends on it. */
  rev = $state(0);
  settings = $state<PreviewSettings>({ ...DEFAULT_SETTINGS });
  view = $state('system');

  #screenFile = $state('theme.xml');
  /**
   * The file the current screen comes from: theme.xml, or RetroBat's own loading screen files
   * (splash.xml while it starts, gamesplash.xml when a game launches), which it reads separately.
   */
  get screenFile() {
    return this.#screenFile;
  }
  set screenFile(f: string) {
    this.#screenFile = f;
    if (this.project) this.project.entryRel = f;
  }
  /** Selected element names; the last one is the primary selection shown in Properties. */
  selection = $state<string[]>([]);
  get selected(): string | null {
    return this.selection.length ? this.selection[this.selection.length - 1] : null;
  }
  set selected(v: string | null) {
    this.selection = v ? [v] : [];
  }
  /** Layers locked against canvas clicks and drags, per theme. */
  locked = $state<Record<string, boolean>>({});
  /** On-screen boxes of drawn elements in screen fractions, measured by the preview. */
  rects = $state.raw<Record<string, { x: number; y: number; w: number; h: number }>>({});
  /** Animations play in the preview (on by default, remembered between sessions). */
  get playAnimations() {
    return prefs.v.playAnimations;
  }

  /** Goes up each time the entrance animations should play again (Replay, a new animation). */
  replay = $state(0);
  /** The side the last replay came from: +1 as if moving down the list, -1 up. */
  replayDir = $state(0);

  /** Plays every entrance animation in the preview again, as RetroBat does when you move to a game. */
  replayAnimations(dir = 0) {
    this.playAnimations = true;
    this.replayDir = dir;
    this.replay++;
  }

  /**
   * The next (+1) or previous (-1) game in the preview, like moving down or up RetroBat's list, so
   * the animations play again. With sample data there's only one game: the animations just replay.
   */
  stepGame(dir: number) {
    const n = this.currentGames.length;
    if (n > 1) this.gameIndex = (this.gameIndex + dir + n) % n;
    else this.replayAnimations(dir);
  }
  set playAnimations(on: boolean) {
    if (prefs.v.playAnimations !== on) prefs.set('playAnimations', on);
  }
  /** Edits of colours and properties go to the preview console's own values (RetroBat `if` on ${system.theme}). */
  consoleOnly = $state(false);
  /** Edits go to the game in the preview only: RetroBat's own file for that game (see perGame.ts). */
  gameOnly = $state(false);
  contactSheet = $state(false);
  showSettings = $state(false);
  showRestore = $state(false);
  showShortcuts = $state(false);
  showReport = $state(false);
  showSearch = $state(false);

  /** Bumped whenever a panel is asked for, so asking twice still brings it forward. */
  panelRequest = $state(0);

  showPanel(id: 'elements' | 'library' | 'assets' | 'presets' | 'sound' | 'options' | 'variables' | 'files' | 'history' | 'explorer' | 'properties') {
    this.leftTab = id as typeof this.leftTab;
    this.panelRequest++;
  }

  isSelected(name: string) {
    return this.selection.includes(name);
  }

  select(name: string, mode: 'only' | 'toggle' | 'add' = 'only') {
    if (mode === 'only') this.selection = [name];
    else if (mode === 'add') this.selection = [...this.selection.filter((n) => n !== name), name];
    else this.selection = this.selection.includes(name) ? this.selection.filter((n) => n !== name) : [...this.selection, name];
  }

  setLocked(name: string, on: boolean) {
    this.locked = { ...this.locked, [name]: on };
    if (on) this.selection = this.selection.filter((n) => n !== name);
    try {
      if (this.project) localStorage.setItem(`ccs.locks.${this.project.dir}`, JSON.stringify(this.locked));
    } catch {
      // Locks are a convenience.
    }
  }
  hidden = $state<Record<string, boolean>>({});
  sourceFile = $state<string | null>(null);
  sourceLine = $state<number | null>(null);
  leftTab = $state<'elements' | 'library' | 'assets' | 'presets' | 'sound' | 'options' | 'variables' | 'files' | 'history' | 'explorer' | 'properties'>('elements');
  showSource = $state(false);
  toast = $state<Toast | null>(null);
  busy = $state(false);
  loading = $state(false);
  /** Theme options RetroBat has saved for the open theme (themesettings\<theme>.cfg). */
  savedSubsets: Record<string, string> = {};
  /** Canvas zoom: fit the window, or a fixed scale (1 = actual pixels). */
  zoom = $state<'fit' | number>('fit');
  /** Simple hides file names, line numbers and rarely used settings. */
  mode = $state<'simple' | 'advanced'>(readPref('ccs.mode') === 'advanced' ? 'advanced' : 'simple');
  /** Whether the getting-started guide is open (Help; the tour introduces the editor itself). */
  showGuide = $state(false);
  /** Whether the first-run tour is showing. */
  showTour = $state(false);
  /** Ask before editing an original theme instead of a copy. */
  askCopy = $state(readPref('ccs.askCopy') !== '0');

  setMode(m: 'simple' | 'advanced') {
    this.mode = m;
    writePref('ccs.mode', m);
    if (m === 'simple' && this.leftTab === 'files') this.leftTab = 'elements';
    if (m === 'simple') this.showSource = false;
  }

  closeGuide() {
    this.showGuide = false;
    writePref('ccs.guideDone', '1');
  }

  /** Shows the tour the first time the editor opens. */
  firstTour() {
    if (readPref('ccs.tourDone') !== '1') this.showTour = true;
  }

  closeTour() {
    this.showTour = false;
    writePref('ccs.tourDone', '1');
  }

  setAskCopy(v: boolean) {
    this.askCopy = v;
    writePref('ccs.askCopy', v ? '1' : '0');
  }

  get simple() {
    return this.mode === 'simple';
  }

  /** @internal */
  undoStack = $state.raw<HistoryEntry[]>([]);
  /** @internal */
  redoStack = $state.raw<HistoryEntry[]>([]);

  /** Forgets undo history (it belongs to the theme it was made in). */
  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
  }
  /** @internal */
  backedUp = new Set<string>();
  private store: Store | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  /** Systems with a scraped gamelist in RetroBat's roms folder. */
  gameSystems = $state<string[]>([]);
  /** Real games per system, loaded on demand. */
  games = $state.raw<Record<string, GameInfo[]>>({});
  /** Which game of the list the preview shows. */
  gameIndex = $state(0);

  currentGames = $derived.by(() => {
    if (!prefs.v.realArtwork) return [];
    const list = this.games[this.settings.system.name] ?? [];
    // Pictures RetroBat hasn't scraped come from libretro-thumbnails, for the preview only.
    return prefs.v.onlineArt ? withOnlineArt(this.settings.system.name, list) : list;
  });
  currentGame = $derived<GameInfo | undefined>(this.currentGames.length ? this.currentGames[this.gameIndex % this.currentGames.length] : undefined);

  env = $derived<Environment>({
    settings: this.settings,
    esHome: this.root?.esHome ?? '',
    resourcesDir: this.root?.resourcesDir ?? '',
    game: this.currentGame,
    gameNames: this.currentGames.length ? this.currentGames.map((g) => g.name) : undefined,
    games: this.currentGames.length ? this.currentGames : undefined,
  });

  res = $derived.by<Resolution | null>(() => {
    this.rev;
    const p = this.project;
    if (!p) return null;
    const settings = $state.snapshot(this.settings) as PreviewSettings;
    return resolveTheme(p, { settings, esHome: this.root?.esHome ?? '', resourcesDir: this.root?.resourcesDir ?? '', game: this.currentGame }, this.screenFile);
  });

  /** theme.xml's resolution, also while a loading screen file is being edited. */
  themeRes = $derived.by<Resolution | null>(() => {
    if (this.screenFile === 'theme.xml') return this.res;
    this.rev;
    const p = this.project;
    if (!p) return null;
    const settings = $state.snapshot(this.settings) as PreviewSettings;
    return resolveTheme(p, { settings, esHome: this.root?.esHome ?? '', resourcesDir: this.root?.resourcesDir ?? '', game: this.currentGame }, 'theme.xml');
  });

  /** Loads the list of systems with scraped games, and the current system's games. */
  async loadGames() {
    try {
      this.gameSystems = await api.listGamelists(this.systems.map((s) => ({ name: s.name, path: s.path })));
    } catch {
      this.gameSystems = [];
    }
    await this.loadGamesFor(this.settings.system.name);
  }

  async loadGamesFor(system: string) {
    if (!this.root || this.games[system] || !this.gameSystems.includes(system)) return;
    try {
      // RetroBat finds each system's games in the folder its es_systems.cfg entry names.
      const f = await api.readGamelist(system, this.systems.find((s) => s.name === system)?.path);
      if (!f) return;
      const list = parseGamelist(f.text, dirname(f.path));
      this.games = { ...this.games, [system]: list };
    } catch {
      // No games for this system: the sample game is shown instead.
    }
  }

  /** Switches the preview to another system (by offset in the list), loading its games. */
  stepSystem(offset: number) {
    const list = this.previewSystems;
    const i = list.findIndex((s) => s.name === this.settings.system.name);
    const next = list[(i + offset + list.length) % list.length];
    if (next) this.setSystem(next);
  }

  setSystem(s: SystemInfo) {
    this.settings.system = s;
    this.gameIndex = 0;
    this.loadGamesFor(s.name);
  }

  /** Systems for the picker: the ones with your scraped games first. */
  previewSystems = $derived.by(() => {
    const mine = new Set(this.gameSystems);
    return [...this.systems.filter((s) => mine.has(s.name)), ...this.systems.filter((s) => !mine.has(s.name))];
  });

  viewNames = $derived.by(() => {
    const r = this.themeRes;
    if (!r) return [];
    const names = [...r.views.keys()];
    return names.sort((a, b) => {
      const ia = VIEW_ORDER.indexOf(a);
      const ib = VIEW_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
  });

  currentView = $derived(this.res?.views.get(this.view) ?? null);

  /** Document tabs: theme.xml's screens, then RetroBat's loading screens if the theme has them. */
  screens = $derived.by(() => {
    this.rev;
    const tabs: { id: string; view: string; file: string }[] = this.viewNames.map((v) => ({ id: v, view: v, file: 'theme.xml' }));
    for (const file of SPLASH_FILES) if (this.project?.fileAt(file)) tabs.push({ id: `@${file}`, view: 'splash', file });
    return tabs;
  });

  /** Adds RetroBat's loading screen (splash.xml) or game launch screen (gamesplash.xml) to the theme and shows it. */
  addLoadingScreen(file: (typeof SPLASH_FILES)[number]) {
    const p = this.project;
    if (!p) return;
    if (!p.fileAt(file)) {
      if (this.sharedOnly('Loading screens')) return;
      // An empty <theme> until the edit below, so undoing it leaves nothing to save.
      const f = p.addFile(file, '<theme>\n</theme>\n');
      this.commit(file === 'splash.xml' ? 'add a loading screen' : 'add a game launch screen', [{ file: f, patch: { start: 0, end: f.src.length, text: splashTemplate(file === 'gamesplash.xml') } }]);
      this.rev++;
      this.notify(`${file === 'splash.xml' ? 'Loading screen' : 'Game launch screen'} added (${file}). Save to keep it, or Ctrl+Z to undo.`);
    }
    this.showScreen({ view: 'splash', file });
  }

  showScreen(tab: { view: string; file: string }) {
    this.screenFile = tab.file;
    this.view = tab.view;
    this.selected = null;
  }

  selectedElement = $derived<ResolvedElement | null>(this.selected ? (this.currentView?.elements.get(this.selected) ?? null) : null);

  dirtyCount = $derived.by(() => {
    this.rev;
    return this.project?.dirtyFiles.length ?? 0;
  });

  canUndo = $derived(this.undoStack.length > 0);
  canRedo = $derived(this.redoStack.length > 0);

  // ---- setup -------------------------------------------------------------------------------

  async init() {
    try {
      this.store = await load('settings.json', { autoSave: true, defaults: {} });
      const saved = (await this.store.get<string>('retrobatRoot')) ?? (await api.detectRetrobat());
      if (saved) await this.setRoot(saved, false);
    } catch (e) {
      this.notify(String(e), 'error');
    }
  }

  async setRoot(path: string, notifyErrors = true) {
    try {
      this.root = await api.setRetrobatRoot(path);
      await this.store?.set('retrobatRoot', path);
      await this.refreshThemes();
      try {
        const cfg = await api.readText(join(this.root.esHome, 'es_systems.cfg'));
        const list = parseEsSystems(cfg.text);
        if (list.length) this.systems = list.sort((a, b) => a.fullName.localeCompare(b.fullName));
      } catch {
        this.systems = FALLBACK_SYSTEMS;
      }
      const snes = this.systems.find((s) => s.name === 'snes');
      if (snes) this.settings.system = snes;
    } catch (e) {
      if (notifyErrors) this.notify(String(e), 'error');
      this.root = null;
    }
  }

  async refreshThemes() {
    this.themes = await api.listThemes();
    if (this.root) this.root = await api.rootStatus();
  }

  // ---- themes ------------------------------------------------------------------------------

  async openTheme(dir: string) {
    this.loading = true;
    try {
      // Locks the theme for this window and repairs a save or restore that was interrupted.
      const { recovered } = await api.openProject(dir);
      if (recovered) await ask(recovered, { title: 'Theme repaired', kind: 'info', okLabel: 'OK', cancelLabel: 'Close' });
      const project = await ThemeProject.load(dir, tauriFs);
      const subsets: Record<string, string> = {};
      try {
        const cfg = await api.readThemesettings(project.name);
        for (const line of cfg.split(/\r\n|\r|\n/)) {
          const i = line.indexOf('=');
          if (i <= 0) continue;
          const k = line.slice(0, i).trim();
          const v = line.slice(i + 1).trim();
          if (k === 'region') this.settings.region = v;
          else subsets[k.startsWith('subset.') ? k.slice(7) : k] = v;
        }
      } catch {
        // No saved options: the theme defaults apply.
      }
      this.savedSubsets = subsets;
      this.settings.subsets = { ...subsets };
      this.undoStack = [];
      this.redoStack = [];
      this.selected = null;
      // Where edits go is chosen per theme; a new one starts with every console and game.
      this.consoleOnly = false;
      this.gameOnly = false;
      this.hidden = {};
      this.sourceFile = null;
      try {
        this.locked = JSON.parse(localStorage.getItem(`ccs.locks.${project.dir}`) ?? '{}');
      } catch {
        this.locked = {};
      }
      this.project = project;
      this.screenFile = 'theme.xml';
      this.rev++;
      this.lastSave = Date.now();
      await this.offerRecovery(project);
      this.warnEmptyIncludes(project);
      this.loadGames();
      const views = this.viewNames;
      this.view = views.includes('system') ? 'system' : (this.res?.defaultView ?? views[0] ?? 'system');
      await this.store?.set('lastTheme', dir);
    } catch (e) {
      if (this.project?.dir !== dir) api.closeProject(dir).catch(() => {});
      this.notify(`Couldn't open the theme: ${e}`, 'error');
    } finally {
      this.loading = false;
    }
  }

  /** RetroBat can't load a theme that includes an empty file; older versions could leave some. */
  private warnEmptyIncludes(project: ThemeProject) {
    const all = project.xmlFiles;
    const text = all.map((f) => f.src).join('\n');
    const empty = all.filter((f) => f !== project.entry && !f.src.trim() && text.includes(f.rel.split('/').pop()!));
    if (!empty.length) return;
    const menu = empty.some((f) => f.rel.startsWith('_inc/ccs/options'));
    this.notify(
      `This theme includes ${empty.length} empty file${empty.length === 1 ? '' : 's'} (${empty.map((f) => f.rel).join(', ')}), so RetroBat may not load it.${menu ? ' Open File → RetroBat menu options… and press the button there to make them again, then Save.' : ''}`,
      'error',
    );
  }

  /** Reads the theme from disk again, dropping unsaved edits (after asking the caller). */
  async reloadFromDisk() {
    const p = this.project;
    if (!p) return;
    await api.clearRecovery(this.recoveryKey(p.dir)).catch(() => {});
    this.project = null;
    await this.openTheme(p.dir);
  }

  private askedAbout = '';
  /**
   * When the window comes back into focus: if another program changed the theme's files, offer to
   * reload them (asked once per set of changes).
   */
  async checkExternalChanges() {
    const p = this.project;
    if (!p || this.busy || this.loading) return;
    let changed: string[];
    try {
      changed = await api.changedFiles(p.dir);
    } catch {
      return;
    }
    const sig = `${p.dir}|${changed.join('|')}`;
    if (!changed.length || sig === this.askedAbout || this.project !== p) return;
    this.askedAbout = sig;
    const list = changed.slice(0, 6).join(', ') + (changed.length > 6 ? ` and ${changed.length - 6} more` : '');
    const lose = this.dirtyCount ? ` Your ${this.dirtyCount} unsaved file(s) would be read from disk again, so those edits would be lost.` : '';
    const reload = await ask(`Another program changed this theme's files: ${list}.\n\nReload the theme to see those changes?${lose}`, {
      title: 'Theme changed outside ChannelCraft',
      kind: 'warning',
      okLabel: 'Reload from disk',
      cancelLabel: 'Keep what I have',
    });
    if (reload) await this.reloadFromDisk();
    else this.notify('Kept your version. If you save a file that was changed elsewhere, you will be asked first.');
  }

  /** Puts the theme back exactly as it was in a backup (the current state is backed up first). */
  async restoreBackup(zip: string): Promise<boolean> {
    const p = this.project;
    if (!p || this.busy) return false;
    this.busy = true;
    const dir = p.dir;
    let ok = false;
    // Close the editor view first so no picture or video of the theme is still in use.
    this.project = null;
    this.selection = [];
    await new Promise((r) => setTimeout(r, 150));
    try {
      const before = await api.restoreBackup(dir, zip);
      await api.clearRecovery(this.recoveryKey(dir)).catch(() => {});
      this.backedUp.add(dir);
      ok = true;
      this.notify(`Backup restored. The version you had before was backed up too (${before.split(/[\\/]/).pop()}).`);
    } catch (e) {
      this.notify(String(e), 'error');
    } finally {
      this.busy = false;
    }
    await this.openTheme(dir);
    return ok;
  }

  closeTheme() {
    // Closing on purpose (after the unsaved-changes question) discards the recovery copy.
    if (this.project) api.clearRecovery(this.recoveryKey(this.project.dir)).catch(() => {});
    if (this.project) api.closeProject(this.project.dir).catch(() => {});
    this.project = null;
    this.selected = null;
    this.undoStack = [];
    this.redoStack = [];
    this.refreshThemes();
  }

  async duplicateTheme(src: string, name: string) {
    const dest = await api.copyTheme(src, name);
    await this.refreshThemes();
    return dest;
  }

  /** Themes being moved to the Recycle Bin right now; the start screen leaves them out. */
  deleting = $state<string[]>([]);

  async deleteTheme(dir: string, name: string) {
    this.deleting = [...this.deleting, dir];
    this.notify(`Moving “${name}” to the Recycle Bin…`);
    try {
      await api.deleteTheme(dir);
      await this.refreshThemes();
      this.notify(`“${name}” was moved to the Recycle Bin. Restore it from there if you change your mind.`);
    } catch (e) {
      this.notify(String(e), 'error');
    } finally {
      this.deleting = this.deleting.filter((d) => d !== dir);
    }
  }

  async createTheme(name: string) {
    const dest = await api.createThemeFromStarter(name);
    await this.makeGameFolders(dest);
    await this.refreshThemes();
    return dest;
  }

  // ---- editing -----------------------------------------------------------------------------

  /** Applies a transaction and records it for undo. Edits within a second on the same spot merge. */
  commit(label: string, changes: Change[], coalesce?: string) {
    const p = this.project;
    if (!p || !changes.length) return;
    // A slow action (downloads, artwork) may finish after its theme was closed or another opened.
    if (!changes.every((c) => p.files.get(c.file.key) === c.file)) return;
    // Where each patch starts before applying, in the order applyChanges reports them.
    const byFile = new Map<string, number[]>();
    for (const c of changes) byFile.set(c.file.key, [...(byFile.get(c.file.key) ?? []), c.patch.start]);
    const pre = [...byFile].flatMap(([key, starts]) => starts.sort((a, b) => b - a).map((start) => ({ key, start })));
    let applied: Applied[];
    try {
      applied = applyChanges(p, changes);
    } catch (e) {
      if (!(e instanceof OverlapError)) throw e;
      this.notify(`Couldn't make the ${label}: ${e.message} Please report this.`, 'error');
      return;
    }
    const now = Date.now();
    const last = this.undoStack[this.undoStack.length - 1];
    // Edits to the same spots within a moment (typing, dragging) merge into one undo step.
    const same = !!last && last.applied.length === pre.length && pre.every((x, i) => last.applied[i].key === x.key && last.applied[i].start === x.start);
    if (coalesce && last && last.coalesce === coalesce && now - last.time < 1200 && same) {
      const merged: Applied[] = applied.map((a, i) => ({ ...a, oldText: last.applied[i].oldText }));
      this.undoStack = [...this.undoStack.slice(0, -1), { ...last, applied: merged, time: now }];
    } else {
      this.undoStack = [...this.undoStack.slice(-199), { label, applied, time: now, coalesce }];
    }
    this.redoStack = [];
    this.rev++;
  }

  /**
   * Runs several edits (each its own commit) and keeps them as one undo step. Each edit sees
   * the theme as the earlier ones left it.
   */
  group(label: string, fn: () => void) {
    const mark = this.undoStack.at(-1);
    fn();
    const at = mark ? this.undoStack.lastIndexOf(mark) + 1 : 0;
    const added = this.undoStack.slice(at);
    if (added.length < 2) {
      if (added.length) this.undoStack = [...this.undoStack.slice(0, at), { ...added[0], label, coalesce: undefined }];
      return;
    }
    const parts = added.flatMap((e) => e.parts ?? [e.applied]);
    this.undoStack = [...this.undoStack.slice(0, at), { label, applied: [], parts, time: Date.now() }];
  }

  undo(quiet = false) {
    const p = this.project;
    const e = this.undoStack[this.undoStack.length - 1];
    if (!p || !e) return;
    if (e.parts) {
      // Last edit first; the redo step replays them in the order they were made.
      const back = [...e.parts].reverse().map((part) => applyChanges(p, inverse(p, part)));
      this.undoStack = this.undoStack.slice(0, -1);
      this.redoStack = [...this.redoStack, { label: e.label, applied: [], parts: back.reverse(), time: 0 }];
      this.rev++;
      if (!quiet) this.notify(`Undid ${e.label}`);
      return;
    }
    const redo = applyChanges(p, inverse(p, e.applied));
    this.undoStack = this.undoStack.slice(0, -1);
    this.redoStack = [...this.redoStack, { label: e.label, applied: redo, time: 0 }];
    this.rev++;
    if (!quiet) this.notify(`Undid ${e.label}`);
  }

  redo(quiet = false) {
    const p = this.project;
    const e = this.redoStack[this.redoStack.length - 1];
    if (!p || !e) return;
    if (e.parts) {
      const again = e.parts.map((part) => applyChanges(p, inverse(p, part)));
      this.redoStack = this.redoStack.slice(0, -1);
      this.undoStack = [...this.undoStack, { label: e.label, applied: [], parts: again, time: 0 }];
      this.rev++;
      if (!quiet) this.notify(`Redid ${e.label}`);
      return;
    }
    const undo = applyChanges(p, inverse(p, e.applied));
    this.redoStack = this.redoStack.slice(0, -1);
    this.undoStack = [...this.undoStack, { label: e.label, applied: undo, time: 0 }];
    this.rev++;
    if (!quiet) this.notify(`Redid ${e.label}`);
  }

  /**
   * Sets an element property in the current view. When the winning value is a single `${var}`,
   * the variable is edited unless `literal` is set, so colour sets keep working.
   */
  setProp(elementName: string, prop: string, value: string, opts: { literal?: boolean; coalesce?: string } = {}) {
    const el = this.currentView?.elements.get(elementName);
    const res = this.res;
    if (!el || !res) return;
    if (this.gameEditing) {
      this.gameSet(`${propLabel(prop).toLowerCase()} of ${elementLabel(elementName)}`, [{ name: elementName, type: el.type, props: { [prop]: value } }], opts.coalesce ?? `${elementName}.${prop}`);
      return;
    }
    const history = el.history.get(prop);
    // Outside "only this console", the shared definition is the one to follow (or link through).
    const basis = this.consoleOnly ? el.props.get(prop) : (sharedIn(history) ?? el.props.get(prop));
    const scope = this.consoleOnly ? `@${this.consoleTheme}` : '';
    const forConsole = this.consoleOnly ? ` for ${this.consoleName}` : '';
    const v = basis ? varRef(basis.raw) : null;
    if (v && res.vars.has(v) && !opts.literal) {
      const change = this.varChange(v, value);
      if (!change) return;
      this.commit(`change of ${humanize(v)}${forConsole}`, [change], `var.${v}${scope}`);
      this.warnShadowed(res.varHistory.get(v));
      return;
    }
    const change = this.propChange(el, prop, value);
    if (!change) return;
    this.commit(`${propLabel(prop).toLowerCase()} of ${elementLabel(elementName)}${forConsole}`, [change], (opts.coalesce ?? `${elementName}.${prop}`) + scope);
    this.warnShadowed(history);
  }

  get consoleTheme(): string {
    return this.settings.system.theme || this.settings.system.name;
  }

  get consoleName(): string {
    return this.settings.system.fullName || this.consoleTheme;
  }

  /** The change that sets a variable: the shared value, or the preview console's own one. */
  /** @internal */
  varChange(name: string, value: string): Change | null {
    const res = this.res;
    if (!res) return null;
    const history = res.varHistory.get(name);
    if (this.consoleOnly) {
      const own = overrideIn(history, this.consoleTheme);
      return own ? setTextChange(own.file, own.node, value) : addConsoleVar(res, name, this.consoleTheme, value);
    }
    const shared = sharedIn(history) ?? res.vars.get(name);
    return shared ? setTextChange(shared.file, shared.node, value) : null;
  }

  /** The change that sets a property literally: the shared value, or the preview console's own one. */
  private propChange(el: ResolvedElement, prop: string, value: string): Change | null {
    const history = el.history.get(prop);
    if (this.consoleOnly) {
      const own = overrideIn(history, this.consoleTheme);
      return own ? setTextChange(own.file, own.node, value) : addConsoleProp(el, this.view, prop, this.consoleTheme, value);
    }
    const shared = sharedIn(history);
    if (shared) return setTextChange(shared.file, shared.node, value);
    const target = insertTarget(el, this.view);
    if (!target) return null;
    // Only a console's own value exists: the shared one goes first, so the console's still wins.
    if (history?.length) return { file: target.file, patch: patchInsertChild(target.file.doc, target.node, `<${prop}>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</${prop}>`, { first: true }) };
    return addPropChange(target, prop, value);
  }

  /** Tells the user when a shared edit doesn't show because the preview console has its own value. */
  private warnShadowed(history: Source[] | undefined) {
    if (!this.consoleOnly && overrideIn(history, this.consoleTheme)) {
      this.notify(`${this.consoleName} has its own value here, so it still looks the same on ${this.consoleName}. Every other console changed.`);
    }
  }

  /** Everything the preview console has its own value for (colours, and properties on this screen). */
  get consoleValues(): ConsoleValue[] {
    return this.res ? consoleValues(this.res, this.view, this.consoleTheme) : [];
  }

  /** Removes console-only values, so the console goes back to the shared ones. */
  clearConsoleValues(values: ConsoleValue[]) {
    if (!values.length) return;
    this.commit(
      values.length === 1 ? `${this.consoleName}'s own ${values[0].kind === 'var' ? humanize(values[0].name) : propLabel(values[0].name).toLowerCase()}` : `${this.consoleName}'s own values`,
      values.map((v) => ({ file: v.def.file, patch: patchRemoveNode(v.def.file.doc, v.def.node) })),
    );
  }

  /** Changes built for setting `props` on an element (literal values, never through variables). */
  /** @internal */
  propChanges(elementName: string, props: Record<string, string>): Change[] {
    const el = this.currentView?.elements.get(elementName);
    if (!el) return [];
    const changes: Change[] = [];
    for (const [prop, value] of Object.entries(props)) {
      const c = this.propChange(el, prop, value);
      if (c) changes.push(c);
    }
    return changes;
  }

  // ---- one game's own look ----------------------------------------------------------------

  /** Why "only this game" can't be used on this screen right now, or null when it can. */
  get gameOnlyBlocker(): string | null {
    const res = this.res;
    if (this.screenFile !== 'theme.xml') return 'Loading screens show no game.';
    if (!res || !isGameListView(res, this.view)) return 'Only the game-list screens that show one game at a time (detailed, video, grid and game carousel) can look different for each game.';
    if (!this.currentGame?.path) return 'Needs one of your own games in the preview: pick a console that has games, with “Real artwork” on in Settings.';
    const target = this.gameFilePath();
    if (!target) return 'ChannelCraft can’t tell where this theme keeps a game’s own file (its per-game path never names the game).';
    if (this.project && !this.project.isInside(target)) return 'This theme keeps its per-game files outside its own folder (a theme option may move them to _bobmedia), so ChannelCraft can’t write them.';
    return null;
  }

  /** Edits are going to the current game's own file. */
  get gameEditing(): boolean {
    return this.gameOnly && !this.gameOnlyBlocker;
  }

  get gameName(): string {
    return this.currentGame?.name || 'this game';
  }

  /** The current game's own file, if it has one for this screen (not a console's shared fallback). */
  get gameFile(): ThemeFile | null {
    const info = this.res?.perGame.get(this.view);
    return info?.file && isOwnGamePath(info.file.abs, info.stem) ? info.file : null;
  }

  /** A shared file RetroBat uses for games without their own (e.g. a console's _default/theme.xml). */
  get gameSharedFile(): ThemeFile | null {
    const info = this.res?.perGame.get(this.view);
    return info?.file && !isOwnGamePath(info.file.abs, info.stem) ? info.file : null;
  }

  /** Games of the preview console that have their own file for this screen. */
  get gamesWithOwnLook(): { index: number; name: string }[] {
    this.rev;
    const p = this.project;
    const info = this.res?.perGame.get(this.view);
    if (!p || !info) return [];
    const out: { index: number; name: string }[] = [];
    this.currentGames.forEach((g, index) => {
      const stem = romStem(g.path);
      const f = this.ownFileFor(info, stem);
      if (f?.doc.root && elements(f.doc.root).length) out.push({ index, name: g.name || stem });
    });
    return out;
  }

  /** The screen's layers top first, as RetroBat draws them (zIndex, then later in the files on top). */
  get layers(): ResolvedElement[] {
    const v = this.currentView;
    if (!v) return [];
    return [...v.elements.values()].filter((e) => e.type !== 'gameextras').sort((a, b) => zOf(b) - zOf(a) || b.order - a.order);
  }

  // ---- clipboard ----

  /** @internal */
  clipboard: { type: string; name: string; props: Record<string, string> }[] = [];

  /** The theme's design background colour (RRGGBB), when it has one. */
  get designBackground(): string | null {
    return this.designColours()?.bg.slice(0, 6) ?? null;
  }

  // ---- history ----

  get history() {
    return { done: this.undoStack.map((e) => e.label), undone: [...this.redoStack].reverse().map((e) => e.label) };
  }

  /** Undoes or redoes until `count` steps are applied. */
  jumpTo(count: number) {
    while (this.undoStack.length > count && this.undoStack.length) this.undo(true);
    while (this.undoStack.length < count && this.redoStack.length) this.redo(true);
  }

  /** Colours and other variables are read once for the whole theme, so they can't differ per game. */
  /** @internal */
  sharedOnly(what: string): boolean {
    if (!this.gameEditing) return false;
    this.notify(`${what} are shared by every game. Switch to “All games” to change them, or select a part and change it for ${this.gameName} only.`, 'error');
    return true;
  }

  setVar(name: string, value: string) {
    if (this.sharedOnly('Colours and theme values')) return;
    const change = this.varChange(name, value);
    if (!change) return;
    this.commit(`change of ${humanize(name)}${this.consoleOnly ? ` for ${this.consoleName}` : ''}`, [change], `var.${name}${this.consoleOnly ? `@${this.consoleTheme}` : ''}`);
    this.warnShadowed(this.res?.varHistory.get(name));
  }

  removeProp(elementName: string, prop: string) {
    const def = this.currentView?.elements.get(elementName)?.props.get(prop);
    if (!def) return;
    this.commit(`removing ${propLabel(prop).toLowerCase()}`, [{ file: def.file, patch: patchRemoveNode(def.file.doc, def.node) }]);
  }

  addElement(type: string) {
    const p = this.project;
    const res = this.res;
    if (!p || !res) return;
    const name = uniqueName(res, this.view, type === 'text' ? 'label' : type);
    const body = STARTER_PROPS[type] ?? '<pos>0.4 0.4</pos>\n<size>0.2 0.2</size>';
    if (this.gameEditing) {
      if (this.gameSet(`adding ${typeLabel(type).toLowerCase()}`, [{ name, type, props: {}, extra: true, body }])) this.selected = name;
      return;
    }
    this.commit(`adding ${typeLabel(type).toLowerCase()}`, [addElementChange(p, res, this.view, type, name, body)]);
    this.selected = name;
  }

  /**
   * Adds a ready-made element that reads RetroBat's data. A native element that's already on the
   * screen is selected (and shown, if hidden) instead of added twice.
   */
  addLibraryItem(item: LibraryItem) {
    const p = this.project;
    const res = this.res;
    if (!p || !res) return;
    const existing = this.currentView?.elements.get(item.name);
    if (existing && item.native) {
      this.selected = item.name;
      const vis = existing.props.get('visible')?.value.trim().toLowerCase();
      if (vis === 'false' || vis === '0') {
        this.setProp(item.name, 'visible', 'true');
        this.notify(`${item.label} was hidden on this screen; it's visible again`);
      } else {
        this.notify(`${item.label} is already on this screen, so it's selected`);
      }
      return;
    }
    const name = item.native ? item.name : uniqueName(res, this.view, item.name);
    if (this.gameEditing) {
      if (this.gameSet(`adding ${item.label.toLowerCase()}`, [{ name, type: item.type, props: {}, extra: !item.native, body: item.body }])) this.selected = name;
      return;
    }
    this.commit(`adding ${item.label.toLowerCase()}`, [addElementChange(p, res, this.view, item.type, name, item.body, !item.native)]);
    this.selected = name;
  }

  // ---- featured games: one real game's video and cover together on the system screen ----

  showFeatured = $state(false);
  showMediaCheck = $state(false);

  // ---- theme health check (editor/health.ts) ----

  showHealth = $state(false);
  /** The Save as my design dialog. */
  showSaveDesign = $state(false);
  /** What the check opened before (Try it in RetroBat, Export), to carry on with. */
  healthThen = $state.raw<{ label: string; run: () => void } | null>(null);
  /** Issues ignored on purpose, by theme folder. */
  healthIgnored = $state.raw<Record<string, string[]>>(readJson('ccs.healthIgnore'));

  /** Everything the check finds, ignored ones included. Worked out only while something reads it. */
  healthAll = $derived.by<HealthIssue[]>(() => {
    this.rev;
    const p = this.project;
    const res = this.themeRes;
    if (!p || !res) return [];
    const list = checkTheme(p, res, this.env);
    const r = this.readability;
    if (r && !r.ok) list.unshift({ kind: 'hard-to-read', key: 'hard-to-read', text: `Text is hard to read on the background (contrast ${r.ratio}:1; 3 or more reads well).`, views: [], element: '', fix: { label: 'Make it readable', changes: [] } });
    return list;
  });

  healthIssues = $derived(this.healthAll.filter((i) => !(this.healthIgnored[this.project?.dir ?? ''] ?? []).includes(i.key)));

  /** Hides an issue for this theme (or shows it again), remembered on this PC. */
  ignoreHealth(issue: HealthIssue, on = true) {
    const dir = this.project?.dir;
    if (!dir) return;
    const had = (this.healthIgnored[dir] ?? []).filter((k) => k !== issue.key);
    this.healthIgnored = { ...this.healthIgnored, [dir]: on ? [...had, issue.key] : had };
    writePref('ccs.healthIgnore', JSON.stringify(this.healthIgnored));
  }

  /** Shows every ignored issue of this theme again. */
  unignoreHealth() {
    const dir = this.project?.dir;
    if (!dir) return;
    const { [dir]: _, ...rest } = this.healthIgnored;
    this.healthIgnored = rest;
    writePref('ccs.healthIgnore', JSON.stringify(rest));
  }

  /** The featured-game choices and pairs saved in this theme. */
  get featured(): FeaturedState {
    this.rev;
    return readFeatured(this.project?.fileAt(FEATURED_FILE)?.src);
  }

  // ---- design artwork follows the design colours ----

  /** What the design artwork on disk was drawn with, per theme folder ('' = not known yet). */
  #artDrawn = new Map<string, string>();
  #artTimer: ReturnType<typeof setTimeout> | null = null;

  /** The image grid's tile style on this screen ('' for one ChannelCraft didn't make), or null without a grid. */
  get tileStyle(): string | null {
    const v = this.currentView;
    if (!v || ![...v.elements.values()].some((e) => e.type === 'imagegrid')) return null;
    return tileStyleOfPath(v.elements.get('default')?.props.get('backgroundImage')?.value) ?? '';
  }

  /**
   * Redraws a design theme's artwork (background, panels, tiles) when its design colours change,
   * from a palette, the Colours tab or undo, so the picture never keeps the old colours.
   * The first call for a theme only notes what the artwork was drawn with.
   */
  syncDesignArt() {
    const p = this.project;
    const now = this.designArtNow();
    if (!p || !now) return;
    const drawn = this.#artDrawn.get(p.dir);
    if (drawn === undefined) return void this.#artDrawn.set(p.dir, now.key);
    if (drawn === now.key) return;
    if (this.#artTimer) clearTimeout(this.#artTimer);
    this.#artTimer = setTimeout(async () => {
      this.#artTimer = null;
      const again = this.designArtNow();
      if (this.project !== p || !again || this.#artDrawn.get(p.dir) === again.key) return;
      this.#artDrawn.set(p.dir, again.key);
      for (const j of again.jobs) await this.writeArt(j.dir, j.files());
    }, 350);
  }

  // ---- depth (see theme/depth.ts) ----

  /** This design theme's depth, or null for a theme that wasn't made from a design. */
  get depth(): Depth | null {
    const res = this.themeRes ?? this.res;
    if (!res?.vars.has('designAccent')) return null;
    return depthLevel(res.vars.get(DEPTH_VAR)?.value).id;
  }

  /** The design theme's screen effect (a RetroBat shader over everything). */
  get screenFx(): ScreenFx {
    return screenFxOf((this.themeRes ?? this.res)?.vars.get(SCREEN_FX_VAR)?.value).id;
  }

  /** The design theme's motion feel, or null when it hasn't been set. */
  get motionFeel(): keyof typeof MOTION_FEELS | null {
    const v = (this.themeRes ?? this.res)?.vars.get(MOTION_VAR)?.value.trim();
    return v && v in MOTION_FEELS ? (v as keyof typeof MOTION_FEELS) : null;
  }

  /**
   * Applies a design to the theme's screens. `carry: 'layout'` re-lays out the design that's already
   * there: the theme's colours, fonts, animations, tile style and your own elements all stay.
   * Otherwise your own elements and hidden parts stay, and the design brings its colours (unless it
   * only goes on some screens of a theme that already has design colours).
   */
  async applyDesign(design: Design, opts: { hideOwn?: boolean; views?: string[]; systemLayout?: string; gameLayout?: string; carry?: 'layout' | 'design' | 'none' } = {}) {
    if (this.sharedOnly('Designs')) return;
    const p = this.project;
    if (!p) return;
    if (this.menuGuard()) return;
    // Designs style theme.xml's screens, not the loading screens.
    if (this.screenFile !== 'theme.xml') this.showScreen({ view: this.viewNames.includes('system') ? 'system' : (this.viewNames[0] ?? 'system'), file: 'theme.xml' });
    const artRel = `_inc/ccs/${design.id}`;
    // A depth chosen for this theme stays when another design is applied.
    const depth = this.depth ?? design.depth ?? 'subtle';
    const allViews = [...['system', 'basic', 'detailed', 'video'].filter((v) => this.viewNames.includes(v)), 'grid', 'gamecarousel'];
    const views = opts.views ?? allViews;
    const colours = this.designColours();
    // The theme's own colours stay when only the layout changes, or the design only goes on some screens.
    const keepColours = !!colours && (opts.carry === 'layout' || views.length < allViews.length);
    const wrote = await this.writeArt(artRel, designAssets(keepColours ? recoloured(design, colours!) : design, depth));
    // Drawn in the design's own colours, which the commit below sets: note them afresh.
    if (!keepColours) this.#artDrawn.delete(p.dir);
    task.step('fonts');
    const font = await this.ensureFont(design.font);
    const titleFont = design.titleFont ? await this.ensureFont(design.titleFont) : null;
    // The theme may have been closed while the fonts downloaded.
    if (this.project !== p) return;
    const has = (dir: string) => p.assets.some((a) => a.rel.toLowerCase().startsWith(`${dir}/`));
    const ctx = {
      vars: true,
      art: `./${artRel}`,
      font: font ? `./${font}` : null,
      titleFont: titleFont ? `./${titleFont}` : null,
      logos: has('_inc/systems/logos') ? './_inc/systems/logos' : null,
      consoles: has('_inc/systems/consoles') ? './_inc/systems/consoles' : null,
      depth,
      motion: this.motionFeel ? MOTION_FEELS[this.motionFeel] : undefined,
      screenFx: this.screenFx,
      // A moving background is drawn in the theme's colours: it stays only while they do.
      movingBg: keepColours ? this.movingBgPath() : null,
    };
    this.rev++;
    const res = this.res;
    if (!res) return;
    // A layout on some screens, rather than a whole design with layouts picked for it.
    const layoutId = views.length < allViews.length ? (opts.systemLayout ?? opts.gameLayout) : undefined;
    const label = layoutId ? `“${LAYOUTS.find((l) => l.id === layoutId)?.label ?? layoutId}” in the ${design.label} style` : `design “${design.label}”`;
    const carry = opts.carry === 'none' ? undefined : (opts.carry ?? 'design');
    const changes = designChanges(p, res, design, ctx, views, opts.hideOwn ?? true, opts.systemLayout, { gameLayout: opts.gameLayout, carry });
    // The design's colours become shared colours (variables) its parts refer to.
    this.commit(label, keepColours ? changes : [designVarsChange(p, design, depth, this.motionFeel), ...changes]);
    this.selected = null;
    const missingFont = !font ? ' Its font could not be downloaded (offline?), so the theme’s font is used.' : '';
    if (layoutId) {
      const where = opts.systemLayout ? 'the System screen' : views.map((v) => viewLabel(v)).join(', ');
      return this.notify(wrote ? `${label[0].toUpperCase()}${label.slice(1)} applied to ${where}.${keepColours ? ' Your colours stay.' : ''}${missingFont} Save to keep it, or Ctrl+Z to undo.` : `${label} applied in the preview only (files can’t be written here).`);
    }
    this.notify(wrote ? `Design “${design.label}” applied.${missingFont} Save to keep it, or Ctrl+Z to undo.` : `Design “${design.label}” applied in the preview only (files can’t be written here).`);
  }

  // ---- RetroBat menu options: choices RetroBat shows in its Theme Configuration menu ----

  showMenuOptions = $state(false);

  /** The design and console-screen layout menu options are built from, if the theme has one. */
  get menuBase(): { design: Design; systemLayout: string } | null {
    const p = this.project;
    if (!p) return null;
    const state = readMenuState(p);
    const design = state ? DESIGNS.find((d) => d.id === state.design) : (appliedDesign(p, 'detailed') ?? appliedDesign(p, 'system'));
    if (!design) return null;
    return { design, systemLayout: state?.systemViews[0] ?? appliedSystemLayout(p) ?? design.system };
  }

  get menuState(): MenuState | null {
    return this.project ? readMenuState(this.project) : null;
  }

  /**
   * Finds the folders of system logos and console pictures in an installed theme, by counting
   * image files named after systems.
   */
  /** @internal */
  consoleArtCache = new Map<string, Promise<{ logos: string | null; consoles: string | null; logoCount: number; consoleCount: number }>>();

  /** The theme's own screen transition (`<theme defaultTransition="...">`), or "" for RetroBat's. */
  get themeTransition(): string {
    this.rev;
    const root = this.project?.fileAt('theme.xml')?.doc.root;
    return (root && attr(root, 'defaultTransition')) || '';
  }

  /**
   * How RetroBat moves between consoles: its own Transition Style, or the theme's when that is
   * Auto, else a slide.
   */
  get transition(): 'slide' | 'fade' | 'instant' {
    const own = (this.root?.es?.transitionStyle ?? 'auto').toLowerCase();
    const v = own !== 'auto' && own ? own : this.themeTransition.toLowerCase();
    return v.includes('fade') ? 'fade' : v === 'instant' ? 'instant' : 'slide';
  }

  /** Sets every colour of a palette that this theme has a variable for. Returns how many were set. */
  /** How readable a design theme's text is on its background and panels, or null for other themes. */
  get readability() {
    const c = this.designColours();
    return c ? readability(c) : null;
  }

  // ---- asset library -----------------------------------------------------------------------

  /** The user's own pictures, videos, sounds and fonts (in the app's data folder, not a theme). */
  library = $state.raw<LibraryAsset[]>([]);
  libraryLoaded = $state(false);

  // ---- saving ------------------------------------------------------------------------------

  /** @internal */
  lastSave = Date.now();
  /** @internal */
  autosaveTimer: ReturnType<typeof setInterval> | undefined;

  // ---- misc --------------------------------------------------------------------------------

  showInSource(file: ThemeFile, offset: number) {
    if (this.mode === 'simple') this.setMode('advanced');
    this.sourceFile = file.key;
    let line = 1;
    for (let i = 0; i < offset && i < file.src.length; i++) if (file.src.charCodeAt(i) === 10) line++;
    this.sourceLine = line;
    this.showSource = true;
  }

  notify(text: string, kind: Toast['kind'] = 'info', ms?: number, action?: Toast['action']) {
    clearTimeout(this.toastTimer);
    this.toast = { text, kind, id: Date.now(), ms, action };
    this.toastTimer = setTimeout(() => (this.toast = null), ms ?? (kind === 'error' ? 8000 : 2800));
  }
}

// Parts of the editor kept in their own files: each function there is a method of Editor.
type Methods<T> = { [K in keyof T]: T[K] extends (this: Editor, ...args: infer A) => infer R ? (...args: A) => R : never };
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Editor extends Methods<typeof look>, Methods<typeof parts>, Methods<typeof gameLook>, Methods<typeof assets>, Methods<typeof saving>, Methods<typeof restyle>, Methods<typeof themeOptions>, Methods<typeof health>, Methods<typeof sharing>, Methods<typeof sound> {}
Object.assign(Editor.prototype, look, parts, gameLook, assets, saving, restyle, themeOptions, health, sharing, sound);

export const ed = new Editor();
