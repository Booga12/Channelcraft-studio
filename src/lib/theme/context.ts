import { MOCK_GAME, MOCK_GAMES, type SystemInfo } from './systems';
import type { Value } from './expr';
import { gameBinding, type GameInfo } from './games';

export type Ratio = '16/9' | '4/3' | '16/10';

export interface PreviewSettings {
  system: SystemInfo;
  /** Chosen option per subset name; missing entries use the theme's default (first option). */
  subsets: Record<string, string>;
  lang: string;
  region: string;
  ratio: Ratio;
  tinyScreen: boolean;
  verticalScreen: boolean;
  helpPrompts: boolean;
  cheevos: boolean;
  /** Preview only: long sample names, to check that text still fits. */
  longNames?: boolean;
}

/** Long names the preview shows with `longNames`, to test that text fits. */
export const LONG_SYSTEM_NAME = 'Nintendo Entertainment System';
export const LONG_GAME_NAME = 'The Legend of Zelda: A Link to the Past';

export interface Environment {
  settings: PreviewSettings;
  /** `.emulationstation` folder, for `~/` paths. */
  esHome: string;
  /** EmulationStation resources folder, for `:/` paths. */
  resourcesDir: string;
  /** A real scraped game to preview with; sample data is used when missing. */
  game?: GameInfo;
  /** Names for the game list rows. */
  gameNames?: string[];
  /** The console's games with their media, for grids and carousels of games. */
  games?: GameInfo[];
}

/** Where the shown game sits in the preview's game list (env.games, else the row names). */
export function currentGameIndex(env: Pick<Environment, 'game' | 'games' | 'gameNames'>): number {
  const path = env.game?.path;
  if (path && env.games?.length) {
    const i = env.games.findIndex((g) => g.path === path);
    if (i >= 0) return i;
  }
  return Math.max(0, (env.gameNames ?? MOCK_GAMES).indexOf(env.game?.name ?? MOCK_GAME.name));
}

/**
 * The rows a text list shows, as RetroBat draws them: the list doesn't wrap or repeat,
 * the current game sits in the middle when it can, and the list stops at its top and bottom.
 */
export function listWindow(names: string[], cur: number, count: number): { rows: string[]; sel: number } {
  const n = names.length;
  if (!n || count < 1) return { rows: [], sel: -1 };
  const c = Math.min(Math.max(0, cur), n - 1);
  const start = Math.max(0, Math.min(c - Math.floor(count / 2), n - count));
  return { rows: names.slice(start, start + count), sel: c - start };
}

/** `count` row names for a game grid, turned so the current game (`cur`) is on tile `sel`. */
export function listRows(names: string[], cur: number, count: number, sel: number): string[] {
  const n = names.length;
  if (!n) return [];
  return Array.from({ length: count }, (_, i) => names[(((cur - sel + i) % n) + n) % n]);
}

export const ARCH = ['windows', 'win32', 'x86_64', 'x64', 'win64'];

export function screenSize(s: PreviewSettings): { width: number; height: number } {
  const base = s.ratio === '4/3' ? { width: 1440, height: 1080 } : s.ratio === '16/10' ? { width: 1728, height: 1080 } : { width: 1920, height: 1080 };
  return s.verticalScreen ? { width: base.height, height: base.width } : base;
}

/** Built-in `${...}` variables. */
export function builtinVar(name: string, env: Environment, themeDir: string, subsets: Map<string, string>): string | undefined {
  const s = env.settings;
  const sys = s.system;
  const { width, height } = screenSize(s);
  switch (name) {
    case 'system.name':
      return sys.name;
    case 'system.theme':
      return sys.theme;
    case 'system.fullName':
      return s.longNames ? LONG_SYSTEM_NAME : sys.fullName;
    case 'system.manufacturer':
      return sys.manufacturer;
    case 'system.releaseYear':
      return sys.releaseYear;
    case 'system.hardwareType':
      return sys.hardwareType;
    case 'lang':
      return s.lang;
    case 'region':
      return s.region;
    case 'screen.ratio':
      return s.ratio;
    case 'screen.width':
      return String(width);
    case 'screen.height':
      return String(height);
    case 'screen.vertical':
      return String(s.verticalScreen);
    case 'themePath':
      return themeDir;
  }
  if (name.startsWith('subset.')) return subsets.get(name.slice(7)) ?? '';
  if (name.startsWith('global.')) return globalValue(name.slice(7), s);
  return undefined;
}

function globalValue(name: string, s: PreviewSettings): string | undefined {
  switch (name.toLowerCase()) {
    case 'cheevos':
    case 'retroachievements':
      return String(s.cheevos);
    case 'netplay':
      return 'false';
    case 'language':
      return s.lang;
    case 'help':
    case 'helpprompts':
      return String(s.helpPrompts);
    case 'battery':
      return 'false';
    case 'ip':
    case 'network':
      return 'true';
    case 'architecture':
      return 'x86_64';
  }
  return undefined;
}

/** Value of a `{...}` binding such as `{system:fullName}` or `{screen.ratio}`. */
export function bindingValue(name: string, env: Environment, subsets: Map<string, string>): Value | undefined {
  const s = env.settings;
  const [scope, ...rest] = name.split(/[:.]/);
  const key = rest.join('.');
  switch (scope.toLowerCase()) {
    case 'screen': {
      const { width, height } = screenSize(s);
      if (key === 'ratio') return s.ratio;
      if (key === 'width') return width;
      if (key === 'height') return height;
      if (key === 'vertical') return s.verticalScreen;
      return undefined;
    }
    case 'system': {
      const k = key.toLowerCase();
      const real = env.gameNames?.length;
      if (k === 'total' || k === 'gamecount') return real ?? 128;
      if (k === 'played') return real ? Math.ceil(real / 3) : 37;
      if (k === 'favorites') return real ? Math.ceil(real / 8) : 9;
      // A random game's art: the preview borrows the current game's.
      if (k.startsWith('random') && env.game) {
        const what = k.split('.').pop() ?? 'image';
        const m = env.game.media;
        return m[what] ?? (what === 'fanart' ? (m.fanart ?? m.image) : what === 'thumbnail' ? (m.thumbnail ?? m.image) : m.image) ?? '';
      }
      if (k === 'image' || k === 'thumbnail' || k === 'video' || k === 'marquee' || k.startsWith('random')) return '';
      return builtinVar(`system.${key}`, env, '', subsets) ?? builtinVar(`system.${key[0]?.toLowerCase()}${key.slice(1)}`, env, '', subsets) ?? '';
    }
    case 'game': {
      // {game:system:theme} and friends: the game's own console (the same one in the preview).
      if (key.toLowerCase().startsWith('system.')) return bindingValue(`system:${key.slice(7)}`, env, subsets);
      if (s.longNames && /^(name|namenoextra|fullnamenotags|nameshort)$/i.test(key)) return LONG_GAME_NAME;
      if (env.game) {
        const v = gameBinding(env.game, key);
        return v === undefined ? '' : v;
      }
      const g = MOCK_GAME as unknown as Record<string, Value>;
      const k = key.toLowerCase();
      if (k in g) return g[k];
      if (k === 'year') return MOCK_GAME.releasedate.slice(0, 4);
      if (k === 'stars') return '4';
      // Media paths (image, thumbnail, boxart, video, ...) don't exist in the preview.
      return '';
    }
    case 'global':
      return globalValue(key, s) ?? '';
    case 'subset':
      return subsets.get(key) ?? '';
    case 'lang':
      return s.lang;
    case 'random': {
      // In the system view, {random} is a random game's video and {random:image} etc. its art;
      // the preview borrows the current game's.
      const m = env.game?.media;
      if (!m) return key ? '' : 0;
      const k = key.toLowerCase();
      if (!k) return m.video ?? '';
      return m[k] ?? (k === 'fanart' || k === 'thumbnail' ? m.image : undefined) ?? '';
    }
  }
  return undefined;
}
