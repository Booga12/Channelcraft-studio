import { load, type Store } from '@tauri-apps/plugin-store';
import { api, tauriFs, type RootInfo, type ThemeInfo } from './api';
import { join, relative, dirname } from './path';
import type { Environment, PreviewSettings } from './theme/context';
import { addElementChange, addPropChange, applyChanges, insertTarget, inverse, setTextChange, uniqueName, varRef, type Applied, type Change } from './theme/edits';
import { ThemeProject, type ThemeFile } from './theme/project';
import { resolveTheme, type ResolvedElement, type Resolution } from './theme/resolver';
import { STARTER_PROPS, VIEW_ORDER } from './theme/schema';
import { FALLBACK_SYSTEMS, parseEsSystems, type SystemInfo } from './theme/systems';
import { patchRemoveNode } from './xml/cst';
import { elementLabel, humanize, propLabel, typeLabel } from './friendly';
import type { LibraryItem } from './theme/library';
import { LAYOUTS, layoutChanges, PALETTES, type LayoutPreset, type Palette } from './theme/presets';

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
  selected = $state<string | null>(null);
  hidden = $state<Record<string, boolean>>({});
  sourceFile = $state<string | null>(null);
  sourceLine = $state<number | null>(null);
  leftTab = $state<'elements' | 'library' | 'presets' | 'options' | 'variables' | 'files'>('elements');
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

  env = $derived<Environment>({
    settings: this.settings,
    esHome: this.root?.esHome ?? '',
    resourcesDir: this.root?.resourcesDir ?? '',
  });

  res = $derived.by<Resolution | null>(() => {
    this.rev;
    const p = this.project;
    if (!p) return null;
    const settings = $state.snapshot(this.settings) as PreviewSettings;
    return resolveTheme(p, { settings, esHome: this.root?.esHome ?? '', resourcesDir: this.root?.resourcesDir ?? '' });
  });

  viewNames = $derived.by(() => {
    const r = this.res;
    if (!r) return [];
    const names = [...r.views.keys()];
    return names.sort((a, b) => {
      const ia = VIEW_ORDER.indexOf(a);
      const ib = VIEW_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
  });

  currentView = $derived(this.res?.views.get(this.view) ?? null);

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
      this.project = project;
      this.rev++;
      const views = this.viewNames;
      this.view = views.includes('system') ? 'system' : (this.res?.defaultView ?? views[0] ?? 'system');
      await this.store?.set('lastTheme', dir);
    } catch (e) {
      this.notify(`Couldn't open the theme: ${e}`, 'error');
    } finally {
      this.loading = false;
    }
  }

  closeTheme() {
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
    const applied = applyChanges(p, changes);
    const now = Date.now();
    const last = this.undoStack[this.undoStack.length - 1];
    if (coalesce && last && last.coalesce === coalesce && now - last.time < 1200 && last.applied.length === 1 && applied.length === 1 && last.applied[0].key === applied[0].key && last.applied[0].start === applied[0].start) {
      const merged: Applied = { ...applied[0], oldText: last.applied[0].oldText };
      this.undoStack = [...this.undoStack.slice(0, -1), { ...last, applied: [merged], time: now }];
    } else {
      this.undoStack = [...this.undoStack.slice(-199), { label, applied, time: now, coalesce }];
    }
    this.redoStack = [];
    this.rev++;
  }

  undo() {
    const p = this.project;
    const e = this.undoStack[this.undoStack.length - 1];
    if (!p || !e) return;
    const redo = applyChanges(p, inverse(p, e.applied));
    this.undoStack = this.undoStack.slice(0, -1);
    this.redoStack = [...this.redoStack, { label: e.label, applied: redo, time: 0 }];
    this.rev++;
    this.notify(`Undid ${e.label}`);
  }

  redo() {
    const p = this.project;
    const e = this.redoStack[this.redoStack.length - 1];
    if (!p || !e) return;
    const undo = applyChanges(p, inverse(p, e.applied));
    this.redoStack = this.redoStack.slice(0, -1);
    this.undoStack = [...this.undoStack, { label: e.label, applied: undo, time: 0 }];
    this.rev++;
    this.notify(`Redid ${e.label}`);
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
  applyLayout(preset: LayoutPreset, views: string[]) {
    const p = this.project;
    const res = this.res;
    if (!p || !res) return;
    this.commit(`layout “${preset.label}”`, layoutChanges(p, res, preset, views));
    this.selected = null;
  }

  /** Applies the choices from the New theme dialog to a freshly created theme and saves it. */
  async applyStarter(choice: { game: string; system: string; palette: string }) {
    const game = LAYOUTS.find((l) => l.id === choice.game);
    const system = LAYOUTS.find((l) => l.id === choice.system);
    const palette = PALETTES.find((p) => p.id === choice.palette);
    if (system && this.viewNames.includes('system')) this.applyLayout(system, ['system']);
    if (game) this.applyLayout(game, ['basic', 'detailed', 'video'].filter((v) => this.viewNames.includes(v)));
    if (palette) this.applyPalette(palette);
    await this.save();
    // The starting point is the saved theme, not something to undo back past.
    this.undoStack = [];
    this.redoStack = [];
    this.view = 'detailed';
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
        backup = await api.backupTheme(p.dir);
        this.backedUp.add(p.dir);
      }
      for (const f of dirty) {
        await api.writeText(f.abs, f.src, f.bom);
        f.savedSrc = f.src;
        f.dirty = false;
      }
      this.rev++;
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
