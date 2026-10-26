import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { SvelteMap } from 'svelte/reactivity';

export interface RootInfo {
  root: string;
  themesDir: string;
  esHome: string;
  resourcesDir: string;
  activeTheme: string | null;
  /** RetroBat settings that change how themes look (from es_settings.cfg). */
  es: { clock12: boolean; drawClock: boolean; transitionStyle: string; powerSaver: string };
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

export interface BackupInfo {
  path: string;
  fileName: string;
  /** Unix seconds. */
  created: number;
  note: string;
  size: number;
  files: number;
  restorable: boolean;
  problem: string | null;
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
  /** Both in one walk of the folder, when the file system can (much faster on big themes). */
  loadAll?(dir: string): Promise<{ entries: FileEntry[]; xml: TextFile[] }>;
}

export interface LibraryAsset {
  path: string;
  /** Path inside the library folder, with forward slashes. */
  rel: string;
  kind: 'image' | 'video' | 'sound' | 'font';
  size: number;
  /** Unix seconds. */
  modified: number;
}

export interface ImportPlan {
  suggestedName: string;
  root: string;
  files: number;
  bytes: number;
  skipped: { path: string; reason: string }[];
  outside: number;
  hasSplash: boolean;
}

/** RetroBat's intro video settings ([SplashScreen] in retrobat.ini). */
export interface IntroSettings {
  enableIntro: boolean;
  fileName: string;
  /** "default" (RetroBat's video folder) or a folder of your own. */
  filePath: string;
  randomVideo: boolean;
  videoDelay: number;
  waitForVideoEnd: boolean;
  killVideoWhenEsReady: boolean;
  gamepadVideoKill: boolean;
}

export interface IntroInfo {
  settings: IntroSettings;
  /** retrobat.ini exists (RetroBat makes it the first time it runs). */
  found: boolean;
  folder: string;
  videos: { name: string; path: string; size: number }[];
}

export const api = {
  detectRetrobat: () => invoke<string | null>('detect_retrobat'),
  setRetrobatRoot: (path: string) => invoke<RootInfo>('set_retrobat_root', { path }),
  rootStatus: () => invoke<RootInfo>('root_status'),
  listThemes: () => invoke<ThemeInfo[]>('list_themes'),
  listThemeFiles: (dir: string) => invoke<FileEntry[]>('list_theme_files', { dir }),
  readThemeXml: (dir: string) => invoke<TextFile[]>('read_theme_xml', { dir }),
  loadTheme: (dir: string) => invoke<{ entries: FileEntry[]; xml: TextFile[] }>('load_theme', { dir }),
  readText: (path: string) => invoke<TextFile>('read_text', { path }),
  writeText: (path: string, text: string, bom: boolean) => invoke<void>('write_text', { path, text, bom }),
  backupTheme: (dir: string, keep?: number, note?: string) => invoke<string>('backup_theme', { dir, keep, note }),
  /** Locks the theme for this window, repairs an interrupted save/restore, remembers its files. */
  openProject: (dir: string) => invoke<{ recovered: string | null }>('open_project', { dir }),
  closeProject: (dir: string) => invoke<void>('close_project', { dir }),
  /** XML files changed by another program since the theme was opened or saved. */
  changedFiles: (dir: string) => invoke<string[]>('changed_files', { dir }),
  acceptChanges: (dir: string) => invoke<void>('accept_changes', { dir }),
  /** Saves all files as one transaction; fails with "CHANGED_OUTSIDE:[...]" unless forced. */
  saveFiles: (dir: string, files: { rel: string; text: string; bom: boolean; remove?: boolean }[], force: boolean) => invoke<void>('save_files', { dir, files, force }),
  /** Which of these files exist. */
  existingFiles: (paths: string[]) => invoke<boolean[]>('existing_files', { paths }),
  /** Copies a picture or video into the theme under its hash; returns the theme-relative path. */
  copyMediaIntoTheme: (themeDir: string, src: string, destRelDir: string) => invoke<string>('copy_media_into_theme', { themeDir, src, destRelDir }),
  /** Makes folders inside a theme (theme-relative paths); returns how many were new. */
  makeThemeDirs: (themeDir: string, rels: string[]) => invoke<number>('make_theme_dirs', { themeDir, rels }),
  /** Saves a .csv report where the user chose. */
  writeReport: (path: string, text: string) => invoke<void>('write_report', { path, text }),
  /** Saves a shared design (.ccdesign) where the user chose. */
  writeDesignFile: (path: string, text: string) => invoke<void>('write_design_file', { path, text }),
  listBackups: (dir: string) => invoke<BackupInfo[]>('list_backups', { dir }),
  /** Restores a backup exactly; returns the backup made of the current state first. */
  restoreBackup: (dir: string, zip: string) => invoke<string>('restore_backup', { dir, zip }),
  exportTheme: (dir: string, dest: string) => invoke<string>('export_theme', { dir, dest }),
  writeBinary: (path: string, base64: string) => invoke<void>('write_binary', { path, base64 }),
  copyFolderIntoTheme: (src: string, themeDir: string, destRel: string) => invoke<number>('copy_folder_into_theme', { src, themeDir, destRel }),
  saveRecovery: (key: string, data: string) => invoke<void>('save_recovery', { key, data }),
  loadRecovery: (key: string) => invoke<string | null>('load_recovery', { key }),
  clearRecovery: (key: string) => invoke<void>('clear_recovery', { key }),
  /** Systems with a gamelist.xml in their ROM folder (from es_systems paths when given). */
  listGamelists: (systems?: { name: string; path?: string }[]) => invoke<string[]>('list_gamelists', { systems }),
  readGamelist: (system: string, path?: string) => invoke<TextFile | null>('read_gamelist', { system, path }),
  listFonts: () => invoke<{ name: string; path: string; source: string }[]>('list_fonts'),
  addFontToTheme: (themeDir: string, src: string) => invoke<string>('add_font_to_theme', { themeDir, src }),
  downloadFont: (themeDir: string, url: string, fileName: string) => invoke<string>('download_font', { themeDir, url, fileName }),
  /** Every Google Fonts family, by name and category. */
  googleFonts: () => invoke<{ family: string; category: string }[]>('google_fonts'),
  /** Where a Google Fonts family's regular font file is (Open Font License families only). */
  googleFontFile: (family: string) => invoke<{ url: string; file_name: string }>('google_font_file', { family }),
  backupsDir: () => invoke<string>('backups_dir'),
  noticesPath: () => invoke<string>('notices_path'),
  copyTheme: (src: string, name: string) => invoke<string>('copy_theme', { src, name }),
  /** Zips a backup, then moves the folder to the Recycle Bin. Returns the backup path. */
  deleteTheme: (dir: string) => invoke<void>('delete_theme', { dir }),
  createThemeFromStarter: (name: string) => invoke<string>('create_theme_from_starter', { name }),
  /** Looks inside a theme .zip or folder (nothing is written): what would come in and what wouldn't. */
  inspectThemeImport: (source: string) => invoke<ImportPlan>('inspect_theme_import', { source }),
  /** Imports a theme .zip or folder as a new theme folder; returns its path. */
  importTheme: (source: string, name: string) => invoke<string>('import_theme', { source, name }),
  importAsset: (themeDir: string, src: string, destRelDir: string) =>
    invoke<string>('import_asset', { themeDir, src, destRelDir }),
  /** The asset library folder (in the app's data folder); created if needed. */
  assetLibraryDir: () => invoke<string>('asset_library_dir'),
  listLibraryAssets: () => invoke<LibraryAsset[]>('list_library_assets'),
  /** Copies files into the library by kind; nothing there is overwritten. */
  addLibraryAssets: (paths: string[]) => invoke<{ added: string[]; existing: string[]; problems: string[] }>('add_library_assets', { paths }),
  /** Moves a library file to the Recycle Bin. */
  removeLibraryAsset: (path: string) => invoke<void>('remove_library_asset', { path }),
  readThemesettings: (theme: string) => invoke<string>('read_themesettings', { theme }),
  setActiveTheme: (theme: string) => invoke<void>('set_active_theme', { theme }),
  /** Adds an error to the problem log on this PC (see problems.rs). */
  logProblem: (text: string) => invoke<void>('log_problem', { text }),
  /** The newest part of the problem log ("" when there is none). */
  readProblemLog: () => invoke<string>('read_problem_log'),
  problemLogPath: () => invoke<string>('problem_log_path'),
  clearProblemLog: () => invoke<void>('clear_problem_log'),
  launchRetrobat: () => invoke<void>('launch_retrobat'),
  /** Whether RetroBat's menus (EmulationStation) are open. */
  retrobatRunning: () => invoke<boolean>('retrobat_running'),
  /** Closes RetroBat the gentle way and waits for it; fails if it stays open. */
  closeRetrobat: () => invoke<void>('close_retrobat'),
  readIntro: () => invoke<IntroInfo>('read_intro'),
  /** Writes the intro settings into retrobat.ini (backed up the first time). */
  writeIntro: (settings: IntroSettings) => invoke<IntroInfo>('write_intro', { settings }),
};

export const tauriFs: ThemeFs = {
  listFiles: api.listThemeFiles,
  readXmlFiles: api.readThemeXml,
  loadAll: api.loadTheme,
};

const urlCache = new Map<string, string>();
/** Files created in this session (design artwork), shown before or without being on disk. */
// Reactive, so the preview picks up artwork the editor has just drawn (a SvelteMap works outside
// components too).
const virtualFiles = new SvelteMap<string, string>();

export function registerVirtualFile(path: string, content: string, mime = 'image/svg+xml') {
  virtualFiles.set(path.toLowerCase().replace(/\//g, '\\'), `data:${mime};charset=utf-8,${encodeURIComponent(content)}`);
}

/** URL the webview can load a local file from. */
export function fileUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const v = virtualFiles.get(path.toLowerCase().replace(/\//g, '\\'));
  if (v) return v;
  let u = urlCache.get(path);
  if (!u) {
    u = convertFileSrc(path);
    urlCache.set(path, u);
  }
  return u;
}
