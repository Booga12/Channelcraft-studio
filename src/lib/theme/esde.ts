// Export for ES-DE (#49): turns a RetroBat theme into an ES-DE theme. RetroBat's game lists each
// become an ES-DE variant; the console list becomes ES-DE's system view. Property names and values
// follow ES-DE's THEMES.md. What has no ES-DE equivalent is left out and listed in the notes.

import type { Environment } from './context';
import type { ThemeProject } from './project';
import { resolveAssetWithFallbacks, resolveTheme, type PropDef, type Resolution, type ResolvedElement, type ResolvedView } from './resolver';

/** A file of the exported theme: written from text, or copied from `src`. */
export interface EsdeFile {
  dest: string;
  text?: string;
  src?: string;
}

export interface EsdeExport {
  /** The theme's folder name inside the zip, ending in `-es-de` as ES-DE themes do. */
  folder: string;
  files: EsdeFile[];
  /** RetroBat game lists that became ES-DE variants. */
  variants: { name: string; label: string }[];
  /** What couldn't be carried over, in plain words. */
  notes: string[];
}

/** Lists the file names in a folder (empty when it can't be read). */
export type ListDir = (dir: string) => Promise<string[]>;

/** RetroBat game lists, in order, and their name as an ES-DE variant. */
export const GAME_LISTS: { view: string; variant: string; label: string }[] = [
  { view: 'detailed', variant: 'detailed', label: 'Detailed' },
  { view: 'video', variant: 'video', label: 'Video' },
  { view: 'grid', variant: 'grid', label: 'Grid' },
  { view: 'gamecarousel', variant: 'carousel', label: 'Carousel' },
  { view: 'basic', variant: 'simple', label: 'Simple' },
];

/** What every ES-DE element type accepts (from THEMES.md). */
export const ESDE_PROPS: Record<string, string[]> = {
  text: ['pos', 'size', 'origin', 'rotation', 'rotationOrigin', 'stationary', 'text', 'systemdata', 'metadata', 'defaultValue', 'systemNameSuffix', 'letterCaseSystemNameSuffix', 'metadataElement', 'gameselector', 'gameselectorEntry', 'container', 'containerType', 'containerVerticalSnap', 'containerScrollSpeed', 'containerStartDelay', 'containerResetDelay', 'containerScrollGap', 'fontPath', 'fontSize', 'horizontalAlignment', 'verticalAlignment', 'color', 'backgroundColor', 'backgroundMargins', 'backgroundCornerRadius', 'letterCase', 'lineSpacing', 'visible', 'zIndex'],
  datetime: ['pos', 'size', 'origin', 'rotation', 'rotationOrigin', 'stationary', 'metadata', 'defaultValue', 'gameselector', 'gameselectorEntry', 'fontPath', 'fontSize', 'horizontalAlignment', 'verticalAlignment', 'color', 'backgroundColor', 'backgroundMargins', 'backgroundCornerRadius', 'letterCase', 'lineSpacing', 'format', 'displayRelative', 'visible', 'zIndex'],
  image: ['pos', 'size', 'maxSize', 'cropSize', 'cropPos', 'origin', 'rotation', 'rotationOrigin', 'stationary', 'renderDuringTransitions', 'path', 'gameOverridePath', 'default', 'imageType', 'metadataElement', 'gameselector', 'gameselectorEntry', 'tile', 'tileSize', 'tileHorizontalAlignment', 'tileVerticalAlignment', 'interpolation', 'mipmap', 'cornerRadius', 'color', 'colorEnd', 'gradientType', 'scrollFadeIn', 'brightness', 'opacity', 'saturation', 'flipHorizontal', 'flipVertical', 'scaleFactor', 'visible', 'zIndex'],
  video: ['pos', 'size', 'maxSize', 'cropSize', 'cropPos', 'origin', 'rotation', 'rotationOrigin', 'stationary', 'path', 'default', 'defaultImage', 'imageType', 'metadataElement', 'gameselector', 'gameselectorEntry', 'iterationCount', 'onIterationsDone', 'audio', 'interpolation', 'imageCornerRadius', 'videoCornerRadius', 'color', 'colorEnd', 'gradientType', 'pillarboxes', 'pillarboxThreshold', 'scanlines', 'delay', 'fadeInType', 'fadeInTime', 'scrollFadeIn', 'brightness', 'opacity', 'saturation', 'visible', 'zIndex'],
  rating: ['pos', 'size', 'origin', 'rotation', 'rotationOrigin', 'stationary', 'gameselector', 'gameselectorEntry', 'interpolation', 'color', 'filledPath', 'unfilledPath', 'overlay', 'hideIfZero', 'opacity', 'saturation', 'visible', 'zIndex'],
  textlist: ['pos', 'size', 'origin', 'zIndex', 'selectorWidth', 'selectorHeight', 'selectorHorizontalOffset', 'selectorVerticalOffset', 'selectorColor', 'selectorColorEnd', 'selectorGradientType', 'selectorImagePath', 'selectorImageTile', 'primaryColor', 'secondaryColor', 'selectedColor', 'selectedSecondaryColor', 'selectedBackgroundColor', 'selectedSecondaryBackgroundColor', 'selectedBackgroundMargins', 'selectedBackgroundCornerRadius', 'textHorizontalScrolling', 'textHorizontalScrollSpeed', 'textHorizontalScrollDelay', 'textHorizontalScrollGap', 'fontPath', 'fontSize', 'horizontalAlignment', 'horizontalMargin', 'letterCase', 'letterCaseAutoCollections', 'letterCaseCustomCollections', 'lineSpacing', 'indicators', 'collectionIndicators', 'systemNameSuffix', 'letterCaseSystemNameSuffix', 'fadeAbovePrimary'],
  carousel: ['pos', 'size', 'origin', 'type', 'staticImage', 'imageType', 'defaultImage', 'defaultFolderImage', 'maxItemCount', 'itemsBeforeCenter', 'itemsAfterCenter', 'itemStacking', 'selectedItemMargins', 'selectedItemOffset', 'itemSize', 'itemScale', 'itemLinearScale', 'itemLinearSpacing', 'itemRotation', 'itemRotationOrigin', 'itemAxisHorizontal', 'itemAxisRotation', 'imageFit', 'imageCropPos', 'imageInterpolation', 'imageCornerRadius', 'imageColor', 'imageColorEnd', 'imageGradientType', 'imageSelectedColor', 'imageSelectedColorEnd', 'imageSelectedGradientType', 'imageBrightness', 'imageSaturation', 'itemTransitions', 'itemDiagonalOffset', 'itemHorizontalAlignment', 'itemVerticalAlignment', 'wheelHorizontalAlignment', 'wheelVerticalAlignment', 'horizontalOffset', 'verticalOffset', 'reflections', 'reflectionsOpacity', 'reflectionsFalloff', 'unfocusedItemOpacity', 'unfocusedItemSaturation', 'unfocusedItemDimming', 'fastScrolling', 'color', 'colorEnd', 'gradientType', 'text', 'textRelativeScale', 'textBackgroundCornerRadius', 'textColor', 'textBackgroundColor', 'textSelectedColor', 'textSelectedBackgroundColor', 'textHorizontalScrolling', 'textHorizontalScrollSpeed', 'textHorizontalScrollDelay', 'textHorizontalScrollGap', 'fontPath', 'fontSize', 'letterCase', 'letterCaseAutoCollections', 'letterCaseCustomCollections', 'lineSpacing', 'systemNameSuffix', 'letterCaseSystemNameSuffix', 'fadeAbovePrimary', 'zIndex'],
  grid: ['pos', 'size', 'origin', 'zIndex', 'staticImage', 'imageType', 'defaultImage', 'defaultFolderImage', 'imageFit', 'imageCropPos', 'imageInterpolation', 'imageRelativeScale', 'imageCornerRadius', 'imageColor', 'imageColorEnd', 'imageGradientType', 'imageSelectedColor', 'imageSelectedColorEnd', 'imageSelectedGradientType', 'imageBrightness', 'imageSaturation', 'itemSize', 'itemScale', 'itemSpacing', 'scaleInwards', 'fractionalRows', 'itemTransitions', 'rowTransitions', 'unfocusedItemOpacity', 'unfocusedItemSaturation', 'unfocusedItemDimming', 'backgroundImage', 'backgroundRelativeScale', 'backgroundCornerRadius', 'backgroundColor', 'backgroundColorEnd', 'backgroundGradientType', 'selectorImage', 'selectorRelativeScale', 'selectorLayer', 'selectorCornerRadius', 'selectorColor', 'selectorColorEnd', 'selectorGradientType', 'text', 'textRelativeScale', 'textBackgroundCornerRadius', 'textColor', 'textBackgroundColor', 'textSelectedColor', 'textSelectedBackgroundColor', 'textHorizontalScrolling', 'textHorizontalScrollSpeed', 'textHorizontalScrollDelay', 'textHorizontalScrollGap', 'fontPath', 'fontSize', 'letterCase', 'letterCaseAutoCollections', 'letterCaseCustomCollections', 'lineSpacing', 'systemNameSuffix', 'letterCaseSystemNameSuffix', 'fadeAbovePrimary'],
  helpsystem: ['pos', 'origin', 'scope', 'entries', 'entryLayout', 'textColor', 'textColorDimmed', 'iconColor', 'iconColorDimmed', 'fontPath', 'fontSize', 'entrySpacing', 'iconTextSpacing', 'entryRelativeScale', 'letterCase', 'opacity', 'backgroundColor', 'backgroundColorEnd', 'backgroundGradientType', 'backgroundHorizontalPadding', 'backgroundVerticalPadding', 'backgroundCornerRadius'],
  clock: ['pos', 'size', 'origin', 'scope', 'format', 'fontPath', 'fontSize', 'horizontalAlignment', 'verticalAlignment', 'color', 'backgroundColor', 'backgroundMargins', 'backgroundCornerRadius', 'letterCase', 'lineSpacing', 'opacity'],
  sound: ['path'],
};

/** Game art: RetroBat's field names (md_ elements, {game:…} paths, imageSource) to ES-DE's imageType. */
const ART: Record<string, string> = {
  image: 'miximage, screenshot',
  thumbnail: 'cover',
  boxart: 'cover',
  boxback: 'backcover',
  marquee: 'marquee',
  wheel: 'marquee',
  fanart: 'fanart',
  titleshot: 'titlescreen',
  cartridge: 'physicalmedia',
  mix: 'miximage',
  screenshot: 'screenshot',
};
/** Game details shown as text: RetroBat field to ES-DE metadata. */
const META: Record<string, string> = {
  name: 'name',
  description: 'description',
  desc: 'description',
  developer: 'developer',
  publisher: 'publisher',
  genre: 'genre',
  players: 'players',
  playcount: 'playcount',
  gametime: 'playtime',
  emulator: 'emulator',
};
/** md_lbl_ labels: the words RetroBat shows when the theme doesn't set its own. */
const LABELS: Record<string, string> = {
  developer: 'Developer:',
  publisher: 'Publisher:',
  genre: 'Genre:',
  players: 'Players:',
  releasedate: 'Released:',
  lastplayed: 'Last played:',
  playcount: 'Times played:',
  rating: 'Rating:',
  gametime: 'Game time:',
};
/** RetroBat part types in plain words, for the notes: one, many. */
const TYPE_WORDS: Record<string, [string, string]> = {
  screenshader: ['blur or screen effect', 'blur or screen effects'],
  ninepatch: ['stretchable frame', 'stretchable frames'],
  stackpanel: ['stacked group', 'stacked groups'],
  container: ['group of parts', 'groups of parts'],
  webimage: ['picture from the internet', 'pictures from the internet'],
  imagegrid: ['grid', 'grids'],
  menuIcons: ['menu icon set', 'menu icon sets'],
  batteryIndicator: ['battery indicator', 'battery indicators'],
  controllerActivity: ['controller indicator', 'controller indicators'],
  gameextras: ['game extras panel', 'game extras panels'],
  splash: ['loading screen part', 'loading screen parts'],
};

/** Navigation sounds both share. */
const SOUNDS = new Set(['systembrowse', 'quicksysselect', 'select', 'back', 'scroll', 'favorite', 'launch']);
/** RetroBat's game status icons, which ES-DE shows with its own badges instead. */
const STATUS_ICON = /^md_(no)?(t?kidgame|notkidgame|favorite|hidden|manual|nomanual|cheevos|notcheevos|savestate|nosavestate|flag|broken|completed)$/;

const PAIR = /^-?\d*\.?\d+\s+-?\d*\.?\d+$/;
const NUM = /^-?\d*\.?\d+$/;
const COLOR = /^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slash = (s: string) => s.replace(/\\/g, '/');
const truthy = (v: string | undefined) => v === 'true' || v === '1';

/** Folder name for the exported theme: plain characters, ending in -es-de. */
export function esdeFolder(name: string): string {
  const base = name.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'theme';
  return base.endsWith('-es-de') ? base : `${base}-es-de`;
}

class Out {
  props: [string, string][] = [];
  constructor(
    readonly type: string,
    readonly name: string,
  ) {}
  set(name: string, value: string | null | undefined) {
    if (value === null || value === undefined || value === '') return;
    const i = this.props.findIndex(([n]) => n === name);
    if (i >= 0) this.props[i] = [name, value];
    else this.props.push([name, value]);
  }
  has(name: string) {
    return this.props.some(([n]) => n === name);
  }
  toXml(indent: string): string {
    const lines = this.props.map(([n, v]) => `${indent}  <${n}>${xml(v)}</${n}>`);
    return `${indent}<${this.type} name="${this.name}">\n${lines.join('\n')}\n${indent}</${this.type}>`;
  }
}

class Converter {
  files = new Map<string, string>();
  notes = new Set<string>();
  skipped = new Map<string, number>();

  constructor(
    readonly project: ThemeProject,
    readonly env: Environment,
    readonly res: Resolution,
    readonly listDir: ListDir,
  ) {}

  note(s: string) {
    this.notes.add(s);
  }
  skip(what: string) {
    this.skipped.set(what, (this.skipped.get(what) ?? 0) + 1);
  }

  /** A prop's value, if it has one that ES can read without a condition or binding. */
  val(el: ResolvedElement, name: string): string | undefined {
    const d = el.props.get(name);
    if (!d) return undefined;
    const v = d.value.trim();
    return v === '' ? undefined : v;
  }
  pair(el: ResolvedElement, name: string) {
    const v = this.val(el, name)?.replace(/\s+/g, ' ');
    return v && PAIR.test(v) ? v : undefined;
  }
  num(el: ResolvedElement, name: string) {
    const v = this.val(el, name);
    return v && NUM.test(v) ? v : undefined;
  }
  color(el: ResolvedElement, name: string) {
    const v = this.val(el, name)?.replace(/^#/, '');
    return v && COLOR.test(v) ? v.toUpperCase() : undefined;
  }

  /** Does the value of a prop come from the console being shown (`${system.theme}`)? */
  perConsole(d: PropDef): boolean {
    let raw = d.raw;
    for (let i = 0; i < 5; i++) {
      if (raw.includes('${system.theme}')) return true;
      const m = raw.match(/\$\{([^}]+)\}/);
      const v = m ? this.res.vars.get(m[1]) : undefined;
      if (!v) return false;
      raw = v.raw;
    }
    return false;
  }

  /** Where an exported file goes, relative to the theme folder. */
  dest(abs: string): string {
    const a = slash(abs);
    const dir = slash(this.project.dir).replace(/\/$/, '');
    if (a.toLowerCase().startsWith(dir.toLowerCase() + '/')) return a.slice(dir.length + 1);
    const home = slash(this.env.esHome).replace(/\/$/, '');
    if (a.toLowerCase().startsWith(home.toLowerCase() + '/')) return `_retrobat/${a.slice(home.length + 1)}`;
    return `_extra/${a.split('/').pop()}`;
  }

  /** A picture, font or sound the element uses: copied into the export, as a path ES-DE reads. */
  async asset(el: ResolvedElement, prop: string): Promise<string | undefined> {
    const d = el.props.get(prop);
    if (!d || /^\s*:\//.test(d.raw)) return undefined; // RetroBat's own built-in files
    const found = resolveAssetWithFallbacks(el, prop, this.res, this.project, this.env);
    const abs = found ? await this.existing(found) : null;
    if (!abs) return undefined;
    const res = slash(this.env.resourcesDir).toLowerCase();
    if (slash(abs).toLowerCase().startsWith(res + '/')) return undefined;
    const dest = this.dest(abs);
    const sys = this.env.settings.system.theme;
    if (sys && this.perConsole(d)) {
      const ref = await this.perConsoleFiles(abs, dest, sys);
      if (ref) return `./${ref}`;
    }
    this.files.set(dest, abs);
    return `./${dest}`;
  }

  private dirs = new Map<string, Promise<string[]>>();
  async exists(abs: string): Promise<boolean> {
    const a = slash(abs);
    const dir = a.slice(0, a.lastIndexOf('/'));
    if (!this.dirs.has(dir)) this.dirs.set(dir, this.listDir(dir));
    const names = await this.dirs.get(dir)!;
    const file = a.slice(a.lastIndexOf('/') + 1).toLowerCase();
    return names.some((n) => n.toLowerCase() === file);
  }

  /**
   * The file itself if it's there. Otherwise the theme's own file with the same tail
   * (`./../art/fonts/x.ttf` written in the wrong folder still finds `art/fonts/x.ttf`), as RetroBat
   * forgives; or nothing.
   */
  async existing(abs: string): Promise<string | null> {
    if (abs.includes('${') || (await this.exists(abs))) return abs;
    const parts = slash(abs).split('/');
    for (let n = Math.min(4, parts.length); n >= 2; n--) {
      const tail = parts.slice(-n).join('/').toLowerCase();
      const hit = this.project.assets.find((a) => a.rel.toLowerCase() === tail || a.rel.toLowerCase().endsWith('/' + tail));
      if (hit) return `${slash(this.project.dir)}/${hit.rel}`;
    }
    this.note('Some pictures or fonts the theme names couldn’t be found, so they’re left out.');
    return null;
  }

  /** Copies every console's version of a per-console file; returns the path with ${system.theme}. */
  async perConsoleFiles(abs: string, dest: string, sys: string): Promise<string | null> {
    const a = slash(abs);
    const parts = a.split('/');
    const destParts = dest.split('/');
    const file = parts[parts.length - 1];
    // The console's name in the file name (art/logos/snes-w.svg)…
    const at = file.lastIndexOf(sys);
    if (at >= 0) {
      const before = file.slice(0, at);
      const after = file.slice(at + sys.length);
      const dir = parts.slice(0, -1).join('/');
      const re = new RegExp(`^${esc(before)}(.+)${esc(after)}$`);
      for (const f of await this.listDir(dir)) if (re.test(f)) this.files.set([...destParts.slice(0, -1), f].join('/'), `${dir}/${f}`);
      return [...destParts.slice(0, -1), `${before}\${system.theme}${after}`].join('/');
    }
    // …or as the folder it's in (art/snes/logo.png).
    if (parts.length > 2 && parts[parts.length - 2] === sys) {
      const parent = parts.slice(0, -2).join('/');
      for (const sub of await this.listDir(parent)) {
        if ((await this.listDir(`${parent}/${sub}`)).includes(file)) this.files.set([...destParts.slice(0, -2), sub, file].join('/'), `${parent}/${sub}/${file}`);
      }
      return [...destParts.slice(0, -2), '${system.theme}', file].join('/');
    }
    return null;
  }

  /** pos, size, origin, rotation and zIndex, which every element shares. */
  place(el: ResolvedElement, o: Out, sizes: string[] = ['size']) {
    o.set('pos', this.pair(el, 'pos'));
    for (const s of sizes) o.set(s, this.pair(el, s));
    o.set('origin', this.pair(el, 'origin'));
    o.set('rotation', this.num(el, 'rotation'));
    o.set('rotationOrigin', this.pair(el, 'rotationOrigin'));
    o.set('zIndex', this.num(el, 'zIndex'));
  }

  font(el: ResolvedElement, o: Out) {
    return this.asset(el, 'fontPath').then((p) => {
      o.set('fontPath', p);
      o.set('fontSize', this.num(el, 'fontSize'));
      if (truthy(this.val(el, 'forceUppercase'))) o.set('letterCase', 'uppercase');
      o.set('lineSpacing', this.num(el, 'lineSpacing'));
    });
  }

  align(el: ResolvedElement, o: Out) {
    const h = this.val(el, 'alignment') ?? this.val(el, 'horizontalAlignment');
    if (h && ['left', 'center', 'right'].includes(h)) o.set('horizontalAlignment', h);
    const v = this.val(el, 'verticalAlignment');
    if (v && ['top', 'center', 'bottom'].includes(v)) o.set('verticalAlignment', v);
  }

  /** The element's own type, for md_ parts that only set a few things (`control` in the resolver). */
  typeOf(el: ResolvedElement): string {
    if (el.type !== 'control') return el.type;
    if (el.name === 'md_video') return 'video';
    if (el.name === 'md_rating') return 'rating';
    if (/^md_(releasedate|lastplayed)$/.test(el.name)) return 'datetime';
    if (/^md_(name|description|developer|publisher|genre|players|playcount|gametime|lbl_.+)$/.test(el.name)) return 'text';
    if (el.name.startsWith('md_')) return 'image';
    return 'control';
  }

  /** The game field an element shows: from its md_ name or a single {game:…} binding. */
  gameField(el: ResolvedElement, prop: string): string | undefined {
    const m = el.name.match(/^md_(.+)$/);
    if (m && !m[1].startsWith('lbl_')) return m[1];
    const raw = el.props.get(prop)?.raw.trim() ?? '';
    const b = raw.match(/^\{game:([a-z]+)\}$/i);
    return b?.[1].toLowerCase();
  }

  /** Converts one element; null when ES-DE has nothing like it. */
  async element(el: ResolvedElement, view: ResolvedView, isSystem: boolean): Promise<Out | null> {
    const type = this.typeOf(el);
    const vis = this.val(el, 'visible');
    if (vis === 'false' || vis === '0') return null;
    if (vis && vis !== 'true' && vis !== '1') this.note('Parts that RetroBat shows or hides depending on the game or console are always shown.');
    const name = el.name.replace(/[^A-Za-z0-9_-]+/g, '_');
    if (STATUS_ICON.test(el.name)) {
      this.note('Game status icons (favorite, kid game, manual and so on) are left out: ES-DE shows these with its own badges.');
      return null;
    }
    // md_ parts the theme never placed: RetroBat's defaults for them aren't known here.
    if (el.name.startsWith('md_') && !el.props.has('pos') && !el.props.has('size') && !el.props.has('maxSize')) return null;

    switch (type) {
      case 'image': {
        if (isSystem && el.name === 'logo') return null; // becomes the carousel's logos
        const o = new Out('image', name);
        this.place(el, o, ['size', 'maxSize']);
        const field = this.gameField(el, 'path');
        if (field && ART[field]) o.set('imageType', ART[field]);
        else if (field) return (this.skip(`game picture "${field}"`), null);
        else {
          const p = await this.asset(el, 'path');
          if (!p) return null;
          o.set('path', p);
        }
        if (!o.has('size') && !o.has('maxSize')) {
          const min = this.pair(el, 'minSize');
          if (min) o.set('cropSize', min);
        }
        o.set('color', this.color(el, 'color'));
        o.set('colorEnd', this.color(el, 'colorEnd'));
        const g = this.val(el, 'gradientType');
        if (g === 'horizontal' || g === 'vertical') o.set('gradientType', g);
        if (truthy(this.val(el, 'tile'))) o.set('tile', 'true');
        if (truthy(this.val(el, 'linearSmooth'))) o.set('interpolation', 'linear');
        const op = this.num(el, 'opacity');
        if (op && Number(op) <= 1) o.set('opacity', op);
        if (el.props.has('storyboard') || el.complex.length) this.note('RetroBat animations (storyboards) are left out.');
        return o;
      }
      case 'video': {
        const o = new Out('video', name);
        this.place(el, o, ['size', 'maxSize']);
        o.set('delay', this.num(el, 'delay'));
        if (truthy(this.val(el, 'showSnapshotNoVideo')) || truthy(this.val(el, 'showSnapshotDelay'))) o.set('imageType', 'miximage, screenshot');
        o.set('defaultImage', await this.asset(el, 'defaultSnapshot'));
        return o;
      }
      case 'text': {
        if (isSystem && el.name === 'logoText') return null; // becomes the carousel's text
        const o = new Out('text', name);
        this.place(el, o);
        const raw = el.props.get('text')?.raw.trim() ?? '';
        const lbl = el.name.match(/^md_lbl_(.+)$/);
        const field = lbl ? undefined : this.gameField(el, 'text');
        if (lbl) o.set('text', this.val(el, 'text') ?? LABELS[lbl[1]] ?? '');
        else if (field && META[field]) o.set('metadata', META[field]);
        else if (isSystem && (el.name === 'systemInfo' || /\{binding:total\}|\$\{system\.(gameCount|totalGames)\}/i.test(raw))) o.set('systemdata', 'gamecountGames');
        else if (raw === '${system.fullName}') o.set('systemdata', 'fullname');
        else if (raw === '${system.name}') o.set('systemdata', 'name');
        else if (field || /[{]|\$\{system\./.test(raw)) {
          this.note('Texts that mix your own words with RetroBat details, or show details ES-DE doesn’t have, are left out.');
          return null;
        } else {
          const t = this.val(el, 'text');
          if (!t) return null;
          o.set('text', t);
        }
        if (!o.has('text') && !o.has('metadata') && !o.has('systemdata')) return null;
        await this.font(el, o);
        this.align(el, o);
        o.set('color', this.color(el, 'color'));
        o.set('backgroundColor', this.color(el, 'backgroundColor'));
        return o;
      }
      case 'datetime': {
        const field = this.gameField(el, 'text') ?? '';
        if (field !== 'releasedate' && field !== 'lastplayed') return null;
        const o = new Out('datetime', name);
        this.place(el, o);
        o.set('metadata', field);
        await this.font(el, o);
        this.align(el, o);
        o.set('color', this.color(el, 'color'));
        o.set('backgroundColor', this.color(el, 'backgroundColor'));
        const f = this.val(el, 'format');
        if (f) o.set('format', f);
        const rel = this.val(el, 'displayRelative');
        if (rel) o.set('displayRelative', truthy(rel) ? 'true' : 'false');
        return o;
      }
      case 'rating': {
        const o = new Out('rating', name);
        this.place(el, o);
        o.set('color', this.color(el, 'color'));
        o.set('filledPath', await this.asset(el, 'filledPath'));
        o.set('unfilledPath', await this.asset(el, 'unfilledPath'));
        if (truthy(this.val(el, 'linearSmooth'))) o.set('interpolation', 'linear');
        return o;
      }
      case 'textlist': {
        const o = new Out('textlist', name);
        this.place(el, o);
        for (const c of ['primaryColor', 'secondaryColor', 'selectedColor', 'selectorColor', 'selectorColorEnd']) o.set(c, this.color(el, c));
        const g = this.val(el, 'selectorGradientType');
        if (g === 'horizontal' || g === 'vertical') o.set('selectorGradientType', g);
        o.set('selectorHeight', this.num(el, 'selectorHeight'));
        o.set('selectorVerticalOffset', this.num(el, 'selectorOffsetY'));
        o.set('selectorImagePath', await this.asset(el, 'selectorImagePath'));
        if (truthy(this.val(el, 'selectorImageTile'))) o.set('selectorImageTile', 'true');
        o.set('horizontalMargin', this.num(el, 'horizontalMargin'));
        await this.font(el, o);
        const h = this.val(el, 'alignment');
        if (h && ['left', 'center', 'right'].includes(h)) o.set('horizontalAlignment', h);
        return o;
      }
      case 'carousel':
      case 'gamecarousel':
        return this.carousel(el, view, isSystem);
      case 'imagegrid':
        return this.grid(el, view);
      case 'helpsystem': {
        const o = new Out('helpsystem', name);
        o.set('pos', this.pair(el, 'pos'));
        o.set('origin', this.pair(el, 'origin'));
        for (const c of ['textColor', 'iconColor']) o.set(c, this.color(el, c));
        o.set('fontPath', await this.asset(el, 'fontPath'));
        o.set('fontSize', this.num(el, 'fontSize'));
        return o;
      }
      case 'clock': {
        const o = new Out('clock', name);
        this.place(el, o);
        o.props = o.props.filter(([n]) => n !== 'rotation' && n !== 'rotationOrigin' && n !== 'zIndex');
        await this.font(el, o);
        o.set('color', this.color(el, 'color'));
        const f = this.val(el, 'format');
        if (f) o.set('format', f);
        return o;
      }
      case 'sound':
      case 'control': // only clipping or similar was set: nothing to draw
        return null; // sounds are gathered separately
      default:
        this.skip(type);
        return null;
    }
  }

  async carousel(el: ResolvedElement, view: ResolvedView, isSystem: boolean): Promise<Out> {
    const o = new Out('carousel', el.name.replace(/[^A-Za-z0-9_-]+/g, '_'));
    this.place(el, o);
    o.props = o.props.filter(([n]) => n !== 'rotation' && n !== 'rotationOrigin');
    const t = this.val(el, 'type');
    const types: Record<string, string> = { horizontal: 'horizontal', vertical: 'vertical', horizontal_wheel: 'horizontalWheel', vertical_wheel: 'verticalWheel' };
    if (t && types[t]) o.set('type', types[t]);
    o.set('itemSize', this.pair(el, 'logoSize'));
    o.set('itemScale', this.num(el, 'logoScale'));
    o.set('maxItemCount', this.num(el, 'maxLogoCount'));
    o.set('itemRotation', this.num(el, 'logoRotation'));
    o.set('itemRotationOrigin', this.pair(el, 'logoRotationOrigin'));
    o.set('unfocusedItemOpacity', this.num(el, 'minLogoOpacity'));
    o.set('color', this.color(el, 'color'));
    o.set('colorEnd', this.color(el, 'colorEnd'));
    const g = this.val(el, 'gradientType');
    if (g === 'horizontal' || g === 'vertical') o.set('gradientType', g);
    if (isSystem) {
      // RetroBat draws each console's logo from the system view's `logo` image.
      const logo = view.elements.get('logo');
      if (logo) o.set('staticImage', await this.asset(logo, 'path'));
      const text = view.elements.get('logoText');
      if (text) {
        o.set('fontPath', await this.asset(text, 'fontPath'));
        o.set('fontSize', this.num(text, 'fontSize'));
        o.set('textColor', this.color(text, 'color'));
        if (truthy(this.val(text, 'forceUppercase'))) o.set('letterCase', 'uppercase');
      }
    } else {
      o.set('imageType', ART[this.val(el, 'imageSource') ?? 'marquee'] ?? 'marquee');
    }
    return o;
  }

  async grid(el: ResolvedElement, view: ResolvedView): Promise<Out> {
    const o = new Out('grid', el.name.replace(/[^A-Za-z0-9_-]+/g, '_'));
    this.place(el, o);
    o.props = o.props.filter(([n]) => n !== 'rotation' && n !== 'rotationOrigin');
    o.set('imageType', ART[this.val(el, 'imageSource') ?? 'thumbnail'] ?? 'cover');
    // RetroBat lays the grid out by columns and rows; ES-DE by the size of one item.
    const auto = this.val(el, 'autoLayout')?.split(/\s+/).map(Number);
    const size = this.pair(el, 'size')?.split(' ').map(Number);
    if (auto?.length === 2 && auto.every((n) => n > 0) && size) {
      o.set('itemSize', `${((size[0] / auto[0]) * 0.85).toFixed(3)} ${((size[1] / auto[1]) * 0.85).toFixed(3)}`);
      this.note('Grid layouts are close, not exact: ES-DE sizes grid items differently.');
    }
    o.set('itemScale', this.num(el, 'autoLayoutSelectedZoom'));
    const def = [...view.elements.values()].find((e) => e.type === 'gridtile' && e.name === 'default');
    const sel = [...view.elements.values()].find((e) => e.type === 'gridtile' && e.name === 'selected');
    if (def) {
      o.set('backgroundColor', this.color(def, 'backgroundColor'));
      o.set('imageColor', this.color(def, 'imageColor'));
    }
    if (sel) {
      o.set('selectorColor', this.color(sel, 'backgroundColor') ?? this.color(sel, 'backgroundCenterColor'));
      o.set('imageSelectedColor', this.color(sel, 'imageColor'));
    }
    return o;
  }

  async view(view: ResolvedView, isSystem: boolean): Promise<Out[]> {
    const out: Out[] = [];
    const taken = new Set<string>();
    for (const el of [...view.elements.values()].sort((a, b) => a.order - b.order)) {
      if (el.type === 'gridtile') continue; // part of the grid
      const o = await this.element(el, view, isSystem);
      if (!o) continue;
      const key = `${o.type}:${o.name}`;
      if (taken.has(key)) continue;
      taken.add(key);
      out.push(o);
    }
    return out;
  }

  async sounds(): Promise<Out[]> {
    const out = new Map<string, Out>();
    for (const v of this.res.views.values()) {
      for (const el of v.elements.values()) {
        if (el.type !== 'sound' || !SOUNDS.has(el.name) || out.has(el.name)) continue;
        const p = await this.asset(el, 'path');
        if (!p) continue;
        const o = new Out('sound', el.name);
        o.set('path', p);
        out.set(el.name, o);
      }
    }
    return [...out.values()];
  }
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Converts a RetroBat theme to ES-DE. `env` picks the console the per-console parts come from. */
export async function toEsde(project: ThemeProject, env: Environment, listDir: ListDir, themeName = project.name): Promise<EsdeExport> {
  const res = resolveTheme(project, env);
  const c = new Converter(project, env, res, listDir);
  const folder = esdeFolder(themeName);

  const lists = GAME_LISTS.filter((g) => {
    const v = res.views.get(g.view);
    return v && !v.custom && v.elements.size > 0;
  });
  const variants = lists.map((g) => ({ name: g.variant, label: g.label }));

  const body: string[] = [];
  const sounds = await c.sounds();
  if (sounds.length) body.push(`  <view name="all">\n${sounds.map((s) => s.toXml('    ')).join('\n')}\n  </view>`);
  const system = res.views.get('system');
  if (system) body.push(`  <view name="system">\n${(await c.view(system, true)).map((o) => o.toXml('    ')).join('\n')}\n  </view>`);
  for (const g of lists) {
    const els = await c.view(res.views.get(g.view)!, false);
    body.push(`  <variant name="${g.variant}">\n    <view name="gamelist">\n${els.map((o) => o.toXml('      ')).join('\n')}\n    </view>\n  </variant>`);
  }
  const theme = `<?xml version="1.0"?>\n<!-- Made with ChannelCraft Studio from the RetroBat theme “${xml(project.name)}”. -->\n<theme>\n${body.join('\n')}\n</theme>\n`;
  const caps = `<?xml version="1.0"?>\n<themeCapabilities>\n  <themeName>${xml(themeName)}</themeName>\n${variants.map((v) => `  <variant name="${v.name}">\n    <label>${xml(v.label)}</label>\n    <selectable>true</selectable>\n  </variant>`).join('\n')}\n</themeCapabilities>\n`;

  // What has no ES-DE equivalent.
  // Names some themes write with variables (${basicGridName}): filled in, or not shown.
  const filled = (s: string | null | undefined) => {
    const t = (s ?? '').replace(/\$\{([^}]+)\}/g, (m, n: string) => res.vars.get(n.trim())?.value ?? m);
    return t && !t.includes('${') ? t : null;
  };
  const custom = [...res.views.values()].filter((v) => v.custom).map((v) => filled(v.displayName) ?? filled(v.name));
  if (custom.length) {
    const named = custom.filter(Boolean);
    c.note(`${custom.length} extra screen${custom.length === 1 ? '' : 's'}${named.length ? ` (${named.join(', ')})` : ''} ${custom.length === 1 ? 'is' : 'are'} left out: ES-DE only has the console list and one game list.`);
  }
  if (res.views.has('menu')) c.note('Menu and settings screen styling is left out: ES-DE styles its menus itself.');
  if (project.files.has('splash.xml') || project.assets.some((a) => /(^|\/)(splash|gamesplash)\.xml$/i.test(a.rel))) c.note('Loading and game launch screens are left out.');
  if (res.subsets.length) c.note(`The theme’s ${res.subsets.length} option${res.subsets.length === 1 ? '' : 's'} (colors, layouts and so on) are exported with their default choices.`);
  if (res.unknownConditions || [...res.views.values()].some((v) => [...v.elements.values()].some((e) => e.conditional))) c.note(`Parts that change per console use ${env.settings.system.fullName}’s version.`);
  if (c.skipped.size) {
    const words = [...c.skipped].map(([type, n]) => {
      const [one, many] = TYPE_WORDS[type] ?? [`${type} part`, `${type} parts`];
      return `${n} ${n === 1 ? one : many}`;
    });
    c.note(`Also left out, as ES-DE has nothing like them: ${words.join(', ')}.`);
  }

  const notes = [...c.notes];
  const readme = [
    `${themeName} for ES-DE`,
    '',
    `Made with ChannelCraft Studio from the RetroBat theme “${project.name}”.`,
    `Copy the “${folder}” folder into ES-DE's themes folder, restart ES-DE and pick the theme in UI settings.`,
    variants.length ? `Game list styles (Theme variant in ES-DE's UI settings): ${variants.map((v) => v.label).join(', ')}.` : '',
    '',
    'What was left out or changed:',
    ...(notes.length ? notes.map((n) => `- ${n}`) : ['- Nothing.']),
    '',
  ].join('\n');

  const files: EsdeFile[] = [
    { dest: `${folder}/capabilities.xml`, text: caps },
    { dest: `${folder}/theme.xml`, text: theme },
    { dest: `${folder}/CONVERSION-NOTES.txt`, text: readme },
    ...[...c.files].map(([dest, src]) => ({ dest: `${folder}/${dest}`, src })),
  ];
  return { folder, files, variants, notes };
}

/** Checks an exported theme.xml against ES-DE's rules: every element type and property is known. */
export function checkEsde(themeXml: string): string[] {
  const problems: string[] = [];
  // Innermost named blocks only: the elements, not the views and variants around them.
  const block = /<(\w+) name="([^"]*)">((?:(?!<\w+ name=")[\s\S])*?)<\/\1>/g;
  for (const m of themeXml.matchAll(block)) {
    const [, type, name, inner] = m;
    if (type === 'view' || type === 'variant') continue;
    const allowed = ESDE_PROPS[type];
    if (!allowed) {
      problems.push(`unknown element type <${type}> (${name})`);
      continue;
    }
    for (const p of inner.matchAll(/<(\w+)>/g)) if (!allowed.includes(p[1])) problems.push(`<${type} name="${name}"> has <${p[1]}>`);
  }
  return problems;
}
