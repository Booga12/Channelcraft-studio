import { load, type Store } from '@tauri-apps/plugin-store';
import { ask, open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { api, registerVirtualFile, tauriFs, type LibraryAsset, type RootInfo, type ThemeInfo } from './api';
import { svgToPngBase64 } from './raster';
import { join, relative, dirname, pathKey, basename } from './path';
import { addsAsNew, ASSET_KIND_LABEL, ASSET_THEME_DIR, dropFit, dropPropLabel, kindOfFile, nameFromFile, newAssetBody, pastedFormat, pastedPath, type AssetKind } from './theme/assetDrop';
import { parseGamelist, type GameInfo } from './theme/games';
import { screenSize, type Environment, type PreviewSettings } from './theme/context';
import { addElementChange, addPropChange, applyChanges, insertTarget, inverse, OverlapError, setTextChange, uniqueName, varRef, type Applied, type Change } from './theme/edits';
import { ThemeProject, type ThemeFile } from './theme/project';
import { isGameListView, isOwnGamePath, perGameApplies, resolveTheme, romStem, type PerGameInfo, type ResolvedElement, type Resolution, type Source } from './theme/resolver';
import { applyToText, copyOfShared, draftFile, EMPTY_GAME_FILE, GAMES_README, gameEditChanges, gameExtrasChange, ownFileGuards, screensWithoutGameExtras, type GameEdit } from './theme/perGame';
import { fmtNum, parsePair, STARTER_PROPS, VIEW_ORDER } from './theme/schema';
import { zOf } from './render';
import { ANIMATIONS, boardsXml, EXIT_EVENTS, EXITS, presetOf, retune, screenOf, STILL_TYPES, storyboardXml, tuningOf } from './theme/animations';
import { DEPTH_VAR, depthLevel, FRAMED, MOTION_FEELS, MOTION_VAR, PARALLAX, PARALLAX_ANIM, SCREEN_FX_VAR, screenFxOf, SHADOWED, type Depth, type ScreenFx } from './theme/depth';
import { FALLBACK_SYSTEMS, parseEsSystems, type SystemInfo } from './theme/systems';
import { attr, elements, patchInsertChild, patchRemoveAttr, patchRemoveNode, patchReplaceSpan, patchSetAttr, type XElement } from './xml/cst';
import { SHADOW_TYPES, shaderOf, shadowXml } from './theme/shadow';
import { glowProps, hex8, snapPos, type Glow, type PictureLook, type SnapX, type SnapY, type TextLook } from './theme/simpleProps';
import { frameOf, frameXml, type Frame } from './theme/frame';

/** A file's bytes as base64 (no data: prefix). */
async function blobBase64(blob: Blob): Promise<string> {
  const url = await new Promise<string>((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => bad(r.error);
    r.readAsDataURL(blob);
  });
  return url.slice(url.indexOf(',') + 1);
}

/** A number with at most four decimals, as theme files write them. */
const r4 = (v: number) => String(Math.round(v * 10000) / 10000);
import { elementLabel, humanize, propLabel, typeLabel, viewLabel } from './friendly';
import { consoleScreenPath, isDataBound, NATIVE_BINDINGS, type LibraryItem } from './theme/library';
import { prefs } from './prefs.svelte';
import { reorder, zIndexFor } from './theme/layers';
import { TILE_DIR, TILE_STYLES, tileArt, tileColoursFrom, tileStyleOfPath, tileStyleProps, type TileColours } from './theme/tiles';
import { appliedDesign, appliedGameLayout, appliedSystemLayout, coloursFromVars, hidesOwn, readability, designChanges, designVarsChange, LAYOUTS, layoutChanges, paletteDesignVars, type LayoutPreset, type Palette } from './theme/presets';
import { planMenuOptions, readMenuState, type MenuChoices, type MenuState } from './theme/menuOptions';
import { SYSTEM_LAYOUTS } from './theme/systemLayouts';
import { GAME_LAYOUTS } from './theme/gameLayouts';
import { DESIGNS, designAssets, depthLogoScale, GAME_VIEWS, recoloured, type Design } from './theme/designs';
import { catalogFont } from './theme/fonts';
import { withOnlineArt } from './theme/libretro';
import { addConsoleProp, addConsoleVar, consoleValues, overrideIn, sharedIn, type ConsoleValue } from './theme/consoles';
import { COVER_EL, FEATURED_FILE, FEATURED_MEDIA, featuredXml, pickGame, readFeatured, VIDEO_EL, type Choice, type FeaturedState } from './theme/featured';
import { task } from './task.svelte';
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

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are a convenience; ignore storage failures.
  }
}

class Editor {
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

  showPanel(id: 'elements' | 'library' | 'assets' | 'presets' | 'options' | 'variables' | 'files' | 'history' | 'properties') {
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
  leftTab = $state<'elements' | 'library' | 'assets' | 'presets' | 'options' | 'variables' | 'files' | 'history' | 'properties'>('elements');
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
  /** Whether the getting-started guide is open. */
  showGuide = $state(readPref('ccs.guideDone') !== '1');
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

  setAskCopy(v: boolean) {
    this.askCopy = v;
    writePref('ccs.askCopy', v ? '1' : '0');
  }

  get simple() {
    return this.mode === 'simple';
  }

  private undoStack = $state.raw<HistoryEntry[]>([]);
  private redoStack = $state.raw<HistoryEntry[]>([]);

  /** Forgets undo history (it belongs to the theme it was made in). */
  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
  }
  private backedUp = new Set<string>();
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
  private varChange(name: string, value: string): Change | null {
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
  private propChanges(elementName: string, props: Record<string, string>): Change[] {
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

  /** The current game's own file for this screen: the one RetroBat would find, or where a new one goes. */
  gameFilePath(): string | null {
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

  private gameSetMany(label: string, updates: Record<string, Record<string, string>>, coalesce?: string) {
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
  private gameSet(label: string, edits: GameEdit[], coalesce?: string): boolean {
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
  resetGame() {
    const f = this.gameFile;
    if (!f) return;
    this.commit(`${this.gameName}'s own look`, [{ file: f, patch: { start: 0, end: f.src.length, text: '' } }]);
    this.notify(`${this.gameName} uses the shared look again. Saving deletes its own file (${f.rel}); Ctrl+Z undoes it.`);
  }

  /** Where RetroBat would look for another game's own file, following the current game's. */
  private ownFileFor(info: PerGameInfo, stem: string): ThemeFile | null {
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
  async makeGameFolders(themeDir: string) {
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

  /** Sets several properties of one element as a single undo step. */
  setProps(elementName: string, props: Record<string, string>, coalesce?: string) {
    if (this.gameEditing) return void this.gameSetMany(`changes to ${elementLabel(elementName)}`, { [elementName]: props }, coalesce);
    this.commit(`changes to ${elementLabel(elementName)}`, this.propChanges(elementName, props), coalesce);
  }

  /** Sets properties on several elements at once (group moves, align, distribute). */
  setPropsMany(label: string, updates: Record<string, Record<string, string>>, coalesce?: string) {
    if (this.gameEditing) return void this.gameSetMany(label, updates, coalesce);
    const changes = Object.entries(updates).flatMap(([name, props]) => this.propChanges(name, props));
    this.commit(label, changes, coalesce);
  }

  /** Moves every selected element by (dx, dy) screen fractions from the given start positions. */
  moveSelection(start: Record<string, [number, number]>, dx: number, dy: number, coalesce: string) {
    const r = (n: number) => String(Math.round(n * 1000) / 1000);
    const updates: Record<string, Record<string, string>> = {};
    for (const [name, [x, y]] of Object.entries(start)) updates[name] = { pos: `${r(x + dx)} ${r(y + dy)}` };
    this.setPropsMany(this.selection.length > 1 ? `moving ${this.selection.length} elements` : `position of ${elementLabel(this.selected ?? '')}`, updates, coalesce);
  }

  nudge(dx: number, dy: number) {
    const start: Record<string, [number, number]> = {};
    for (const n of this.selection) {
      const el = this.currentView?.elements.get(n);
      if (el && !this.locked[n]) start[n] = parsePair(el.props.get('pos')?.value) ?? [0, 0];
    }
    if (Object.keys(start).length) this.moveSelection(start, dx, dy, `nudge.${this.selection.join(',')}`);
  }

  /** Aligns the selection (one element: to the screen; several: to each other). */
  align(mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') {
    const names = this.selection.filter((n) => this.rects[n] && !this.locked[n]);
    if (!names.length) return;
    const rs = names.map((n) => this.rects[n]);
    const toScreen = names.length === 1;
    const minX = toScreen ? 0 : Math.min(...rs.map((r) => r.x));
    const maxX = toScreen ? 1 : Math.max(...rs.map((r) => r.x + r.w));
    const minY = toScreen ? 0 : Math.min(...rs.map((r) => r.y));
    const maxY = toScreen ? 1 : Math.max(...rs.map((r) => r.y + r.h));
    const updates: Record<string, Record<string, string>> = {};
    for (const n of names) {
      const el = this.currentView!.elements.get(n)!;
      const r = this.rects[n];
      const [x, y] = parsePair(el.props.get('pos')?.value) ?? [0, 0];
      let nx = x;
      let ny = y;
      if (mode === 'left') nx = x + (minX - r.x);
      if (mode === 'right') nx = x + (maxX - (r.x + r.w));
      if (mode === 'hcenter') nx = x + ((minX + maxX) / 2 - (r.x + r.w / 2));
      if (mode === 'top') ny = y + (minY - r.y);
      if (mode === 'bottom') ny = y + (maxY - (r.y + r.h));
      if (mode === 'vcenter') ny = y + ((minY + maxY) / 2 - (r.y + r.h / 2));
      updates[n] = { pos: `${fmtNum(Math.round(nx * 1000) / 1000)} ${fmtNum(Math.round(ny * 1000) / 1000)}` };
    }
    this.setPropsMany('align', updates);
  }

  /** Spaces three or more selected elements evenly. */
  distribute(axis: 'h' | 'v') {
    const names = this.selection.filter((n) => this.rects[n] && !this.locked[n]);
    if (names.length < 3) {
      this.notify('Select three or more elements to space them evenly');
      return;
    }
    const key = axis === 'h' ? 'x' : 'y';
    const size = axis === 'h' ? 'w' : 'h';
    const sorted = [...names].sort((a, b) => this.rects[a][key] - this.rects[b][key]);
    const first = this.rects[sorted[0]];
    const last = this.rects[sorted[sorted.length - 1]];
    const total = sorted.reduce((s, n) => s + this.rects[n][size], 0);
    const gap = (last[key] + last[size] - first[key] - total) / (sorted.length - 1);
    let cursor = first[key];
    const updates: Record<string, Record<string, string>> = {};
    for (const n of sorted) {
      const r = this.rects[n];
      const el = this.currentView!.elements.get(n)!;
      const [x, y] = parsePair(el.props.get('pos')?.value) ?? [0, 0];
      const d = cursor - r[key];
      updates[n] = { pos: axis === 'h' ? `${fmtNum(Math.round((x + d) * 1000) / 1000)} ${fmtNum(y)}` : `${fmtNum(x)} ${fmtNum(Math.round((y + d) * 1000) / 1000)}` };
      cursor += r[size] + gap;
    }
    this.setPropsMany('distribute', updates);
  }

  /** Layer order: 'front', 'back', or one step 'forward' / 'backward'. */
  arrange(how: 'front' | 'back' | 'forward' | 'backward') {
    const v = this.currentView;
    if (!v || !this.selection.length) return;
    const all = [...v.elements.values()].map((e) => ({ name: e.name, z: zOf(e) }));
    const zs = all.map((a) => a.z);
    const updates: Record<string, Record<string, string>> = {};
    for (const n of this.selection) {
      const el = v.elements.get(n);
      if (!el) continue;
      const z = zOf(el);
      let nz = z;
      if (how === 'front') nz = Math.max(...zs) + 1;
      if (how === 'back') nz = Math.max(0, Math.min(...zs) - 1);
      if (how === 'forward') nz = (zs.filter((x) => x > z).sort((a, b) => a - b)[0] ?? z) + 1;
      if (how === 'backward') nz = Math.max(0, (zs.filter((x) => x < z).sort((a, b) => b - a)[0] ?? z) - 1);
      updates[n] = { zIndex: String(nz) };
    }
    this.setPropsMany('layer order', updates);
  }

  /** The screen's layers top first, as RetroBat draws them (zIndex, then later in the files on top). */
  get layers(): ResolvedElement[] {
    const v = this.currentView;
    if (!v) return [];
    return [...v.elements.values()].filter((e) => e.type !== 'gameextras').sort((a, b) => zOf(b) - zOf(a) || b.order - a.order);
  }

  /**
   * Moves layers (Layers panel drag and drop) so they sit just above `before`, or at the bottom
   * when it's null, keeping their own order. One undo step.
   */
  moveLayers(names: string[], before: string | null) {
    const layers = this.layers.map((e) => ({ name: e.name, z: zOf(e) }));
    const moving = layers.filter((l) => names.includes(l.name)).map((l) => l.name);
    if (!moving.length || (before !== null && moving.includes(before))) return;
    const order = reorder(layers, moving, before);
    if (order.every((l, i) => l.name === layers[i].name)) return;
    const z = zIndexFor(order, new Set(moving));
    const updates = Object.fromEntries(Object.entries(z).map(([n, v]) => [n, { zIndex: String(v) }]));
    this.setPropsMany(moving.length > 1 ? `layer order of ${moving.length} layers` : `layer order of ${elementLabel(moving[0])}`, updates);
  }

  // ---- clipboard ----

  private clipboard: { type: string; name: string; props: Record<string, string> }[] = [];

  /** Properties of an element as written, with relative paths made relative to theme.xml. */
  private snapshotElement(name: string) {
    const el = this.currentView?.elements.get(name);
    const p = this.project;
    if (!el || !p) return null;
    const props: Record<string, string> = {};
    for (const [k, def] of el.props) {
      let v = def.raw;
      if (/^\.\.?\//.test(def.value.trim()) && !v.includes('${')) v = relative(p.dir, join(dirname(def.file.abs), def.value.trim()));
      props[k] = v;
    }
    // RetroBat's own artwork elements become regular elements that read the same data.
    const binding = NATIVE_BINDINGS[name];
    if (binding && !props[binding.prop]) props[binding.prop] = binding.value;
    return { type: el.type, name: el.name, props };
  }

  copy() {
    const items = this.selection.map((n) => this.snapshotElement(n)).filter((x): x is NonNullable<typeof x> => !!x);
    if (!items.length) return;
    this.clipboard = items;
    this.notify(`Copied ${items.length === 1 ? elementLabel(items[0].name) : `${items.length} elements`}`);
  }

  /** Pastes copies a little down and to the right, as new elements on this screen. */
  paste(offset = 0.02) {
    const p = this.project;
    const res = this.res;
    if (!p || !res || !this.clipboard.length) return;
    const changes: Change[] = [];
    const names: string[] = [];
    const used = new Set(this.currentView?.elements.keys() ?? []);
    for (const item of this.clipboard) {
      const base = item.name.replace(/^md_/, '').replace(/\d+$/, '') || item.type;
      let name = base;
      for (let i = 2; used.has(name); i++) name = `${base}${i}`;
      used.add(name);
      const props = { ...item.props };
      // The console screen has no current game: game artwork becomes a random game's (as RetroBat offers there).
      if (this.view === 'system' && props.path) props.path = consoleScreenPath(item.type, props.path) ?? props.path;
      const pos = parsePair(props.pos);
      if (pos) props.pos = `${fmtNum(Math.round((pos[0] + offset) * 1000) / 1000)} ${fmtNum(Math.round((pos[1] + offset) * 1000) / 1000)}`;
      const body = Object.entries(props)
        .map(([k, v]) => `<${k}>${v.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</${k}>`)
        .join('\n');
      changes.push(addElementChange(p, res, this.view, item.type, name, body));
      names.push(name);
    }
    this.commit(names.length === 1 ? `pasting ${elementLabel(names[0])}` : `pasting ${names.length} elements`, changes);
    this.selection = names;
  }

  duplicate() {
    const saved = this.clipboard;
    this.copy();
    this.paste();
    this.clipboard = saved;
  }

  /** Renames an element of this theme (RetroBat's own elements keep their names). */
  rename(name: string, next: string) {
    const el = this.currentView?.elements.get(name);
    const clean = next.trim().replace(/[^\w-]+/g, '-');
    if (!el || !clean || clean === name) return;
    if (!el.extra) {
      this.notify('RetroBat’s own elements keep their names, so RetroBat can fill them in', 'error');
      return;
    }
    if (this.currentView?.elements.has(clean)) {
      this.notify(`There's already an element called “${clean}” on this screen`, 'error');
      return;
    }
    const changes: Change[] = [];
    const seen = new Set<string>();
    for (const d of el.defs) {
      const id = `${d.file.key}:${d.node.start}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const names = (d.node.attrs.find((a) => a.name === 'name')?.value ?? '').split(',').map((s) => s.trim());
      changes.push({ file: d.file, patch: patchSetAttr(d.file.doc, d.node, 'name', names.map((n) => (n === name ? clean : n)).join(', ')) });
    }
    this.commit(`renaming to ${clean}`, changes);
    this.selected = clean;
  }

  /** Adds, replaces or removes (null) the animation of an element. */
  setAnimation(name: string, presetId: string | null) {
    const el = this.currentView?.elements.get(name);
    if (!el) return;
    const target = insertTarget(el, this.view);
    if (!target) return;
    // The exit storyboards are kept; the main motion is replaced.
    const existing = el.complex.filter((c) => c.name === 'storyboard' && c.node.parent === target.node && !EXIT_EVENTS.has(attr(c.node, 'event') ?? ''));
    const preset = ANIMATIONS.find((a) => a.id === presetId);
    const removeAll = (list: typeof existing): Change[] => list.map((c) => ({ file: c.file, patch: patchRemoveNode(c.file.doc, c.node) }));
    if (!preset) {
      if (existing.length) this.commit('removing animation', removeAll(existing));
      return;
    }
    if (preset.kind !== 'entrance' && STILL_TYPES.has(el.type)) {
      this.notify('Videos stay still: looping motion makes them stutter. Animate the frame around the video instead.', 'error');
      return;
    }
    const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
    const xml = storyboardXml(preset, pos, 1, 1, screenOf(this.view));
    this.commit(`animation “${preset.label}”`, this.replaceBoards(existing, target, xml, removeAll));
    // Shown straight away, as it will look when you move to a game or console in RetroBat.
    this.replayAnimations();
  }

  /** Replaces the first storyboard in place (the others go), or adds the markup. */
  private replaceBoards(existing: ResolvedElement['complex'], target: { file: ThemeFile; node: XElement }, xml: string, removeAll: (l: ResolvedElement['complex']) => Change[]): Change[] {
    return existing.length
      ? [{ file: existing[0].file, patch: patchReplaceSpan(existing[0].file.doc, existing[0].node, existing[0].node, xml) }, ...removeAll(existing.slice(1))]
      : [{ file: target.file, patch: patchInsertChild(target.file.doc, target.node, xml) }];
  }

  /** Adds, replaces or removes (null) how an element leaves a game in a game list. */
  setExit(name: string, exitId: string | null) {
    const el = this.currentView?.elements.get(name);
    if (!el) return;
    if (screenOf(this.view) === 'console') {
      this.notify('RetroBat only plays leaving animations in game lists.', 'error');
      return;
    }
    const target = insertTarget(el, this.view);
    if (!target) return;
    const existing = el.complex.filter((c) => c.name === 'storyboard' && c.node.parent === target.node && EXIT_EVENTS.has(attr(c.node, 'event') ?? ''));
    const removeAll = (list: typeof existing): Change[] => list.map((c) => ({ file: c.file, patch: patchRemoveNode(c.file.doc, c.node) }));
    const exit = EXITS.find((x) => x.id === exitId);
    if (!exit) {
      if (existing.length) this.commit('removing the leaving animation', removeAll(existing));
      return;
    }
    const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
    this.commit(`leaving animation “${exit.label}”`, this.replaceBoards(existing, target, boardsXml(exit.build(pos, 1)), removeAll));
  }

  /** Rewrites an animation RetroBat never plays on this screen so that it does. */
  fixAnimation(name: string) {
    const el = this.currentView?.elements.get(name);
    const t = el ? tuningOf(el, screenOf(this.view)) : null;
    if (!el || !t) return;
    const target = insertTarget(el, this.view);
    if (!target) return;
    const existing = el.complex.filter((c) => c.name === 'storyboard' && c.node.parent === target.node);
    const removeAll = (list: typeof existing): Change[] => list.map((c) => ({ file: c.file, patch: patchRemoveNode(c.file.doc, c.node) }));
    const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
    this.commit(`animation “${t.preset.label}” made to play here`, this.replaceBoards(existing, target, storyboardXml(t.preset, pos, t.amount, t.speed, screenOf(this.view)), removeAll));
    this.playAnimations = true;
  }

  /** Adds, changes or removes (null) RetroBat's drop shadow on a picture. */
  setShadow(name: string, offset: number | null, coalesce?: string) {
    const el = this.currentView?.elements.get(name);
    if (!el) return;
    const sh = shaderOf(el);
    if (sh && !sh.shadow) {
      this.notify('This picture already uses another RetroBat shader, so a shadow can’t be added. Remove that shader in Advanced mode first.', 'error');
      return;
    }
    if (offset === null) {
      if (sh) this.commit(`removing the shadow of ${elementLabel(name)}`, [{ file: sh.def.file, patch: patchRemoveNode(sh.def.file.doc, sh.def.node) }]);
      return;
    }
    const xml = shadowXml(offset);
    if (sh) {
      const off = elements(sh.def.node).find((n) => n.name === 'shadowOffset');
      const change: Change = off ? setTextChange(sh.def.file, off, String(Math.round(offset))) : { file: sh.def.file, patch: patchReplaceSpan(sh.def.file.doc, sh.def.node, sh.def.node, xml) };
      this.commit(`shadow of ${elementLabel(name)}`, [change], coalesce);
      return;
    }
    const target = insertTarget(el, this.view);
    if (!target) return;
    this.commit(`shadow on ${elementLabel(name)}`, [{ file: target.file, patch: patchInsertChild(target.file.doc, target.node, xml) }]);
  }

  /**
   * Adds, changes or removes (null) a frame (RetroBat's border shader) on a picture or video.
   * Its corners take over from `roundCorners`, and go back to it when the frame is removed.
   */
  setFrame(name: string, frame: Frame | null, coalesce?: string) {
    const el = this.currentView?.elements.get(name);
    if (!el) return;
    const now = frameOf(el);
    const sh = shaderOf(el);
    if (sh && !now && !sh.shadow) {
      this.notify('This picture already uses another RetroBat shader, so it can’t have a frame. Remove that shader in Advanced mode first.', 'error');
      return;
    }
    const round = el.props.get('roundCorners');
    // A picture has one RetroBat shader, and the frame draws its own shadow: it takes the soft
    // shadow's place (and the place of roundCorners, which the frame's corners replace).
    if (frame && sh?.shadow && !now) {
      const { file, node } = sh.def;
      const ownRound = round && round.node.parent === node.parent ? [{ file: round.file, patch: patchRemoveNode(round.file.doc, round.node) }] : [];
      this.commit(`frame on ${elementLabel(name)}`, [{ file, patch: patchReplaceSpan(file.doc, node, node, frameXml(frame)) }, ...ownRound]);
      return;
    }
    if (!frame) {
      if (!now) return;
      const { file, node } = now.def;
      const corners = now.frame.corners > 0 ? r4(now.frame.corners) : null;
      // The frame's corners stay as roundCorners: in place of the shader, or in the existing setting.
      const changes: Change[] =
        corners && !round
          ? [{ file, patch: patchReplaceSpan(file.doc, node, node, `<roundCorners>${corners}</roundCorners>`) }]
          : [{ file, patch: patchRemoveNode(file.doc, node) }, ...(corners && round ? [setTextChange(round.file, round.node, corners)] : [])];
      this.commit(`removing the frame of ${elementLabel(name)}`, changes);
      return;
    }
    const xml = frameXml(frame);
    if (now) {
      this.commit(`frame of ${elementLabel(name)}`, [{ file: now.def.file, patch: patchReplaceSpan(now.def.file.doc, now.def.node, now.def.node, xml) }], coalesce);
      return;
    }
    const target = insertTarget(el, this.view);
    if (!target) return;
    // The frame's corners replace roundCorners (both at once would round twice): the shader goes
    // in its place, as one edit.
    const own = round && round.file === target.file && round.node.parent === target.node;
    const change: Change = own ? { file: round.file, patch: patchReplaceSpan(round.file.doc, round.node, round.node, xml) } : { file: target.file, patch: patchInsertChild(target.file.doc, target.node, xml) };
    this.commit(`frame on ${elementLabel(name)}`, [change]);
  }

  /** Sets rounded corners: in the frame when there is one, else RetroBat's roundCorners (0 removes). */
  setCorners(name: string, corners: number, coalesce?: string) {
    const el = this.currentView?.elements.get(name);
    if (!el) return;
    const f = frameOf(el);
    if (f) return this.setFrame(name, { ...f.frame, corners }, coalesce);
    if (corners <= 0) return el.props.get('roundCorners') ? this.removeProp(name, 'roundCorners') : undefined;
    this.setProp(name, 'roundCorners', r4(corners), { coalesce });
  }

  /**
   * Makes an element's animation bigger or smaller and faster or slower, editing its storyboard's
   * from/to/duration in place (other attributes such as `begin` stay). With `all`, every element
   * on this screen with the same kind of animation gets the same size and speed.
   */
  tuneAnimation(name: string, amount: number, speed: number, opts: { all?: boolean; coalesce?: string } = {}) {
    const view = this.currentView;
    const el = view?.elements.get(name);
    const screen = screenOf(this.view);
    const mine = el ? tuningOf(el, screen) : null;
    if (!view || !mine) return;
    const targets = opts.all ? [...view.elements.values()].filter((e) => tuningOf(e, screen)?.preset.id === mine.preset.id) : [el!];
    const changes: Change[] = [];
    const seen = new Set<XElement>();
    for (const e of targets) {
      const t = tuningOf(e, screen)!;
      if (seen.has(t.storyboards[0])) continue;
      seen.add(t.storyboards[0]);
      const pos = parsePair(e.props.get('pos')?.value) ?? [0, 0];
      for (const a of retune(t, pos, amount, speed, screen)) {
        const def = e.complex.find((c) => t.storyboards.includes(c.node) && elements(c.node).includes(a.node))!;
        changes.push({ file: def.file, patch: patchSetAttr(def.file.doc, a.node, a.name, a.value) });
      }
    }
    if (!changes.length) return;
    this.commit(opts.all ? `motion of every “${mine.preset.label}”` : `motion of ${elementLabel(name)}`, changes, opts.coalesce);
    this.playAnimations = true;
  }

  /** When an element's entrance starts, in milliseconds after it shows (each animation's `begin`). */
  setAnimationDelay(name: string, ms: number) {
    const el = this.currentView?.elements.get(name);
    const t = el ? tuningOf(el, screenOf(this.view)) : null;
    if (!el || !t || t.preset.kind !== 'entrance') return;
    const changes: Change[] = [];
    t.animations.forEach((list, i) => {
      const def = el.complex.find((c) => c.node === t.storyboards[i]);
      if (!def) return;
      for (const a of list) {
        const has = attr(a, 'begin') !== undefined;
        if (ms > 0) changes.push({ file: def.file, patch: patchSetAttr(def.file.doc, a, 'begin', String(Math.round(ms))) });
        else if (has) {
          const patch = patchRemoveAttr(def.file.doc, a, 'begin');
          if (patch) changes.push({ file: def.file, patch });
        }
      }
    });
    if (!changes.length) return;
    this.commit(`start time of ${elementLabel(name)}`, changes);
    this.replayAnimations();
  }

  /**
   * Gives every part of the same kind on this screen (texts, or pictures and videos) the animation
   * of `name`, starting one after another from the top down. One undo step.
   */
  animateAllLike(name: string): number {
    const view = this.currentView;
    const el = view?.elements.get(name);
    const t = el ? tuningOf(el, screenOf(this.view)) : null;
    if (!view || !el || !t) return 0;
    const textish = (e: ResolvedElement) => ['text', 'datetime', 'clock'].includes(e.type);
    const pictureish = (e: ResolvedElement) => e.type === 'image' || e.type === 'video';
    const same = textish(el) ? textish : pictureish(el) ? pictureish : (e: ResolvedElement) => e.type === el.type;
    const y = (e: ResolvedElement) => this.rects[e.name]?.y ?? parsePair(e.props.get('pos')?.value)?.[1] ?? 0;
    const names = [...view.elements.values()]
      // Full-screen backgrounds and hidden or locked parts stay as they are.
      .filter((e) => same(e) && !this.locked[e.name] && !(this.rects[e.name]?.w > 0.98 && this.rects[e.name]?.h > 0.98) && this.rects[e.name])
      .sort((a, b) => y(a) - y(b))
      .map((e) => e.name);
    if (names.length < 2) return 0;
    const step = 150;
    this.group(`animation “${t.preset.label}” on ${names.length} parts`, () => {
      names.forEach((n, i) => {
        if (n !== name || presetOf(el, screenOf(this.view)) !== t.preset.id) this.setAnimation(n, t.preset.id);
        const mine = this.currentView?.elements.get(n);
        const tn = mine ? tuningOf(mine, screenOf(this.view)) : null;
        if (tn && (Math.abs(tn.speed - t.speed) > 0.01 || Math.abs(tn.amount - t.amount) > 0.01)) this.tuneAnimation(n, t.amount, t.speed);
        if (t.preset.kind === 'entrance') this.setAnimationDelay(n, Math.min(i, 6) * step);
      });
    });
    this.replayAnimations();
    return names.length;
  }

  /** Moves an element so its box sits at a spot on the screen (a little in from the edges). */
  snapTo(name: string, sx: SnapX, sy: SnapY) {
    const el = this.currentView?.elements.get(name);
    const rect = this.rects[name];
    if (!el || !rect || this.locked[name]) return;
    const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
    const [x, y] = snapPos(rect, pos, sx, sy);
    this.setProp(name, 'pos', `${fmtNum(x)} ${fmtNum(y)}`);
  }

  /** Gives a text a glow or a shadow (or none), in its own colour. */
  setGlow(name: string, glow: Glow) {
    const el = this.currentView?.elements.get(name);
    if (!el) return;
    const props = glowProps(glow, hex8(el.props.get('color')?.value) ?? 'FFFFFFFF', el.props.has('glowOffset'));
    this.setProps(name, props);
  }

  /** A one-click look for a text: a free font (downloaded), capitals and a glow. One undo step. */
  async applyTextLook(name: string, look: TextLook) {
    const font = await this.ensureFont(look.font);
    const el = this.currentView?.elements.get(name);
    if (!el) return;
    const props: Record<string, string> = {
      forceUppercase: look.caps ? 'true' : 'false',
      ...glowProps(look.glow, hex8(el.props.get('color')?.value) ?? 'FFFFFFFF', el.props.has('glowOffset')),
    };
    if (font) props.fontPath = this.relativeAssetPath(name, 'fontPath', join(this.project!.dir, font));
    const label = `look “${look.label}” on ${elementLabel(name)}`;
    if (this.gameEditing) this.gameSetMany(label, { [name]: props });
    else this.commit(label, this.propChanges(name, props));
    if (!font) this.notify('The font could not be downloaded (offline?), so only the rest of the look was used.');
  }

  /** A one-click look for a picture: corners, shadow and see-through. One undo step. */
  applyPictureLook(name: string, look: PictureLook) {
    const el = this.currentView?.elements.get(name);
    if (!el) return;
    this.group(`look “${look.label}” on ${elementLabel(name)}`, () => {
      this.setCorners(name, look.corners);
      if (SHADOW_TYPES.has(el.type) && !frameOf(el)) {
        const sh = shaderOf(el);
        if (!sh || sh.shadow) this.setShadow(name, look.shadow);
      }
      const now = parseFloat(el.props.get('opacity')?.value ?? '1');
      if (Math.abs(now - look.opacity) > 0.001) this.setProp(name, 'opacity', fmtNum(look.opacity));
    });
  }

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
  private sharedOnly(what: string): boolean {
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

  /** The featured-game choices and pairs saved in this theme. */
  get featured(): FeaturedState {
    this.rev;
    return readFeatured(this.project?.fileAt(FEATURED_FILE)?.src);
  }

  /**
   * For each console in `choices`: picks the game (automatic or chosen) whose video and cover both
   * exist, copies the two files into the theme and writes featured.xml, plus the two elements and
   * the include in theme.xml if they're missing. One undo step. Returns problems to show.
   */
  async applyFeatured(choices: Record<string, Choice>): Promise<string[]> {
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

  /** Writes a layout preset into its own block at the end of theme.xml (replacing an earlier one). */
  async applyLayout(preset: LayoutPreset, views: string[], style: Design | null = null, hideOwn = true) {
    if (this.sharedOnly('Layouts')) return;
    if (this.menuGuard()) return;
    const p = this.project;
    if (!p) return;
    // A system layout can come dressed in a design: its background, colours, fonts and the
    // console name, maker, game count and picture placed to suit the layout.
    if (style && preset.kind === 'system') {
      const same = appliedDesign(p, 'system')?.id === style.id;
      return this.applyDesign(style, { hideOwn, views: ['system'], systemLayout: preset.id, carry: same ? 'layout' : 'design' });
    }
    // A game list layout on a design theme: the same design, laid out the new way.
    if (preset.kind === 'game' && (style ?? appliedDesign(p, views[0]))) {
      const d = style ?? appliedDesign(p, views[0])!;
      return this.applyDesign(d, { hideOwn, views, gameLayout: preset.id, carry: appliedDesign(p, views[0])?.id === d.id ? 'layout' : 'design' });
    }
    if (preset.assets) await this.writeArt('_inc/ccs/common', preset.assets);
    const res = this.res;
    if (!res) return;
    this.commit(`layout “${preset.label}”`, layoutChanges(p, res, preset, views));
    this.selected = null;
  }

  // ---- design artwork follows the design colours ----

  /** What the design artwork on disk was drawn with, per theme folder ('' = not known yet). */
  #artDrawn = new Map<string, string>();
  #artTimer: ReturnType<typeof setTimeout> | null = null;

  /** The design artwork folders in this theme and the colours they should be drawn in now. */
  /** The theme's design colours (designAccent...), as shared across consoles, if it has them. */
  private designColours() {
    const res = this.res;
    return res ? coloursFromVars((n) => (sharedIn(res.varHistory.get(n)) ?? res.vars.get(n))?.value) : null;
  }

  private designArtNow(): { key: string; jobs: { dir: string; files: () => Record<string, string> }[] } | null {
    const p = this.project;
    const colours = this.designColours();
    if (!p || !colours) return null;
    const dirs = new Set(p.assets.map((a) => a.rel.toLowerCase().match(/^_inc\/ccs\/([^/]+)\//)?.[1]).filter(Boolean));
    const tileDirs = new Set(p.assets.map((a) => a.rel.toLowerCase().match(/^_inc\/ccs\/tiles\/([^/]+)\//)?.[1]).filter(Boolean));
    const jobs = [
      ...DESIGNS.filter((d) => dirs.has(d.id)).map((d) => ({ dir: `_inc/ccs/${d.id}`, files: () => designAssets(recoloured(d, colours), this.depth ?? d.depth), id: d.id })),
      ...TILE_STYLES.filter((t) => tileDirs.has(t.id)).map((t) => ({ dir: `${TILE_DIR}/${t.id}`, files: () => tileArt(t, this.tileColours()), id: `tiles/${t.id}` })),
    ];
    if (!jobs.length) return null;
    return { key: `${jobs.map((j) => j.id).join(',')}|${Object.values(colours).join(',')}|${this.depth ?? ''}`, jobs };
  }

  /** Colours for grid tiles: the design colours, else the tiles' own colours on this screen. */
  private tileColours(): TileColours {
    const c = this.designColours();
    if (c) return { tile: c.text, accent: c.accent, text: c.text };
    // Otherwise the theme's accent and text colours when it names them (as the starter theme
    // does), else the tiles' colours as written (white once a style has been applied).
    const els = this.currentView?.elements;
    const v = (n: string) => this.res?.vars.get(n)?.value;
    const bg = (n: string) => els?.get(n)?.props.get('backgroundColor')?.value;
    return tileColoursFrom(v('textColor') ?? bg('default'), v('accentColor') ?? bg('selected'), v('textColor'));
  }

  /** The image grid's tile style on this screen ('' for one ChannelCraft didn't make), or null without a grid. */
  get tileStyle(): string | null {
    const v = this.currentView;
    if (!v || ![...v.elements.values()].some((e) => e.type === 'imagegrid')) return null;
    return tileStyleOfPath(v.elements.get('default')?.props.get('backgroundImage')?.value) ?? '';
  }

  /** Gives the image grid on this screen a tile style: new tile pictures and matching settings. */
  async applyTileStyle(id: string) {
    const style = TILE_STYLES.find((t) => t.id === id);
    const v = this.currentView;
    if (!style || !v || this.tileStyle === null) return;
    if (!v.elements.has('default') || !v.elements.has('selected')) {
      this.notify('This grid has no tile settings (“default” and “selected”) to style. Grids from Presets have them.', 'error');
      return;
    }
    const wrote = await this.writeArt(`${TILE_DIR}/${style.id}`, tileArt(style, this.tileColours()));
    const props = tileStyleProps(style);
    const grid = [...v.elements.values()].find((e) => e.type === 'imagegrid')!;
    const updates: Record<string, Record<string, string>> = {};
    for (const [name, p] of Object.entries(props)) {
      const target = name === 'imagegrid' ? grid.name : name;
      if (v.elements.has(target)) updates[target] = p;
    }
    this.setPropsMany(`tile style “${style.label}”`, updates);
    this.notify(wrote ? `Tiles now use “${style.label}”. Ctrl+Z to undo.` : `Tile style “${style.label}” shown in the preview only (files can’t be written here).`);
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

  /**
   * Gives a design theme more or less depth on every screen at once, as one undo step. Each screen
   * made from a design is drawn again at the new depth (shadows under art, text and panels,
   * frames, reflections, lifts, layers moving), keeping everything you chose on it.
   */
  async setDepth(id: Depth) {
    if (this.sharedOnly('Depth settings')) return;
    const p = this.project;
    const res = this.themeRes ?? this.res;
    if (!p || !res || this.depth === null) return void this.notify('Depth works on themes made from a design (New theme, or a design in Presets).', 'error');
    if (this.menuGuard()) return;
    const lv = depthLevel(id);
    if (!['system', ...GAME_VIEWS].some((v) => appliedDesign(p, v))) return this.setDepthPartly(id);
    const v = this.designVarChange(DEPTH_VAR, id);
    const wrote = await this.redesignAll(`depth “${lv.label}”`, { depth: id }, v ? [v] : []);
    if (wrote !== null) this.notify(`Depth “${lv.label}”: ${lv.help}${wrote ? '' : ' (Preview only: files can’t be written here.)'} Ctrl+Z to undo.`);
  }

  /** The design theme's screen effect (a RetroBat shader over everything). */
  get screenFx(): ScreenFx {
    return screenFxOf((this.themeRes ?? this.res)?.vars.get(SCREEN_FX_VAR)?.value).id;
  }

  /** Puts a screen effect (CRT, scanlines...) over every screen of a design theme, as one undo step. */
  async setScreenFx(id: ScreenFx) {
    if (this.sharedOnly('Screen effects')) return;
    const p = this.project;
    if (!p || this.depth === null || !['system', ...GAME_VIEWS].some((v) => appliedDesign(p, v))) return void this.notify('Screen effects work on themes made from a design (New theme, or a design in Presets).', 'error');
    if (this.menuGuard()) return;
    const fx = screenFxOf(id);
    const v = this.designVarChange(SCREEN_FX_VAR, id);
    const wrote = await this.redesignAll(`screen effect “${fx.label}”`, { screenFx: id }, v ? [v] : []);
    if (wrote !== null) this.notify(`Screen effect “${fx.label}”: ${fx.help}${wrote ? '' : ' (Preview only: files can’t be written here.)'} Ctrl+Z to undo.`);
  }

  /**
   * Draws every screen made from a design again, with a new depth or screen effect, keeping
   * everything you chose on them; one undo step together with `extra` changes. Returns whether the
   * artwork could be written, or null if the theme closed meanwhile.
   */
  private async redesignAll(label: string, o: { depth?: Depth; screenFx?: string }, extra: Change[]): Promise<boolean | null> {
    const p = this.project;
    if (!p) return null;
    const id = o.depth ?? this.depth ?? 'subtle';
    const views = ['system', ...GAME_VIEWS].filter((v) => appliedDesign(p, v));
    const colours = this.designColours();
    const byDesign = new Map<Design, string[]>();
    for (const v of views) {
      const d = appliedDesign(p, v)!;
      byDesign.set(d, [...(byDesign.get(d) ?? []), v]);
    }
    const has = (dir: string) => p.assets.some((a) => a.rel.toLowerCase().startsWith(`${dir}/`));
    const changes: Change[] = [];
    let wrote = true;
    for (const [d, vs] of byDesign) {
      const artRel = `_inc/ccs/${d.id}`;
      wrote = (await this.writeArt(artRel, designAssets(colours ? recoloured(d, colours) : d, id))) && wrote;
      const font = await this.ensureFont(d.font);
      const titleFont = d.titleFont ? await this.ensureFont(d.titleFont) : null;
      if (this.project !== p) return null;
      const ctx = { vars: true, art: `./${artRel}`, font: font ? `./${font}` : null, titleFont: titleFont ? `./${titleFont}` : null, logos: has('_inc/systems/logos') ? './_inc/systems/logos' : null, consoles: has('_inc/systems/consoles') ? './_inc/systems/consoles' : null, depth: id, motion: this.motionFeel ? MOTION_FEELS[this.motionFeel] : undefined, screenFx: o.screenFx ?? this.screenFx };
      const now = this.res;
      if (!now) return null;
      const gameLayouts = Object.fromEntries(vs.map((v) => [v, appliedGameLayout(p, v)]));
      changes.push(...designChanges(p, now, d, ctx, vs, hidesOwn(p, now, vs), appliedSystemLayout(p) ?? undefined, { gameLayouts, carry: 'layout' }));
    }
    this.commit(label, [...extra, ...changes]);
    return wrote;
  }

  /** Depth on a theme whose screens aren't recognised as a design's: only the parts it can find. */
  private setDepthPartly(id: Depth) {
    const res = this.themeRes ?? this.res;
    if (!res) return;
    const lv = depthLevel(id);
    const from = this.depth ?? 'subtle';
    const keep = { view: this.view, file: this.screenFile, consoleOnly: this.consoleOnly, selected: this.selected, selection: this.selection };
    this.consoleOnly = false;
    this.group(`depth “${lv.label}”`, () => {
      this.setDesignVar(DEPTH_VAR, id);
      if (this.screenFile !== 'theme.xml') this.screenFile = 'theme.xml';
      for (const view of ['system', 'basic', 'detailed', 'video'].filter((v) => this.viewNames.includes(v))) {
        this.view = view;
        const kind = view === 'system' ? 'system' : 'game';
        const el = (n: string) => this.currentView?.elements.get(n);
        for (const n of SHADOWED[kind]) {
          const e = el(n);
          if (!e || e.type !== 'image' || frameOf(e)) continue;
          const sh = shaderOf(e);
          if (lv.shadow && (!sh || sh.shadow)) this.setShadow(n, lv.shadow);
          else if (!lv.shadow && sh?.shadow) this.setShadow(n, null);
        }
        for (const n of FRAMED) {
          const f = el(n) && frameOf(el(n)!);
          if (f && f.frame.shadow !== lv.frameShadow) this.setFrame(n, { ...f.frame, shadow: lv.frameShadow });
        }
        for (const e of [...(this.currentView?.elements.values() ?? [])].filter((x) => x.type === 'carousel')) {
          const now = Number(e.props.get('logoScale')?.value ?? depthLevel(from).logoScale) || depthLevel(from).logoScale;
          this.setProps(e.name, { logoScale: depthLogoScale(now, from, id) });
        }
        const bg = el(PARALLAX[kind]);
        if (bg) {
          const now = presetOf(bg, screenOf(view));
          if (lv.parallax && !now) this.setAnimation(bg.name, PARALLAX_ANIM);
          else if (!lv.parallax && now === PARALLAX_ANIM) this.setAnimation(bg.name, null);
        }
      }
    });
    if (keep.file !== this.screenFile) this.screenFile = keep.file;
    this.view = keep.view;
    this.consoleOnly = keep.consoleOnly;
    this.selection = keep.selection;
    this.selected = keep.selected;
    this.notify(`Depth “${lv.label}”: ${lv.help} Ctrl+Z to undo.`);
  }

  /** Writes one of the design's own variables (depth, motion feel) next to its colours. */
  private setDesignVar(name: string, value: string) {
    const c = this.designVarChange(name, value);
    if (c) this.commit(name, [c]);
  }

  /** The change that sets one of the design's own variables, or null when there's nothing to do. */
  private designVarChange(name: string, value: string): Change | null {
    const res = this.themeRes ?? this.res;
    if (!res) return null;
    const def = sharedIn(res.varHistory.get(name)) ?? res.vars.get(name);
    const accent = sharedIn(res.varHistory.get('designAccent')) ?? res.vars.get('designAccent');
    if (def) return def.value.trim() !== value ? setTextChange(def.file, def.node, value) : null;
    if (accent?.node.parent) return { file: accent.file, patch: patchInsertChild(accent.file.doc, accent.node.parent as XElement, `<${name}>${value}</${name}>`, { first: true }) };
    return null;
  }

  /** The design theme's motion feel, or null when it hasn't been set. */
  get motionFeel(): keyof typeof MOTION_FEELS | null {
    const v = (this.themeRes ?? this.res)?.vars.get(MOTION_VAR)?.value.trim();
    return v && v in MOTION_FEELS ? (v as keyof typeof MOTION_FEELS) : null;
  }

  /**
   * One feel for every animation in theme.xml's screens: calm (smaller, slower), normal (each
   * preset's own) or lively (bigger, quicker). One undo step.
   */
  setMotionFeel(feel: keyof typeof MOTION_FEELS) {
    if (this.sharedOnly('Motion settings')) return;
    const f = MOTION_FEELS[feel];
    const keep = { view: this.view, file: this.screenFile, consoleOnly: this.consoleOnly };
    this.consoleOnly = false;
    let count = 0;
    this.group(`${f.label.toLowerCase()} motion`, () => {
      // Kept with the design, so layouts and designs applied later move the same way.
      if (this.depth !== null) this.setDesignVar(MOTION_VAR, feel);
      if (this.screenFile !== 'theme.xml') this.screenFile = 'theme.xml';
      for (const view of this.viewNames) {
        this.view = view;
        for (const e of [...(this.currentView?.elements.values() ?? [])]) {
          const t = tuningOf(e, screenOf(view));
          // The background's slow zoom keeps its pace: it belongs to the depth setting.
          if (!t || t.preset.id === PARALLAX_ANIM) continue;
          const before = this.history.done.length;
          this.tuneAnimation(e.name, t.preset.amount ? f.amount : 1, f.speed);
          if (this.history.done.length > before) count++;
        }
      }
    });
    if (keep.file !== this.screenFile) this.screenFile = keep.file;
    this.view = keep.view;
    this.consoleOnly = keep.consoleOnly;
    this.notify(count ? `${f.label} motion for ${count} animation${count === 1 ? '' : 's'}. Ctrl+Z to undo.` : 'Nothing to change: no animations here yet, or they already move like this.');
  }

  /** Writes generated SVG artwork into the theme (and shows it straight away). Returns false if it couldn't be written. */
  async writeArt(relDir: string, files: Record<string, string>): Promise<boolean> {
    const p = this.project;
    if (!p) return false;
    await this.ensureBackup();
    let wrote = true;
    for (const [file, svg] of Object.entries(files)) {
      const abs = join(p.dir, relDir, file);
      registerVirtualFile(abs, svg);
      try {
        // A .png given as SVG source is drawn to a real PNG first.
        if (file.toLowerCase().endsWith('.png')) await api.writeBinary(abs, await svgToPngBase64(svg));
        else await api.writeText(abs, svg, false);
      } catch {
        wrote = false;
      }
    }
    p.setAssets([...p.assets.filter((a) => !Object.keys(files).some((f) => a.rel === `${relDir}/${f}`)), ...Object.keys(files).map((f) => ({ rel: `${relDir}/${f}`, kind: 'image' as const, size: 0 }))]);
    this.rev++;
    return wrote;
  }

  /** Applies the choices from the New theme dialog to a freshly created theme and saves it. */
  async applyStarter(choice: { design: string; artFrom: string | null; systemLayout?: string; gameLayout?: string }) {
    const p = this.project;
    if (!p) return;
    const design = DESIGNS.find((d) => d.id === choice.design);
    // Each step shows in the loading overlay (TaskOverlay) while it runs.
    if (choice.artFrom) {
      task.step('art');
      await this.importConsoleArt(choice.artFrom);
    }
    if (design) {
      task.step('design');
      await this.applyDesign(design, { hideOwn: true, systemLayout: choice.systemLayout, gameLayout: choice.gameLayout });
    }
    task.step('save');
    await this.save();
    this.notify(`“${p.name}” is ready${design ? ` with the ${design.label} design` : ''}. It's saved; your changes from here can be undone.`);
    // The starting point is the saved theme, not something to undo back past.
    this.undoStack = [];
    this.redoStack = [];
    this.view = this.viewNames.includes('detailed') ? 'detailed' : this.view;
  }

  /** Makes a backup zip of the open theme once per session, before anything is written to it. */
  async ensureBackup() {
    const p = this.project;
    if (!p || this.backedUp.has(p.dir)) return;
    try {
      await api.backupTheme(p.dir, prefs.v.backupsKeep, 'before saving');
      this.backedUp.add(p.dir);
    } catch {
      // Browser preview or no access: nothing gets written anyway.
    }
  }

  /** Downloads a catalogue font into the theme; returns its theme-relative path, or null. */
  async ensureFont(id: string): Promise<string | null> {
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
  async ensureGoogleFont(family: string): Promise<string> {
    const p = this.project;
    if (!p) throw new Error('No theme is open');
    const f = await api.googleFontFile(family);
    const existing = p.assets.find((a) => a.rel.toLowerCase() === `_inc/fonts/${f.file_name}`.toLowerCase());
    if (existing) return existing.rel;
    const rel = await api.downloadFont(p.dir, f.url, f.file_name);
    p.setAssets([...p.assets, { rel, kind: 'font', size: 0 }]);
    return rel;
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

  /** With menu options, styles are chosen there: a design or layout applied directly would override them. */
  private menuGuard(): boolean {
    if (!this.project || !readMenuState(this.project)) return false;
    this.notify('This theme’s styles are RetroBat menu options now. Add or change styles in RetroBat menu options.');
    this.showMenuOptions = true;
    return true;
  }

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
   * Writes the choices as RetroBat theme options (see menuOptions.ts) in one undo step: option
   * files, colour sets, artwork per design and colour set, and the options include in theme.xml.
   */
  async applyMenuOptions(choices: MenuChoices): Promise<boolean> {
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

  /**
   * Finds the folders of system logos and console pictures in an installed theme, by counting
   * image files named after systems.
   */
  private consoleArtCache = new Map<string, Promise<{ logos: string | null; consoles: string | null; logoCount: number; consoleCount: number }>>();

  /** Cached per theme folder: scanning a big theme takes a moment. */
  findConsoleArt(themeDir: string) {
    let p = this.consoleArtCache.get(themeDir);
    if (!p) {
      p = this.scanConsoleArt(themeDir);
      this.consoleArtCache.set(themeDir, p);
      p.catch(() => this.consoleArtCache.delete(themeDir));
    }
    return p;
  }

  private async scanConsoleArt(themeDir: string): Promise<{ logos: string | null; consoles: string | null; logoCount: number; consoleCount: number }> {
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
  async importConsoleArt(fromThemeDir: string) {
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

  /** Saves the theme as a zip, ready to share or copy to another RetroBat. */
  async exportZip() {
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
  async makePreviewImage() {
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

  /** Sets the transition RetroBat uses between screens when its Transition Style is Auto. */
  setThemeTransition(value: string) {
    const entry = this.project?.fileAt('theme.xml');
    const root = entry?.doc.root;
    if (!entry || !root || value === this.themeTransition) return;
    const patch = value ? patchSetAttr(entry.doc, root, 'defaultTransition', value) : patchRemoveAttr(entry.doc, root, 'defaultTransition');
    if (patch) this.commit('screen transition', [{ file: entry, patch }]);
  }

  /** Sets every colour of a palette that this theme has a variable for. Returns how many were set. */
  /** How readable a design theme's text is on its background and panels, or null for other themes. */
  get readability() {
    const c = this.designColours();
    return c ? readability(c) : null;
  }

  /** Makes a design theme's text readable again: near-black or white, whichever suits the background. */
  fixReadability() {
    const r = this.readability;
    if (!r) return;
    const changes = [this.varChange('designText', `${r.text}FF`), this.varChange('designDimText', `${r.dim}FF`)].filter((c): c is Change => !!c);
    if (changes.length) this.commit('readable text', changes);
    this.notify('Text colours changed so everything is easy to read. Ctrl+Z to undo.');
  }

  /**
   * Puts one screen back to its design as it comes, at the theme's colours and depth, keeping its
   * layouts. What you added or changed on that screen goes; other screens aren't touched.
   */
  async resetScreen(view: string) {
    const p = this.project;
    const d = p ? appliedDesign(p, view) : null;
    if (!p || !d) return;
    await this.applyDesign(d, { views: [view], carry: 'none', systemLayout: view === 'system' ? (appliedSystemLayout(p) ?? undefined) : undefined, gameLayout: appliedGameLayout(p, view) ?? undefined });
    this.notify(`${viewLabel(view)} is back to the ${d.label} design. Ctrl+Z to undo.`);
  }

  /** A random design with random layouts that go together (Surprise me). */
  async surprise(opts: { hideOwn?: boolean; group?: string } = {}) {
    const pool = DESIGNS.filter((d) => !opts.group || opts.group === 'all' || d.group === opts.group);
    const d = pool[Math.floor(Math.random() * pool.length)];
    const sys = SYSTEM_LAYOUTS[Math.floor(Math.random() * SYSTEM_LAYOUTS.length)];
    const games = GAME_LAYOUTS.filter((l) => !l.flipOf || Math.random() < 0.3);
    const game = games[Math.floor(Math.random() * games.length)];
    await this.applyDesign(d, { hideOwn: opts.hideOwn ?? true, systemLayout: sys.id, gameLayout: game.id });
    this.notify(`Surprise: ${d.label}, with ${sys.label} and ${game.label}. Press again for another, or Ctrl+Z to undo.`);
  }

  applyPalette(palette: Palette): number {
    const res = this.res;
    if (!res || this.sharedOnly('Colour palettes')) return 0;
    // Themes made from a design draw with the design colours (designAccent...), so those change
    // too; their artwork follows by itself (syncDesignArt).
    const colours: Record<string, string> = { ...palette.colors, ...(res.vars.has('designAccent') ? paletteDesignVars(palette) : {}) };
    const changes = Object.entries(colours)
      .filter(([name]) => res.vars.has(name))
      .map(([name, value]) => this.varChange(name, value))
      .filter((c): c is Change => !!c);
    if (changes.length) this.commit(`palette “${palette.label}”${this.consoleOnly ? ` for ${this.consoleName}` : ''}`, changes);
    return changes.length;
  }

  /** Removes the definitions that belong to this element alone; shared blocks are left alone. */
  deleteElement(elementName: string): { removed: number; kept: number } {
    const el = this.currentView?.elements.get(elementName);
    if (!el) return { removed: 0, kept: 0 };
    const own = el.defs.filter((d) => {
      const names = (d.node.attrs.find((a) => a.name === 'name')?.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const parentNames = (d.node.parent?.attrs.find((a) => a.name === 'name')?.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      return names.length <= 1 && parentNames.length === 1 && parentNames[0] === this.view;
    });
    const unique = [...new Map(own.map((d) => [`${d.file.key}:${d.node.start}`, d])).values()];
    if (unique.length) {
      this.commit(
        `delete ${elementName}`,
        unique.map((d) => ({ file: d.file, patch: patchRemoveNode(d.file.doc, d.node) })),
      );
      this.selected = null;
    }
    return { removed: unique.length, kept: el.defs.length - unique.length };
  }

  /** Deletes every selected element's own definitions in one undo step. */
  deleteSelection() {
    const v = this.currentView;
    if (!v || !this.selection.length) return;
    if (this.gameEditing) {
      // Parts only this game has are deleted; shared ones are hidden for this game.
      const own = this.gameFile;
      const mine = this.selection.filter((n) => own && v.elements.get(n)?.defs.every((d) => d.file === own));
      const hide = this.selection.filter((n) => !mine.includes(n));
      if (hide.length) this.gameSetMany(`hiding ${hide.length === 1 ? elementLabel(hide[0]) : `${hide.length} elements`}`, Object.fromEntries(hide.map((n) => [n, { visible: 'false' }])));
      if (!mine.length) return;
      this.selection = mine;
    }
    const changes: Change[] = [];
    const seen = new Set<string>();
    let kept = 0;
    for (const name of this.selection) {
      const el = v.elements.get(name);
      if (!el) continue;
      for (const d of el.defs) {
        const names = (d.node.attrs.find((a) => a.name === 'name')?.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        const parentNames = (d.node.parent?.attrs.find((a) => a.name === 'name')?.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        const own = names.length <= 1 && parentNames.length === 1 && parentNames[0] === this.view;
        const id = `${d.file.key}:${d.node.start}`;
        if (!own) {
          kept++;
          continue;
        }
        if (seen.has(id)) continue;
        seen.add(id);
        changes.push({ file: d.file, patch: patchRemoveNode(d.file.doc, d.node) });
      }
    }
    if (!changes.length) {
      this.notify('These elements are shared with other screens, so they can’t be deleted here. Hide them instead.', 'error');
      return;
    }
    this.commit(this.selection.length > 1 ? `deleting ${this.selection.length} elements` : `deleting ${elementLabel(this.selection[0])}`, changes);
    this.selection = [];
    if (kept) this.notify(`Deleted. ${kept} shared definition(s) were kept; hide those if needed.`);
  }

  selectAll() {
    const v = this.currentView;
    if (!v) return;
    this.selection = [...v.elements.keys()].filter((n) => !this.locked[n] && this.rects[n] && !(this.rects[n].w > 0.98 && this.rects[n].h > 0.98));
  }

  /** Path to store in a property for an asset, relative to the file that will hold it. */
  relativeAssetPath(elementName: string, prop: string, abs: string): string {
    const gameFile = this.gameEditing ? this.gameFilePath() : null;
    if (gameFile) return relative(dirname(gameFile), abs);
    const el = this.currentView?.elements.get(elementName);
    const def = el?.props.get(prop);
    const holder: ThemeFile | undefined = def?.file ?? (el ? insertTarget(el, this.view)?.file : undefined) ?? this.project?.entry;
    return relative(dirname(holder?.abs ?? this.project!.dir), abs);
  }

  async importAsset(srcPath: string, kind: AssetKind): Promise<string | null> {
    const p = this.project;
    if (!p) return null;
    const dir = ASSET_THEME_DIR[kind];
    const rel = await api.importAsset(p.dir, srcPath, dir);
    p.setAssets(await api.listThemeFiles(p.dir));
    this.rev++;
    return join(p.dir, rel);
  }

  // ---- asset library -----------------------------------------------------------------------

  /** The user's own pictures, videos, sounds and fonts (in the app's data folder, not a theme). */
  library = $state.raw<LibraryAsset[]>([]);
  libraryLoaded = $state(false);

  async loadLibrary() {
    try {
      this.library = await api.listLibraryAssets();
    } catch (e) {
      this.notify(`Couldn't read the asset library: ${e}`, 'error');
    }
    this.libraryLoaded = true;
  }

  /** Copies files into the library (checked like imports, never over an existing file). */
  async addToLibrary(paths: string[]) {
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

  async removeFromLibrary(path: string) {
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
  async linkAsset(src: string, kind: AssetKind, elementName: string, forcedProp?: string): Promise<boolean> {
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
  async addAssets(files: { path: string; kind: AssetKind }[], at?: { x: number; y: number }): Promise<string[]> {
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
    return this.placeNewAssets(p, view, copied, at, skipped);
  }

  /** Adds files already in the theme as new layers on `view`, centred on `at`. One undo step. */
  private placeNewAssets(p: ThemeProject, view: string, copied: { kind: 'image' | 'video'; abs: string; src: string }[], at?: { x: number; y: number }, skipped = 0): string[] {
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
  async pasteImage(file: File): Promise<string[]> {
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
  async pickAndAddAssets() {
    const picked = await openDialog({
      title: 'Add your own picture or video',
      multiple: true,
      filters: [{ name: 'Pictures and videos', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'mpg', 'mpeg'] }],
    });
    const paths = Array.isArray(picked) ? picked : typeof picked === 'string' ? [picked] : [];
    const files = paths.map((path) => ({ path, kind: kindOfFile(path) })).filter((f): f is { path: string; kind: AssetKind } => !!f.kind);
    if (files.length) await this.addAssets(files);
  }

  // ---- saving ------------------------------------------------------------------------------

  private lastSave = Date.now();
  private autosaveTimer: ReturnType<typeof setInterval> | undefined;

  recoveryKey(dir: string) {
    return dir.replace(/[^A-Za-z0-9]+/g, '_').slice(-120);
  }

  /** Every 20 s: keep unsaved edits in a recovery file, and save if autosave is on and due. */
  startAutosave() {
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
  private async offerRecovery(project: ThemeProject) {
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

  async save() {
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

  async setActive() {
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

  async launch() {
    try {
      await api.launchRetrobat();
      this.notify('Starting RetroBat…');
    } catch (e) {
      this.notify(String(e), 'error');
    }
  }

  // ---- misc --------------------------------------------------------------------------------

  showInSource(file: ThemeFile, offset: number) {
    if (this.mode === 'simple') this.setMode('advanced');
    this.sourceFile = file.key;
    let line = 1;
    for (let i = 0; i < offset && i < file.src.length; i++) if (file.src.charCodeAt(i) === 10) line++;
    this.sourceLine = line;
    this.showSource = true;
  }

  notify(text: string, kind: Toast['kind'] = 'info', ms?: number) {
    clearTimeout(this.toastTimer);
    this.toast = { text, kind, id: Date.now(), ms };
    this.toastTimer = setTimeout(() => (this.toast = null), ms ?? (kind === 'error' ? 8000 : 2800));
  }
}

export const ed = new Editor();
