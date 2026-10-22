// What the property panel knows about each element type. Unknown properties still show up,
// with an editor inferred from their name and value.

export type Kind =
  | 'pair'
  | 'color'
  | 'float'
  | 'int'
  | 'bool'
  | 'path'
  | 'font'
  | 'sound'
  | 'video'
  | 'alignment'
  | 'valign'
  | 'enum'
  | 'string'
  | 'text';

export interface PropSpec {
  name: string;
  kind: Kind;
  options?: string[];
  hint?: string;
  group: 'layout' | 'look' | 'content' | 'behavior';
}

const p = (name: string, kind: Kind, group: PropSpec['group'], extra: Partial<PropSpec> = {}): PropSpec => ({ name, kind, group, ...extra });

const LAYOUT = [
  p('pos', 'pair', 'layout', { hint: 'Position as a fraction of the screen (x y)' }),
  p('size', 'pair', 'layout', { hint: 'Size as a fraction of the screen; 0 keeps the aspect ratio' }),
  p('origin', 'pair', 'layout', { hint: 'Anchor point inside the element (0 0 = top left, 0.5 0.5 = centre)' }),
  p('rotation', 'float', 'layout'),
  p('rotationOrigin', 'pair', 'layout'),
  p('zIndex', 'float', 'layout', { hint: 'Higher draws on top' }),
  p('visible', 'bool', 'behavior'),
  p('opacity', 'float', 'look', { hint: '0 to 1' }),
];

const FONT = [
  p('fontPath', 'font', 'look'),
  p('fontSize', 'float', 'look', { hint: 'Fraction of the screen height' }),
  p('alignment', 'alignment', 'look'),
  p('forceUppercase', 'bool', 'look'),
  p('lineSpacing', 'float', 'look'),
];

const TEXTLIKE = [
  ...LAYOUT,
  p('text', 'text', 'content'),
  p('color', 'color', 'look'),
  p('backgroundColor', 'color', 'look'),
  ...FONT,
  p('verticalAlignment', 'valign', 'look'),
  p('glowColor', 'color', 'look'),
  p('glowSize', 'float', 'look'),
  p('glowOffset', 'pair', 'look'),
  p('padding', 'string', 'layout'),
  p('singleLineScroll', 'bool', 'behavior'),
];

const MENU_TEXT = [p('fontPath', 'font', 'look'), p('fontSize', 'float', 'look'), p('color', 'color', 'look'), p('selectedColor', 'color', 'look'), p('selectorColor', 'color', 'look'), p('separatorColor', 'color', 'look')];

export const SCHEMA: Record<string, PropSpec[]> = {
  image: [
    ...LAYOUT,
    p('maxSize', 'pair', 'layout', { hint: 'Fit inside this box, keeping the aspect ratio' }),
    p('minSize', 'pair', 'layout', { hint: 'Cover this box, keeping the aspect ratio' }),
    p('path', 'path', 'content'),
    p('default', 'path', 'content', { hint: 'Shown when the path is missing' }),
    p('color', 'color', 'look', { hint: 'Tint, multiplied with the image' }),
    p('colorEnd', 'color', 'look'),
    p('gradientType', 'enum', 'look', { options: ['horizontal', 'vertical'] }),
    p('tile', 'bool', 'look'),
    p('flipX', 'bool', 'look'),
    p('flipY', 'bool', 'look'),
    p('saturation', 'float', 'look'),
    p('roundCorners', 'float', 'look'),
    p('linearSmooth', 'bool', 'look'),
    p('horizontalAlignment', 'alignment', 'layout'),
    p('verticalAlignment', 'valign', 'layout'),
    p('padding', 'string', 'layout'),
  ],
  text: TEXTLIKE,
  clock: [...TEXTLIKE, p('format', 'string', 'content')],
  datetime: [...TEXTLIKE, p('format', 'string', 'content', { hint: 'e.g. %m/%d/%Y' }), p('displayRelative', 'bool', 'content')],
  textlist: [
    ...LAYOUT,
    p('primaryColor', 'color', 'look', { hint: 'Games' }),
    p('secondaryColor', 'color', 'look', { hint: 'Folders' }),
    p('selectedColor', 'color', 'look', { hint: 'Text of the selected row' }),
    p('selectorColor', 'color', 'look', { hint: 'Selection bar' }),
    p('selectorColorEnd', 'color', 'look'),
    p('selectorHeight', 'float', 'look'),
    p('selectorOffsetY', 'float', 'look'),
    p('selectorImagePath', 'path', 'look'),
    ...FONT,
    p('horizontalMargin', 'float', 'layout'),
    p('scrollSound', 'sound', 'behavior'),
  ],
  rating: [...LAYOUT, p('filledPath', 'path', 'content'), p('unfilledPath', 'path', 'content'), p('color', 'color', 'look'), p('unfilledColor', 'color', 'look')],
  video: [
    ...LAYOUT,
    p('maxSize', 'pair', 'layout'),
    p('minSize', 'pair', 'layout'),
    p('path', 'video', 'content'),
    p('default', 'path', 'content'),
    p('delay', 'float', 'behavior', { hint: 'Seconds before the video starts' }),
    p('showSnapshotNoVideo', 'bool', 'behavior'),
    p('showSnapshotDelay', 'bool', 'behavior'),
    p('roundCorners', 'float', 'look'),
  ],
  ninepatch: [...LAYOUT, p('path', 'path', 'content'), p('color', 'color', 'look'), p('centerColor', 'color', 'look'), p('edgeColor', 'color', 'look'), p('cornerSize', 'pair', 'look', { hint: 'Corner size in pixels' }), p('padding', 'string', 'layout')],
  carousel: [
    p('type', 'enum', 'layout', { options: ['horizontal', 'vertical', 'horizontal_wheel', 'vertical_wheel'] }),
    ...LAYOUT,
    p('color', 'color', 'look', { hint: 'Background of the carousel band' }),
    p('colorEnd', 'color', 'look'),
    p('gradientType', 'enum', 'look', { options: ['horizontal', 'vertical'] }),
    p('logoSize', 'pair', 'layout'),
    p('logoScale', 'float', 'look', { hint: 'Zoom of the selected logo' }),
    p('logoAlignment', 'alignment', 'layout'),
    p('logoRotation', 'float', 'look'),
    p('logoRotationOrigin', 'pair', 'look'),
    p('maxLogoCount', 'float', 'layout'),
    p('minLogoOpacity', 'float', 'look'),
    p('scrollSound', 'sound', 'behavior'),
    p('defaultTransition', 'enum', 'behavior', { options: ['instant', 'fade', 'slide'] }),
  ],
  imagegrid: [
    ...LAYOUT,
    p('margin', 'pair', 'layout'),
    p('padding', 'string', 'layout'),
    p('autoLayout', 'pair', 'layout', { hint: 'Columns and rows' }),
    p('autoLayoutSelectedZoom', 'float', 'look'),
    p('imageSource', 'enum', 'content', { options: ['image', 'thumbnail', 'marquee', 'fanart', 'titleshot', 'boxart', 'cartridge', 'wheel', 'mix'] }),
    p('scrollDirection', 'enum', 'behavior', { options: ['vertical', 'horizontal'] }),
    p('centerSelection', 'bool', 'behavior'),
    p('scrollLoop', 'bool', 'behavior'),
    p('gameImage', 'path', 'content'),
    p('folderImage', 'path', 'content'),
    p('scrollSound', 'sound', 'behavior'),
  ],
  gridtile: [
    p('size', 'pair', 'layout'),
    p('padding', 'string', 'layout'),
    p('imageColor', 'color', 'look'),
    p('backgroundImage', 'path', 'look'),
    p('backgroundCornerSize', 'pair', 'look'),
    p('backgroundColor', 'color', 'look'),
    p('backgroundCenterColor', 'color', 'look'),
    p('backgroundEdgeColor', 'color', 'look'),
    p('selectionMode', 'enum', 'behavior', { options: ['full', 'image'] }),
  ],
  helpsystem: [
    p('pos', 'pair', 'layout'),
    p('origin', 'pair', 'layout'),
    p('textColor', 'color', 'look'),
    p('iconColor', 'color', 'look'),
    p('fontPath', 'font', 'look'),
    p('fontSize', 'float', 'look'),
    p('textColorFocused', 'color', 'look'),
    p('iconColorFocused', 'color', 'look'),
  ],
  sound: [p('path', 'sound', 'content')],
  container: [...LAYOUT, p('clipChildren', 'bool', 'behavior')],
  stackpanel: [...LAYOUT, p('orientation', 'enum', 'layout', { options: ['horizontal', 'vertical'] }), p('separator', 'float', 'layout'), p('reverse', 'bool', 'layout')],
  menuBackground: [p('color', 'color', 'look'), p('path', 'path', 'look'), p('fadePath', 'path', 'look'), p('cornerSize', 'pair', 'look')],
  menuText: MENU_TEXT,
  menuTextSmall: MENU_TEXT,
  menuGroup: [...MENU_TEXT, p('backgroundColor', 'color', 'look'), p('alignment', 'alignment', 'look')],
  menuButton: [p('path', 'path', 'look'), p('filledPath', 'path', 'look')],
  menuSwitch: [p('pathOn', 'path', 'look'), p('pathOff', 'path', 'look')],
  menuSlider: [p('path', 'path', 'look')],
  splash: [...LAYOUT, p('path', 'path', 'content'), p('color', 'color', 'look')],
};

export const ADDABLE_TYPES = ['image', 'text', 'textlist', 'rating', 'datetime', 'video', 'ninepatch', 'carousel', 'imagegrid', 'helpsystem', 'clock', 'container'];

export const STARTER_PROPS: Record<string, string> = {
  image: '<pos>0.4 0.4</pos>\n<size>0.2 0.2</size>\n<path></path>\n<color>FFFFFFFF</color>\n<zIndex>15</zIndex>',
  text: '<pos>0.4 0.45</pos>\n<size>0.2 0.05</size>\n<text>New text</text>\n<fontSize>0.035</fontSize>\n<color>FFFFFFFF</color>\n<alignment>center</alignment>\n<zIndex>15</zIndex>',
  ninepatch: '<pos>0.35 0.35</pos>\n<size>0.3 0.3</size>\n<path></path>\n<cornerSize>24 24</cornerSize>\n<zIndex>12</zIndex>',
  clock: '<pos>0.85 0.03</pos>\n<size>0.12 0.05</size>\n<fontSize>0.035</fontSize>\n<color>FFFFFFFF</color>\n<format>%H:%M</format>',
  container: '<pos>0.3 0.3</pos>\n<size>0.4 0.4</size>',
};

export function specFor(type: string, prop: string): PropSpec {
  return SCHEMA[type]?.find((s) => s.name === prop) ?? inferSpec(prop);
}

export function inferSpec(prop: string, value = ''): PropSpec {
  const v = value.trim();
  if (/color/i.test(prop)) return p(prop, 'color', 'look');
  if (/^(pos|size|origin|maxSize|minSize)$/i.test(prop) || /Size$|Origin$|Offset$/.test(prop)) return p(prop, 'pair', 'layout');
  if (/font/i.test(prop)) return p(prop, 'font', 'look');
  if (/path$|image$/i.test(prop)) return p(prop, 'path', 'content');
  if (/^(true|false)$/i.test(v)) return p(prop, 'bool', 'behavior');
  if (/^-?\d+(\.\d+)?$/.test(v)) return p(prop, 'float', 'look');
  return p(prop, 'string', 'content');
}

export const COLOR_RE = /^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

/** RRGGBB[AA] to a CSS colour. */
export function cssColor(v: string | undefined, fallback = 'transparent'): string {
  const t = (v ?? '').trim();
  if (!COLOR_RE.test(t)) return fallback;
  const r = parseInt(t.slice(0, 2), 16);
  const g = parseInt(t.slice(2, 4), 16);
  const b = parseInt(t.slice(4, 6), 16);
  const a = t.length === 8 ? parseInt(t.slice(6, 8), 16) / 255 : 1;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

export function parsePair(v: string | undefined): [number, number] | null {
  if (!v) return null;
  const parts = v.trim().split(/[\s,]+/).map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0], parts[1]];
}

export function fmtNum(n: number): string {
  return String(Math.round(n * 10000) / 10000);
}

/** Elements ES draws by default even if a theme only adjusts them; used for labels. */
export const ELEMENT_LABELS: Record<string, string> = {
  background: 'Background',
  logo: 'Logo',
  logoText: 'Logo text',
  gamelist: 'Game list',
  systemcarousel: 'System carousel',
  systemInfo: 'System info',
  help: 'Help prompts',
  md_image: 'Game image',
  md_video: 'Game video',
  md_marquee: 'Game marquee',
  md_thumbnail: 'Game thumbnail',
  md_description: 'Description',
  md_rating: 'Rating',
  md_releasedate: 'Release date',
  md_developer: 'Developer',
  md_publisher: 'Publisher',
  md_genre: 'Genre',
  md_players: 'Players',
  md_lastplayed: 'Last played',
  md_playcount: 'Play count',
  md_name: 'Game name',
  // RetroBat's loading screens (splash.xml, gamesplash.xml).
  splash: 'Screen colour',
  label: 'Loading text',
  progressbar: 'Progress bar',
  'progressbar:active': 'Progress bar fill',
};

export const VIEW_ORDER = ['system', 'basic', 'detailed', 'video', 'grid', 'gamecarousel', 'menu', 'screen', 'splash'];
