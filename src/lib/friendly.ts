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
  path: { label: 'Picture file', help: 'The picture or video file it shows.' },
  default: { label: 'Fallback picture', help: 'Shown when the game or system has no picture of its own.' },
  color: { label: 'Colour', help: 'For pictures this tints the image; white leaves it unchanged.' },
  colorEnd: { label: 'Gradient end colour', help: 'With a different end colour, the colour fades into this one across the element.' },
  gradientType: { label: 'Gradient direction', help: 'Which way the colour fades: across (horizontal) or down (vertical).' },
  tile: { label: 'Repeat as pattern', help: 'Repeats the picture to fill the element, like wallpaper, instead of stretching it.' },
  flipX: { label: 'Mirror left-right', help: 'Shows the picture mirrored, as if seen in a mirror.' },
  flipY: { label: 'Mirror top-bottom', help: 'Shows the picture upside down.' },
  saturation: { label: 'Colour strength', help: '0 is black and white, 1 is normal.' },
  roundCorners: { label: 'Rounded corners', help: 'How rounded the corners are. 0 is square; 0.5 makes it a circle or pill.' },
  text: { label: 'Text', help: 'The words it shows. It can also show game or console information that RetroBat fills in.' },
  fontPath: { label: 'Font', help: 'The font file the text uses. Without one, RetroBat’s standard font is used.' },
  fontSize: { label: 'Text size', help: 'Height of the letters compared to the screen height.' },
  alignment: { label: 'Text alignment', help: 'Whether the text lines up on the left, in the centre or on the right of its box.' },
  verticalAlignment: { label: 'Vertical alignment', help: 'Whether the text sits at the top, middle or bottom of its box.' },
  horizontalAlignment: { label: 'Horizontal alignment', help: 'Whether it lines up on the left, in the centre or on the right.' },
  forceUppercase: { label: 'ALL CAPS', help: 'Shows every letter as a capital, whatever the text is.' },
  lineSpacing: { label: 'Line spacing', help: 'Space between lines of text. 1.5 is normal; bigger spreads the lines out.' },
  backgroundColor: { label: 'Background colour', help: 'A colour filled in behind the text. Leave it clear for none.' },
  glowColor: { label: 'Glow colour', help: 'The colour of the soft light around the text.' },
  glowSize: { label: 'Glow size', help: 'How far the glow spreads around the text. 0 is no glow.' },
  primaryColor: { label: 'Game name colour', help: 'The colour of game names in the list.' },
  secondaryColor: { label: 'Folder name colour', help: 'The colour of folder names in the list.' },
  selectedColor: { label: 'Selected game text colour', help: 'The colour of the game name you are on.' },
  selectorColor: { label: 'Highlight bar colour', help: 'The colour of the bar behind the game you are on.' },
  selectorColorEnd: { label: 'Highlight bar end colour', help: 'With a different end colour, the bar fades into this one.' },
  selectorHeight: { label: 'Highlight bar height', help: 'How tall the bar behind the selected game is.' },
  selectorImagePath: { label: 'Highlight bar picture', help: 'A picture used as the bar behind the selected game, instead of a colour.' },
  horizontalMargin: { label: 'Side margin', help: 'Empty space on the left and right inside the list.' },
  scrollSound: { label: 'Scroll sound', help: 'The sound played when moving through the list.' },
  filledPath: { label: 'Full star picture', help: 'The picture used for a full star.' },
  unfilledPath: { label: 'Empty star picture', help: 'The picture used for an empty star.' },
  unfilledColor: { label: 'Empty star colour', help: 'The colour of empty stars.' },
  textColor: { label: 'Text colour', help: 'The colour of the words.' },
  iconColor: { label: 'Button icon colour', help: 'The colour of the button pictures, like the A and B buttons.' },
  format: { label: 'Date format', help: 'For example %d/%m/%Y.' },
  displayRelative: { label: 'Show as “2 days ago”', help: 'Shows dates like “2 days ago” instead of the full date.' },
  delay: { label: 'Wait before playing', help: 'Seconds before the video starts.' },
  showSnapshotNoVideo: { label: 'Show picture when there is no video', help: 'When a game has no video, its screenshot is shown instead.' },
  cornerSize: { label: 'Corner size', help: 'How much of each corner of the picture stays unstretched, in pixels.' },
  logoSize: { label: 'Logo size', help: 'How big each console logo is in the carousel.' },
  logoScale: { label: 'Selected logo zoom', help: 'How much bigger the selected logo gets. 1 is no zoom.' },
  maxLogoCount: { label: 'Logos shown', help: 'How many console logos fit on the screen at once.' },
  type: { label: 'Direction', help: 'Which way it scrolls: across or down.' },
  autoLayout: { label: 'Columns and rows', help: 'How many columns and rows of tiles there are.' },
  margin: { label: 'Gap between tiles', help: 'Empty space between the tiles.' },
  padding: { label: 'Inner spacing', help: 'Empty space inside each tile, around its picture.' },
  imageSource: { label: 'Picture shown', help: 'Which of the game’s pictures it shows, such as box art or a screenshot.' },
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
  staticBackground: 'Background',
  staticBackgroundMoving: 'Moving background',
  ccs_movingbg: 'Moving background',
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
