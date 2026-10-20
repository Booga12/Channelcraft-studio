import { load, type Store } from '@tauri-apps/plugin-store';
import { ask, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { api, registerVirtualFile, tauriFs, type RootInfo, type ThemeInfo } from './api';
import { svgToPngBase64 } from './raster';
import { join, relative, dirname, pathKey } from './path';
import { parseGamelist, type GameInfo } from './theme/games';
import { screenSize, type Environment, type PreviewSettings } from './theme/context';
import { addElementChange, addPropChange, applyChanges, insertTarget, inverse, setTextChange, uniqueName, varRef, type Applied, type Change } from './theme/edits';
import { ThemeProject, type ThemeFile } from './theme/project';
import { resolveTheme, type ResolvedElement, type Resolution } from './theme/resolver';
import { fmtNum, parsePair, STARTER_PROPS, VIEW_ORDER } from './theme/schema';
import { zOf } from './render';
import { ANIMATIONS, storyboardXml } from './theme/animations';
import { FALLBACK_SYSTEMS, parseEsSystems, type SystemInfo } from './theme/systems';
import { attr, patchInsertChild, patchRemoveAttr, patchRemoveNode, patchReplaceSpan, patchSetAttr } from './xml/cst';
import { elementLabel, humanize, propLabel, typeLabel } from './friendly';
import { NATIVE_BINDINGS, type LibraryItem } from './theme/library';
import { prefs } from './prefs.svelte';
import { designChanges, LAYOUTS, layoutChanges, type LayoutPreset, type Palette } from './theme/presets';
import { DESIGNS, designAssets, type Design } from './theme/designs';
import { catalogFont } from './theme/fonts';

/** RetroBat's loading screen files, read on their own (not through theme.xml). */
export const SPLASH_FILES = ['splash.xml', 'gamesplash.xml'] as const;

interface HistoryEntry {
  label: string;
  applied: Applied[];
  time: number;
  coalesce?: string;
}

export interface Toast {
  text: string;
  kind: 'info' | 'error';
  id: number;
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
  playAnimations = $state(false);
  contactSheet = $state(false);
  showSettings = $state(false);
  showRestore = $state(false);
  showShortcuts = $state(false);
  showSearch = $state(false);

  /** Bumped whenever a panel is asked for, so asking twice still brings it forward. */
  panelRequest = $state(0);

  showPanel(id: 'elements' | 'library' | 'presets' | 'options' | 'variables' | 'files' | 'history' | 'properties') {
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
  leftTab = $state<'elements' | 'library' | 'presets' | 'options' | 'variables' | 'files' | 'history' | 'properties'>('elements');
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
  private backedUp = new Set<string>();
  private store: Store | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  /** Systems with a scraped gamelist in RetroBat's roms folder. */
  gameSystems = $state<string[]>([]);
  /** Real games per system, loaded on demand. */
  games = $state.raw<Record<string, GameInfo[]>>({});
  /** Which game of the list the preview shows. */
  gameIndex = $state(0);

  currentGames = $derived(prefs.v.realArtwork ? (this.games[this.settings.system.name] ?? []) : []);
  currentGame = $derived<GameInfo | undefined>(this.currentGames.length ? this.currentGames[this.gameIndex % this.currentGames.length] : undefined);

  env = $derived<Environment>({
    settings: this.settings,
    esHome: this.root?.esHome ?? '',
    resourcesDir: this.root?.resourcesDir ?? '',
    game: this.currentGame,
    gameNames: this.currentGames.length ? this.currentGames.map((g) => g.name) : undefined,
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

  async deleteTheme(dir: string, name: string) {
    try {
      await api.deleteTheme(dir);
      await this.refreshThemes();
      this.notify(`“${name}” was moved to the Recycle Bin (a backup zip was saved too)`);
    } catch (e) {
      this.notify(String(e), 'error');
    }
  }

  async createTheme(name: string) {
    const dest = await api.createThemeFromStarter(name);
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
    const applied = applyChanges(p, changes);
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

  undo(quiet = false) {
    const p = this.project;
    const e = this.undoStack[this.undoStack.length - 1];
    if (!p || !e) return;
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
    const def = el.props.get(prop);
    const key = opts.coalesce ?? `${elementName}.${prop}`;
    if (def) {
      const v = varRef(def.raw);
      const vdef = v ? res.vars.get(v) : undefined;
      if (vdef && !opts.literal) {
        this.commit(`change of ${humanize(v!)}`, [setTextChange(vdef.file, vdef.node, value)], `var.${v}`);
      } else {
        this.commit(`${propLabel(prop).toLowerCase()} of ${elementLabel(elementName)}`, [setTextChange(def.file, def.node, value)], key);
      }
      return;
    }
    const target = insertTarget(el, this.view);
    if (!target) return;
    this.commit(`${propLabel(prop).toLowerCase()} of ${elementLabel(elementName)}`, [addPropChange(target, prop, value)]);
  }

  /** Changes built for setting `props` on an element (literal values, never through variables). */
  private propChanges(elementName: string, props: Record<string, string>): Change[] {
    const el = this.currentView?.elements.get(elementName);
    if (!el) return [];
    const changes: Change[] = [];
    const target = insertTarget(el, this.view);
    for (const [prop, value] of Object.entries(props)) {
      const def = el.props.get(prop);
      if (def) changes.push(setTextChange(def.file, def.node, value));
      else if (target) changes.push(addPropChange(target, prop, value));
    }
    return changes;
  }

  /** Sets several properties of one element as a single undo step. */
  setProps(elementName: string, props: Record<string, string>, coalesce?: string) {
    this.commit(`changes to ${elementLabel(elementName)}`, this.propChanges(elementName, props), coalesce);
  }

  /** Sets properties on several elements at once (group moves, align, distribute). */
  setPropsMany(label: string, updates: Record<string, Record<string, string>>, coalesce?: string) {
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

  /** Puts `name` directly above `target` in the layer order (drag and drop in Layers). */
  placeAbove(name: string, target: string) {
    const v = this.currentView;
    const t = v?.elements.get(target);
    if (!v || !t || name === target) return;
    this.setProps(name, { zIndex: String(zOf(t) + 1) });
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
    const existing = el.complex.filter((c) => c.name === 'storyboard' && c.node.parent === target.node);
    const preset = ANIMATIONS.find((a) => a.id === presetId);
    const removeAll = (list: typeof existing): Change[] => list.map((c) => ({ file: c.file, patch: patchRemoveNode(c.file.doc, c.node) }));
    if (!preset) {
      if (existing.length) this.commit('removing animation', removeAll(existing));
      return;
    }
    const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
    const xml = storyboardXml(preset, pos);
    // Replace the first storyboard in place (others go); otherwise add one.
    const changes: Change[] = existing.length
      ? [{ file: existing[0].file, patch: patchReplaceSpan(existing[0].file.doc, existing[0].node, existing[0].node, xml) }, ...removeAll(existing.slice(1))]
      : [{ file: target.file, patch: patchInsertChild(target.file.doc, target.node, xml) }];
    this.commit(`animation “${preset.label}”`, changes);
    this.playAnimations = true;
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

  setVar(name: string, value: string) {
    const vdef = this.res?.vars.get(name);
    if (!vdef) return;
    this.commit(`change of ${humanize(name)}`, [setTextChange(vdef.file, vdef.node, value)], `var.${name}`);
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
    this.commit(`adding ${item.label.toLowerCase()}`, [addElementChange(p, res, this.view, item.type, name, item.body, !item.native)]);
    this.selected = name;
  }

  /** Writes a layout preset into its own block at the end of theme.xml (replacing an earlier one). */
  async applyLayout(preset: LayoutPreset, views: string[], style: Design | null = null, hideOwn = true) {
    const p = this.project;
    if (!p) return;
    // A system layout can come dressed in a design: its background, colours, fonts and the
    // console name, maker, game count and picture placed to suit the layout.
    if (style && preset.kind === 'system') return this.applyDesign(style, { hideOwn, views: ['system'], systemLayout: preset.id });
    if (preset.assets) await this.writeArt('_inc/ccs/common', preset.assets);
    const res = this.res;
    if (!res) return;
    this.commit(`layout “${preset.label}”`, layoutChanges(p, res, preset, views));
    this.selected = null;
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
  async applyStarter(choice: { design: string; artFrom: string | null }) {
    const p = this.project;
    if (!p) return;
    if (choice.artFrom) await this.importConsoleArt(choice.artFrom);
    const design = DESIGNS.find((d) => d.id === choice.design);
    if (design) await this.applyDesign(design, { hideOwn: true });
    await this.save();
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

  /**
   * Applies a design: writes its artwork into the theme, fetches its fonts, and replaces the
   * layout of each screen with the design's (one undo step for the layout).
   */
  async applyDesign(design: Design, opts: { hideOwn?: boolean; views?: string[]; systemLayout?: string } = {}) {
    const p = this.project;
    if (!p) return;
    // Designs style theme.xml's screens, not the loading screens.
    if (this.screenFile !== 'theme.xml') this.showScreen({ view: this.viewNames.includes('system') ? 'system' : (this.viewNames[0] ?? 'system'), file: 'theme.xml' });
    const artRel = `_inc/ccs/${design.id}`;
    const wrote = await this.writeArt(artRel, designAssets(design));
    const font = await this.ensureFont(design.font);
    const titleFont = design.titleFont ? await this.ensureFont(design.titleFont) : null;
    // The theme may have been closed while the fonts downloaded.
    if (this.project !== p) return;
    const has = (dir: string) => p.assets.some((a) => a.rel.toLowerCase().startsWith(`${dir}/`));
    const ctx = {
      art: `./${artRel}`,
      font: font ? `./${font}` : null,
      titleFont: titleFont ? `./${titleFont}` : null,
      logos: has('_inc/systems/logos') ? './_inc/systems/logos' : null,
      consoles: has('_inc/systems/consoles') ? './_inc/systems/consoles' : null,
    };
    this.rev++;
    const res = this.res;
    if (!res) return;
    const views = opts.views ?? ['system', 'basic', 'detailed', 'video'].filter((v) => this.viewNames.includes(v));
    const label = opts.systemLayout ? `“${LAYOUTS.find((l) => l.id === opts.systemLayout)?.label ?? opts.systemLayout}” in the ${design.label} style` : `design “${design.label}”`;
    this.commit(label, designChanges(p, res, design, ctx, views, opts.hideOwn ?? true, opts.systemLayout));
    this.selected = null;
    const missingFont = !font ? ' Its font could not be downloaded (offline?), so the theme’s font is used.' : '';
    if (opts.systemLayout) return this.notify(wrote ? `${label[0].toUpperCase()}${label.slice(1)} applied to the System screen.${missingFont} Save to keep it, or Ctrl+Z to undo.` : `${label} applied in the preview only (files can’t be written here).`);
    this.notify(wrote ? `Design “${design.label}” applied.${missingFont} Save to keep it, or Ctrl+Z to undo.` : `Design “${design.label}” applied in the preview only (files can’t be written here).`);
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

  /** Sets the transition RetroBat uses between screens when its Transition Style is Auto. */
  setThemeTransition(value: string) {
    const entry = this.project?.fileAt('theme.xml');
    const root = entry?.doc.root;
    if (!entry || !root || value === this.themeTransition) return;
    const patch = value ? patchSetAttr(entry.doc, root, 'defaultTransition', value) : patchRemoveAttr(entry.doc, root, 'defaultTransition');
    if (patch) this.commit('screen transition', [{ file: entry, patch }]);
  }

  /** Sets every colour of a palette that this theme has a variable for. Returns how many were set. */
  applyPalette(palette: Palette): number {
    const res = this.res;
    if (!res) return 0;
    const changes = Object.entries(palette.colors)
      .map(([name, value]) => ({ def: res.vars.get(name), value }))
      .filter((x) => x.def)
      .map((x) => setTextChange(x.def!.file, x.def!.node, x.value));
    if (changes.length) this.commit(`palette “${palette.label}”`, changes);
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
    const el = this.currentView?.elements.get(elementName);
    const def = el?.props.get(prop);
    const holder: ThemeFile | undefined = def?.file ?? (el ? insertTarget(el, this.view)?.file : undefined) ?? this.project?.entry;
    return relative(dirname(holder?.abs ?? this.project!.dir), abs);
  }

  async importAsset(srcPath: string, kind: 'image' | 'font' | 'sound' | 'video'): Promise<string | null> {
    const p = this.project;
    if (!p) return null;
    const dir = { image: '_inc/images', font: '_inc/fonts', sound: '_inc/sounds', video: '_inc/videos' }[kind];
    const rel = await api.importAsset(p.dir, srcPath, dir);
    p.setAssets(await api.listThemeFiles(p.dir));
    this.rev++;
    return join(p.dir, rel);
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
      const files = sent.map(({ file, src }) => ({ rel: file.rel, text: src, bom: file.bom }));
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

  notify(text: string, kind: Toast['kind'] = 'info') {
    clearTimeout(this.toastTimer);
    this.toast = { text, kind, id: Date.now() };
    this.toastTimer = setTimeout(() => (this.toast = null), kind === 'error' ? 8000 : 2800);
  }
}

export const ed = new Editor();
