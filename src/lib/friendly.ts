// Plain-English names and help for the theme vocabulary, so the editor makes sense without
// knowing EmulationStation's XML. The real names stay visible in Advanced mode.

import { ELEMENT_LABELS } from './theme/schema';

interface Info {
  label: string;
  help?: string;
}

const PROPS: Record<string, Info> = {
  pos: { label: 'Position', help: 'Where it sits on the screen, measured from the top-left corner.' },
  size: { label: 'Size', help: 'How big it is compared to the screen. 0 means “keep the picture’s proportions”.' },
  maxSize: { label: 'Fit inside', help: 'The picture is shrunk or grown to fit inside this box without stretching.' },
  minSize: { label: 'Fill at least', help: 'The picture is grown to cover this box without stretching.' },
  origin: { label: 'Anchor point', help: 'Which point of the element the position refers to. 0 0 is its top-left corner, 0.5 0.5 its centre.' },
  rotation: { label: 'Rotation', help: 'Turn it by this many degrees.' },
  rotationOrigin: { label: 'Rotate around', help: 'The point it turns around, inside the element.' },
  zIndex: { label: 'Layer', help: 'Higher numbers are drawn on top of lower ones.' },
  visible: { label: 'Visible', help: 'Untick to hide it on this screen.' },
  opacity: { label: 'Opacity', help: '1 is solid, 0 is invisible.' },
  path: { label: 'Picture file' },
  default: { label: 'Fallback picture', help: 'Shown when the game or system has no picture of its own.' },
  color: { label: 'Colour', help: 'For pictures this tints the image; white leaves it unchanged.' },
  colorEnd: { label: 'Gradient end colour' },
  gradientType: { label: 'Gradient direction' },
  tile: { label: 'Repeat as pattern' },
  flipX: { label: 'Mirror left-right' },
  flipY: { label: 'Mirror top-bottom' },
  saturation: { label: 'Colour strength', help: '0 is black and white, 1 is normal.' },
  roundCorners: { label: 'Rounded corners' },
  text: { label: 'Text' },
  fontPath: { label: 'Font' },
  fontSize: { label: 'Text size', help: 'Height of the letters compared to the screen height.' },
  alignment: { label: 'Text alignment' },
  verticalAlignment: { label: 'Vertical alignment' },
  horizontalAlignment: { label: 'Horizontal alignment' },
  forceUppercase: { label: 'ALL CAPS' },
  lineSpacing: { label: 'Line spacing' },
  backgroundColor: { label: 'Background colour' },
  glowColor: { label: 'Glow colour' },
  glowSize: { label: 'Glow size' },
  primaryColor: { label: 'Game name colour' },
  secondaryColor: { label: 'Folder name colour' },
  selectedColor: { label: 'Selected game text colour' },
  selectorColor: { label: 'Highlight bar colour' },
  selectorColorEnd: { label: 'Highlight bar end colour' },
  selectorHeight: { label: 'Highlight bar height' },
  selectorImagePath: { label: 'Highlight bar picture' },
  horizontalMargin: { label: 'Side margin' },
  scrollSound: { label: 'Scroll sound' },
  filledPath: { label: 'Full star picture' },
  unfilledPath: { label: 'Empty star picture' },
  unfilledColor: { label: 'Empty star colour' },
  textColor: { label: 'Text colour' },
  iconColor: { label: 'Button icon colour' },
  format: { label: 'Date format', help: 'For example %d/%m/%Y.' },
  displayRelative: { label: 'Show as “2 days ago”' },
  delay: { label: 'Wait before playing', help: 'Seconds before the video starts.' },
  showSnapshotNoVideo: { label: 'Show picture when there is no video' },
  cornerSize: { label: 'Corner size', help: 'How much of each corner of the picture stays unstretched, in pixels.' },
  logoSize: { label: 'Logo size' },
  logoScale: { label: 'Selected logo zoom' },
  maxLogoCount: { label: 'Logos shown' },
  type: { label: 'Direction' },
  autoLayout: { label: 'Columns and rows' },
  margin: { label: 'Gap between tiles' },
  padding: { label: 'Inner spacing' },
  imageSource: { label: 'Picture shown' },
};

const VIEWS: Record<string, Info> = {
  system: { label: 'System menu', help: 'The first screen, where you pick a console.' },
  basic: { label: 'Game list (simple)', help: 'The list of games, used when games have no pictures.' },
  detailed: { label: 'Game list (detailed)', help: 'The list of games with a picture and description.' },
  video: { label: 'Game list (video)', help: 'The detailed game list with a video preview.' },
  grid: { label: 'Game grid', help: 'Games shown as a grid of covers.' },
  gamecarousel: { label: 'Game carousel', help: 'Games shown as a sliding row of covers.' },
  menu: { label: 'Settings menu', help: 'The look of RetroBat’s own menus.' },
  screen: { label: 'Screen overlay', help: 'Things drawn on top of every screen.' },
  splash: { label: 'Loading screen', help: 'Shown while RetroBat starts.' },
};

export const TYPE_LABELS: Record<string, Info> = {
  image: { label: 'Picture', help: 'A logo, background or any image file.' },
  text: { label: 'Text', help: 'A label or a piece of game information.' },
  textlist: { label: 'Game list', help: 'The scrolling list of game names.' },
  rating: { label: 'Star rating', help: 'Shows the game’s rating as stars.' },
  datetime: { label: 'Date', help: 'A release date or last played date.' },
  clock: { label: 'Clock', help: 'The current time.' },
  video: { label: 'Video', help: 'Plays the game’s video preview.' },
  ninepatch: { label: 'Panel', help: 'A box that stretches without blurring its corners.' },
  carousel: { label: 'System carousel', help: 'The sliding row of console logos.' },
  imagegrid: { label: 'Grid', help: 'A grid of tiles, for systems or games.' },
  helpsystem: { label: 'Button hints', help: 'The “A Launch, B Back” hints.' },
  container: { label: 'Group', help: 'Holds other elements together.' },
  stackpanel: { label: 'Row of elements' },
  sound: { label: 'Sound' },
  gridtile: { label: 'Grid tile style' },
};

/** Settings shown in Simple mode; everything else is one click away. */
export const SIMPLE_PROPS = new Set([
  'pos',
  'size',
  'maxSize',
  'zIndex',
  'visible',
  'opacity',
  'path',
  'color',
  'text',
  'fontPath',
  'fontSize',
  'alignment',
  'forceUppercase',
  'backgroundColor',
  'primaryColor',
  'secondaryColor',
  'selectedColor',
  'selectorColor',
  'textColor',
  'iconColor',
  'filledPath',
  'unfilledPath',
  'logoSize',
  'maxLogoCount',
]);

/** "fontPath" → "Font path", "system-console-name" → "System console name". */
/** Names of the parts ChannelCraft designs add. */
const DESIGN_NAMES: Record<string, string> = {
  ccs_background: 'Background',
  ccs_fanart: 'Fan art',
  ccs_fade: 'Fade',
  ccs_boxart: 'Box art',
  ccs_reflection: 'Box art reflection',
  ccs_title: 'Game name',
  ccs_favorite: 'Favourite badge',
  ccs_clock: 'Clock',
  ccs_console: 'Console picture',
  ccs_systemart: 'Random game art',
  ccs_systemname: 'System name',
  ccs_systemmaker: 'Maker and year',
  ccs_systemcount: 'Game count',
  ccs_listpanel: 'Game list panel',
  ccs_infopanel: 'Info panel',
  ccs_artpanel: 'Artwork panel',
  ccs_band: 'Carousel band',
  ccs_wheelpanel: 'Wheel panel',
  ccs_column: 'Logo column',
  ccs_scanlines: 'Scanlines',
  ccs_bezel: 'Screen bezel',
};

export function humanize(name: string): string {
  if (DESIGN_NAMES[name]) return DESIGN_NAMES[name];
  const s = name
    .replace(/^ccs_/, '')
    .replace(/^md_lbl_/, 'label ')
    .replace(/^md_/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_.:]+/g, ' ')
    .trim()
    .toLowerCase();
  return s ? s[0].toUpperCase() + s.slice(1) : name;
}

export function propLabel(name: string): string {
  return PROPS[name]?.label ?? humanize(name);
}

export function propHelp(name: string): string | undefined {
  return PROPS[name]?.help;
}

export function viewLabel(name: string, displayName?: string | null): string {
  return VIEWS[name]?.label ?? displayName ?? humanize(name);
}

export function viewHelp(name: string): string | undefined {
  return VIEWS[name]?.help;
}

export function elementLabel(name: string): string {
  return ELEMENT_LABELS[name] ?? humanize(name);
}

export function typeLabel(type: string): string {
  return TYPE_LABELS[type]?.label ?? humanize(type);
}
