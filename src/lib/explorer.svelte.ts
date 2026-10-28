// The Explorer panel's state: where it is looking (a folder on the PC, or the theme's own
// folder), what is ticked, and adding the ticked files to the theme. The plain helpers at the top
// are kept free of the app so they can be tested.

import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { api, type ExplorerEntry, type ExplorerPlace, type FileEntry } from './api';
import { basename } from './path';
import type { Resolution } from './theme/resolver';
import { viewLabel } from './friendly';

export type ExplorerKind = 'image' | 'video' | 'sound' | 'font';
export type Filter = 'all' | ExplorerKind | 'used' | 'unused';

export const KIND_LABEL: Record<ExplorerKind, string> = { image: 'Pictures', video: 'Videos', sound: 'Sounds', font: 'Fonts' };
/** Where the theme keeps each kind (as the copy puts them). */
export const THEME_KIND_DIR: Record<ExplorerKind, string> = { image: '_inc/images', video: '_inc/videos', sound: '_inc/sounds', font: '_inc/fonts' };
/** Files added per call, so progress shows and Stop works between them. */
export const ADD_BATCH = 8;

export const isKind = (k: string): k is ExplorerKind => k === 'image' || k === 'video' || k === 'sound' || k === 'font';

/** "1.2 MB", "560 KB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1).replace(/\.0$/, '')} GB`;
}

export interface Crumb {
  label: string;
  /** null: the start of "My PC" (quick places and drives). */
  path: string | null;
}

/**
 * The parts of the path shown at the top. On the PC it starts at "This PC"; in the theme it
 * starts at the theme's name and never goes above the theme folder.
 */
export function crumbsOf(path: string | null, themeDir: string | null): Crumb[] {
  if (themeDir) {
    const base = themeDir.replace(/[\\/]+$/, '');
    const out: Crumb[] = [{ label: basename(base), path: base }];
    if (!path) return out;
    const rest = path.length > base.length ? path.slice(base.length).replace(/^[\\/]+/, '') : '';
    let at = base;
    for (const part of rest.split(/[\\/]+/).filter(Boolean)) {
      at = `${at}\\${part}`;
      out.push({ label: part, path: at });
    }
    return out;
  }
  const out: Crumb[] = [{ label: 'This PC', path: null }];
  if (!path) return out;
  const parts = path.split(/[\\/]+/).filter(Boolean);
  let at = '';
  parts.forEach((part, i) => {
    at = i === 0 ? (/^[a-z]:$/i.test(part) ? `${part}\\` : `/${part}`) : `${at.replace(/[\\/]+$/, '')}\\${part}`;
    out.push({ label: part, path: at });
  });
  return out;
}

/** How many files of each kind (for the filter chips). */
export function kindCounts(entries: ExplorerEntry[]): Record<'all' | ExplorerKind, number> {
  const c = { all: 0, image: 0, video: 0, sound: 0, font: 0 };
  for (const e of entries) {
    if (e.isDir) continue;
    c.all++;
    if (isKind(e.kind)) c[e.kind]++;
  }
  return c;
}

/** The entries between two in a list, inclusive, in list order (Shift-click). */
export function rangeBetween<T>(list: T[], a: T, b: T): T[] {
  const i = list.indexOf(a);
  const j = list.indexOf(b);
  if (i < 0 || j < 0) return [b];
  return list.slice(Math.min(i, j), Math.max(i, j) + 1);
}

/**
 * Whether a file on the PC is already in the theme: a file with the same name and size in the
 * folder the copy would put it in. (The copy checks the contents too, so a wrong guess only
 * changes the label.)
 */
export function inThemeKey(assets: FileEntry[]): Set<string> {
  return new Set(assets.map((a) => `${a.rel.toLowerCase()}|${a.size}`));
}
export function isInTheme(e: ExplorerEntry, keys: Set<string>): boolean {
  return !e.isDir && isKind(e.kind) && keys.has(`${THEME_KIND_DIR[e.kind]}/${e.name}`.toLowerCase() + `|${e.size}`);
}

/**
 * Where a theme file is used: the screens whose parts name it, or "the theme's files" when only
 * the XML mentions it (in a block for one console, say). Null when nothing uses it.
 */
/**
 * Whether `hay` names the file `name` (lower case): the name with no other file-name character
 * just before it, so "a.png" isn't found inside "data.png".
 */
export function mentions(hay: string, name: string): boolean {
  const h = hay.toLowerCase();
  for (let i = h.indexOf(name); i >= 0; i = h.indexOf(name, i + 1)) {
    const before = i ? h[i - 1] : '';
    const after = h[i + name.length] ?? '';
    if (!/[\w.\-]/.test(before) && !/[\w-]/.test(after)) return true;
  }
  return false;
}

export function usedWhere(name: string, res: Resolution | null, xml: string[]): string[] | null {
  const n = name.toLowerCase();
  const views = new Set<string>();
  for (const [view, v] of res?.views ?? []) {
    for (const el of v.elements.values()) {
      for (const d of el.props.values()) {
        if (mentions(d.value, n)) {
          views.add(viewLabel(view));
          break;
        }
      }
    }
  }
  if (views.size) return [...views];
  return xml.some((s) => mentions(s, n)) ? ['the theme’s files'] : null;
}

export interface AddSummary {
  added: number;
  byKind: Record<ExplorerKind, number>;
  existing: number;
  problems: string[];
  stopped: boolean;
}

export function summarize(added: string[], existing: string[], problems: string[], stopped: boolean): AddSummary {
  const byKind: Record<ExplorerKind, number> = { image: 0, video: 0, sound: 0, font: 0 };
  for (const rel of added) {
    const k = (Object.keys(THEME_KIND_DIR) as ExplorerKind[]).find((kk) => rel.startsWith(`${THEME_KIND_DIR[kk]}/`));
    if (k) byKind[k]++;
  }
  return { added: added.length, byKind, existing: existing.length, problems, stopped };
}

/** "31 pictures · 6 videos". */
export function kindLine(byKind: Record<ExplorerKind, number>): string {
  const words: Record<ExplorerKind, [string, string]> = { image: ['picture', 'pictures'], video: ['video', 'videos'], sound: ['sound', 'sounds'], font: ['font', 'fonts'] };
  return (Object.keys(words) as ExplorerKind[])
    .filter((k) => byKind[k])
    .map((k) => `${byKind[k]} ${words[k][byKind[k] === 1 ? 0 : 1]}`)
    .join(' · ');
}

// ---- the panel's state -----------------------------------------------------------------------

type Spot = { source: 'pc' | 'theme'; path: string | null };

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // Not saved: it's only a convenience.
  }
}

class Explorer {
  source = $state<'pc' | 'theme'>('pc');
  /** The folder shown; null on the PC is the start (quick places and drives). */
  path = $state<string | null>(null);
  entries = $state<ExplorerEntry[]>([]);
  total = $state(0);
  truncated = $state(false);
  places = $state<ExplorerPlace[]>([]);
  recent = $state<string[]>(load('ccs.explorer.recent', []));
  loading = $state(false);
  error = $state<string | null>(null);
  filter = $state<Filter>('all');
  query = $state('');
  found = $state<ExplorerEntry[] | null>(null);
  foundTruncated = $state(false);
  view = $state<'grid' | 'list'>(load('ccs.explorer.view', 'grid'));
  thumb = $state<number>(load('ccs.explorer.thumb', 118));
  /** Show files a theme can't use too (greyed out, with the reason). */
  showAll = $state(true);
  selected = new SvelteSet<string>();
  /** Sizes of ticked files, for the total in the bottom bar. */
  sizes = new SvelteMap<string, number>();
  /** The theme folder "This theme" belongs to (undefined until the panel first opens). */
  private themeDir: string | null | undefined = undefined;
  anchor = $state<string | null>(null);
  adding = $state<{ done: number; total: number } | null>(null);
  summary = $state<AddSummary | null>(null);
  private back: Spot[] = [];
  canGoBack = $state(false);
  private stopAsked = false;
  private searchToken = 0;
  private listToken = 0;

  /** Opens a folder (or the PC's start, with null). */
  async open(path: string | null, opts: { source?: 'pc' | 'theme'; push?: boolean } = {}) {
    const source = opts.source ?? this.source;
    if (opts.push !== false && (this.path !== path || this.source !== source)) {
      this.back.push({ source: this.source, path: this.path });
      this.canGoBack = true;
    }
    if (source !== this.source && !this.adding) {
      // Ticks are files on the PC; the theme view has none.
      this.clear();
      this.summary = null;
    }
    this.source = source;
    this.path = path;
    // Each folder starts with everything shown, and no search from the last one can land here.
    this.filter = 'all';
    this.query = '';
    this.searchToken++;
    this.found = null;
    this.error = null;
    this.anchor = null;
    const token = ++this.listToken;
    if (path === null) {
      this.entries = [];
      this.total = 0;
      this.truncated = false;
      if (!this.places.length) await this.loadPlaces();
      return;
    }
    this.loading = true;
    try {
      const l = await api.explorerList(path);
      if (token !== this.listToken) return;
      this.entries = l.entries;
      this.total = l.total;
      this.truncated = l.truncated;
      this.path = l.path;
      if (source === 'pc') this.remember(l.path);
    } catch (e) {
      if (token !== this.listToken) return;
      this.entries = [];
      this.error = String(e);
    } finally {
      if (token === this.listToken) this.loading = false;
    }
  }

  async loadPlaces() {
    try {
      this.places = await api.explorerPlaces();
    } catch (e) {
      this.error = String(e);
    }
  }

  /** Back to where the panel was before. */
  async goBack() {
    const s = this.back.pop();
    this.canGoBack = this.back.length > 0;
    if (s) await this.open(s.path, { source: s.source, push: false });
  }

  /** One folder up; at the top of a drive (or the theme) there is nowhere further. */
  async up(themeDir: string | null) {
    if (!this.path) return;
    if (this.source === 'theme' && themeDir && this.path.replace(/[\\/]+$/, '').toLowerCase() === themeDir.replace(/[\\/]+$/, '').toLowerCase()) return;
    const trimmed = this.path.replace(/[\\/]+$/, '');
    const cut = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
    if (cut < 0 || /^[a-z]:$/i.test(trimmed)) return this.open(null, { source: 'pc' });
    const parent = trimmed.slice(0, cut);
    await this.open(/^[a-z]:$/i.test(parent) ? `${parent}\\` : parent || '/');
  }

  setSource(source: 'pc' | 'theme', themeDir: string | null) {
    if (source === this.source || this.adding) return;
    void this.open(source === 'theme' ? themeDir : null, { source });
  }

  /**
   * The open theme changed (or the panel opened): "This theme" must show that theme's folder, and
   * Back can't lead into another theme. Returns whether it reopened.
   */
  themeChanged(dir: string | null): boolean {
    if (dir === this.themeDir) return false;
    const first = this.themeDir === undefined;
    this.themeDir = dir;
    if (!first) {
      this.back = [];
      this.canGoBack = false;
      if (!this.adding) this.summary = null;
    }
    if (this.source !== 'theme') return false;
    const inside = !!dir && !!this.path && (this.path.toLowerCase() + '\\').startsWith(dir.toLowerCase().replace(/[\\/]+$/, '') + '\\');
    if (inside && first) return false;
    void this.open(dir, { source: dir ? 'theme' : 'pc', push: false });
    return true;
  }

  private remember(path: string) {
    this.recent = [path, ...this.recent.filter((p) => p.toLowerCase() !== path.toLowerCase())].slice(0, 6);
    save('ccs.explorer.recent', this.recent);
  }

  setView(v: 'grid' | 'list') {
    this.view = v;
    save('ccs.explorer.view', v);
  }

  setThumb(n: number) {
    this.thumb = n;
    save('ccs.explorer.thumb', n);
  }

  /** Searches this folder and the folders inside it (after a short pause in typing). */
  search(q: string) {
    this.query = q;
    const token = ++this.searchToken;
    if (!q.trim() || !this.path) {
      this.found = null;
      return;
    }
    const at = this.path;
    setTimeout(async () => {
      if (token !== this.searchToken) return;
      try {
        const r = await api.explorerSearch(at, q);
        if (token !== this.searchToken) return;
        this.found = r.entries;
        this.foundTruncated = r.truncated;
      } catch (e) {
        if (token === this.searchToken) this.error = String(e);
      }
    }, 250);
  }

  /** A click on a file: tick or untick it; Shift ticks the range from the last one clicked. */
  click(e: ExplorerEntry, list: ExplorerEntry[], mods: { shift: boolean }, can: (e: ExplorerEntry) => boolean) {
    if (!can(e)) return;
    if (mods.shift && this.anchor) {
      const a = list.find((x) => x.path === this.anchor);
      if (a) {
        for (const x of rangeBetween(list, a, e)) if (can(x)) this.tick(x.path, x.size);
        return;
      }
    }
    if (this.selected.has(e.path)) this.selected.delete(e.path);
    else this.tick(e.path, e.size);
    this.anchor = e.path;
  }

  selectAll(list: ExplorerEntry[], can: (e: ExplorerEntry) => boolean) {
    for (const e of list) if (can(e)) this.tick(e.path, e.size);
  }

  private tick(path: string, size: number) {
    this.selected.add(path);
    this.sizes.set(path, size);
  }

  /** How big the ticked files are together. */
  get selectedSize(): number {
    let n = 0;
    for (const p of this.selected) n += this.sizes.get(p) ?? 0;
    return n;
  }

  /** Ticks every usable file in a folder and the folders inside it (or unticks them). */
  async toggleFolder(dir: ExplorerEntry, keep: (path: string) => boolean): Promise<string | null> {
    try {
      const r = await api.explorerFolderFiles(dir.path);
      const files = r.files.filter((f) => keep(f.path));
      const paths = files.map((f) => f.path);
      const prefix = dir.path.replace(/[\\/]+$/, '').toLowerCase() + '\\';
      const all = paths.length > 0 && paths.every((p) => this.selected.has(p));
      if (all) {
        for (const p of [...this.selected]) if (p.toLowerCase().startsWith(prefix)) this.selected.delete(p);
      } else {
        for (const f of files) this.tick(f.path, f.size);
      }
      if (!paths.length) return `There's nothing in “${dir.name}” a theme can use.`;
      return r.truncated ? `Only the first ${paths.length} files in “${dir.name}” were ticked.` : null;
    } catch (e) {
      return String(e);
    }
  }

  folderTicked(dir: ExplorerEntry): boolean {
    const prefix = dir.path.replace(/[\\/]+$/, '').toLowerCase() + '\\';
    for (const p of this.selected) if (p.toLowerCase().startsWith(prefix)) return true;
    return false;
  }

  /**
   * Things dropped from Windows Explorer onto the panel: a folder opens; files open their folder
   * with them ticked (the ones a theme can use).
   */
  async openDropped(paths: string[]) {
    const first = paths[0];
    if (!first) return;
    const isFolder = await api.explorerList(first).then(
      () => true,
      () => false,
    );
    if (isFolder) return this.open(first, { source: 'pc' });
    await this.open(folderOf(first), { source: 'pc' });
    const want = new Set(paths.map((p) => p.toLowerCase()));
    for (const e of this.entries) if (!e.isDir && !e.problem && want.has(e.path.toLowerCase())) this.tick(e.path, e.size);
  }

  clear() {
    this.selected.clear();
    this.sizes.clear();
    this.anchor = null;
  }

  stop() {
    this.stopAsked = true;
  }

  /** Copies the ticked files into the theme, a few at a time; then a summary. */
  async addToTheme(themeDir: string, afterwards: (assets: FileEntry[]) => void) {
    const paths = [...this.selected];
    if (!paths.length || this.adding) return;
    this.stopAsked = false;
    this.summary = null;
    this.adding = { done: 0, total: paths.length };
    const added: string[] = [];
    const existing: string[] = [];
    const problems: string[] = [];
    let stopped = false;
    try {
      for (let i = 0; i < paths.length; i += ADD_BATCH) {
        if (this.stopAsked) {
          stopped = true;
          break;
        }
        const batch = paths.slice(i, i + ADD_BATCH);
        try {
          const r = await api.explorerAddToTheme(themeDir, batch);
          added.push(...r.added);
          existing.push(...r.existing);
          problems.push(...r.problems);
        } catch (e) {
          problems.push(String(e));
        }
        for (const p of batch) this.selected.delete(p);
        this.adding = { done: Math.min(paths.length, i + batch.length), total: paths.length };
      }
    } finally {
      this.adding = null;
      try {
        afterwards(await api.listThemeFiles(themeDir));
      } catch {
        // The list refreshes the next time the theme opens.
      }
    }
    this.summary = summarize(added, existing, problems, stopped);
  }
}

export const explorer = new Explorer();

/** The folder a file lives in (for opening a search result's folder). */
export function folderOf(path: string): string {
  const cut = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  if (cut <= 0) return path;
  const parent = path.slice(0, cut);
  // "C:" alone means "the current folder on C:", not the drive's top folder.
  return /^[a-z]:$/i.test(parent) ? `${parent}\\` : parent;
}


/**
 * The files a drag from `path` carries: every ticked file (the dragged one first) when it is one
 * of several ticked, else just that one.
 */
export function dragPaths(path: string, selected: ReadonlySet<string>): string[] {
  if (!selected.has(path) || selected.size < 2) return [path];
  return [path, ...[...selected].filter((p) => p !== path)];
}
