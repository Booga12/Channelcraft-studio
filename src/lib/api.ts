import { convertFileSrc, invoke } from '@tauri-apps/api/core';

export interface RootInfo {
  root: string;
  themesDir: string;
  esHome: string;
  resourcesDir: string;
  activeTheme: string | null;
}

export interface ThemeInfo {
  name: string;
  path: string;
  preview: string | null;
  modified: number;
}

export interface FileEntry {
  rel: string;
  kind: 'xml' | 'image' | 'font' | 'video' | 'sound' | 'shader' | 'text' | 'other';
  size: number;
}

export interface TextFile {
  path: string;
  text: string;
  bom: boolean;
}

/** File access the theme engine needs; Tauri in the app, Node in tests. */
export interface ThemeFs {
  listFiles(dir: string): Promise<FileEntry[]>;
  readXmlFiles(dir: string): Promise<TextFile[]>;
}

export const api = {
  detectRetrobat: () => invoke<string | null>('detect_retrobat'),
  setRetrobatRoot: (path: string) => invoke<RootInfo>('set_retrobat_root', { path }),
  rootStatus: () => invoke<RootInfo>('root_status'),
  listThemes: () => invoke<ThemeInfo[]>('list_themes'),
  listThemeFiles: (dir: string) => invoke<FileEntry[]>('list_theme_files', { dir }),
  readThemeXml: (dir: string) => invoke<TextFile[]>('read_theme_xml', { dir }),
  readText: (path: string) => invoke<TextFile>('read_text', { path }),
  writeText: (path: string, text: string, bom: boolean) => invoke<void>('write_text', { path, text, bom }),
  backupTheme: (dir: string, keep?: number) => invoke<string>('backup_theme', { dir, keep }),
  exportTheme: (dir: string, dest: string) => invoke<string>('export_theme', { dir, dest }),
  writeBinary: (path: string, base64: string) => invoke<void>('write_binary', { path, base64 }),
  copyFolderIntoTheme: (src: string, themeDir: string, destRel: string) => invoke<number>('copy_folder_into_theme', { src, themeDir, destRel }),
  saveRecovery: (key: string, data: string) => invoke<void>('save_recovery', { key, data }),
  loadRecovery: (key: string) => invoke<string | null>('load_recovery', { key }),
  clearRecovery: (key: string) => invoke<void>('clear_recovery', { key }),
  listGamelists: () => invoke<string[]>('list_gamelists'),
  readGamelist: (system: string) => invoke<TextFile | null>('read_gamelist', { system }),
  listFonts: () => invoke<{ name: string; path: string; source: string }[]>('list_fonts'),
  addFontToTheme: (themeDir: string, src: string) => invoke<string>('add_font_to_theme', { themeDir, src }),
  downloadFont: (themeDir: string, url: string, fileName: string) => invoke<string>('download_font', { themeDir, url, fileName }),
  backupsDir: () => invoke<string>('backups_dir'),
  copyTheme: (src: string, name: string) => invoke<string>('copy_theme', { src, name }),
  /** Zips a backup, then moves the folder to the Recycle Bin. Returns the backup path. */
  deleteTheme: (dir: string) => invoke<string>('delete_theme', { dir }),
  createThemeFromStarter: (name: string) => invoke<string>('create_theme_from_starter', { name }),
  importAsset: (themeDir: string, src: string, destRelDir: string) =>
    invoke<string>('import_asset', { themeDir, src, destRelDir }),
  readThemesettings: (theme: string) => invoke<string>('read_themesettings', { theme }),
  setActiveTheme: (theme: string) => invoke<void>('set_active_theme', { theme }),
  launchRetrobat: () => invoke<void>('launch_retrobat'),
};

export const tauriFs: ThemeFs = {
  listFiles: api.listThemeFiles,
  readXmlFiles: api.readThemeXml,
};

const urlCache = new Map<string, string>();
/** Files created in this session (design artwork), shown before or without being on disk. */
const virtualFiles = new Map<string, string>();

export function registerVirtualFile(path: string, content: string, mime = 'image/svg+xml') {
  virtualFiles.set(path.toLowerCase().replace(/\//g, '\\'), `data:${mime};charset=utf-8,${encodeURIComponent(content)}`);
}

/** URL the webview can load a local file from. */
export function fileUrl(path: string): string {
  const v = virtualFiles.get(path.toLowerCase().replace(/\//g, '\\'));
  if (v) return v;
  let u = urlCache.get(path);
  if (!u) {
    u = convertFileSrc(path);
    urlCache.set(path, u);
  }
  return u;
}
