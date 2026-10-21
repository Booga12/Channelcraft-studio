import type { FileEntry, ThemeFs } from '../api';
import { basename, join, pathKey } from '../path';
import { parse, type XDoc } from '../xml/cst';

export interface ThemeFile {
  abs: string;
  key: string;
  /** Path relative to the theme folder, with forward slashes. */
  rel: string;
  src: string;
  /** Text as last loaded or saved; `dirty` means `src` differs from it. */
  savedSrc: string;
  bom: boolean;
  doc: XDoc;
  dirty: boolean;
}

export class ThemeProject {
  readonly files = new Map<string, ThemeFile>();
  assets: FileEntry[] = [];
  private assetKeys = new Set<string>();

  private constructor(
    readonly dir: string,
    readonly name: string,
  ) {}

  static async load(dir: string, fs: ThemeFs): Promise<ThemeProject> {
    const p = new ThemeProject(join(dir), basename(dir));
    const { entries, xml } = fs.loadAll ? await fs.loadAll(dir) : await Promise.all([fs.listFiles(dir), fs.readXmlFiles(dir)]).then(([entries, xml]) => ({ entries, xml }));
    p.setAssets(entries);
    for (const f of xml) {
      const abs = join(f.path);
      const rel = abs.slice(p.dir.length + 1).replace(/\\/g, '/');
      p.files.set(pathKey(abs), { abs, key: pathKey(abs), rel, src: f.text, savedSrc: f.text, bom: f.bom, doc: parse(f.text), dirty: false });
    }
    if (!p.entry) throw new Error(`${dir} has no theme.xml`);
    return p;
  }

  setAssets(entries: FileEntry[]) {
    this.assets = entries;
    this.assetKeys = new Set(entries.map((e) => pathKey(join(this.dir, e.rel))));
  }

  /**
   * The file the screen being edited starts from: theme.xml, or splash.xml / gamesplash.xml for
   * RetroBat's loading and game launch screens. New elements and preset blocks go into it.
   */
  entryRel = 'theme.xml';

  get entry(): ThemeFile | undefined {
    return this.fileAt(this.entryRel);
  }

  /** A theme file by its path relative to the theme folder. */
  fileAt(rel: string): ThemeFile | undefined {
    return this.files.get(pathKey(join(this.dir, rel)));
  }

  file(abs: string): ThemeFile | undefined {
    return this.files.get(pathKey(abs));
  }

  /** Whether a file exists inside the theme folder (as of the last listing). */
  hasFile(abs: string): boolean {
    return this.assetKeys.has(pathKey(abs));
  }

  isInside(abs: string): boolean {
    return pathKey(abs).startsWith(pathKey(this.dir) + '\\');
  }

  setSource(file: ThemeFile, src: string) {
    file.src = src;
    file.doc = parse(src);
    file.dirty = src !== file.savedSrc;
  }

  addFile(rel: string, src: string): ThemeFile {
    const abs = join(this.dir, rel);
    const f: ThemeFile = { abs, key: pathKey(abs), rel: rel.replace(/\\/g, '/'), src, savedSrc: '', bom: false, doc: parse(src), dirty: true };
    this.files.set(f.key, f);
    this.assetKeys.add(f.key);
    return f;
  }

  get dirtyFiles(): ThemeFile[] {
    return [...this.files.values()].filter((f) => f.dirty);
  }

  /** Theme files grouped as a sorted list, theme.xml first. */
  get xmlFiles(): ThemeFile[] {
    return [...this.files.values()].sort((a, b) => (a.rel === 'theme.xml' ? -1 : b.rel === 'theme.xml' ? 1 : a.rel.localeCompare(b.rel)));
  }
}
