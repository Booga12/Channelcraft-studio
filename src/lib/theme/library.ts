// Ready-made elements that RetroBat fills with its own data. Native elements (md_image,
// md_rating, gamelist, ...) are filled by EmulationStation itself; extra elements use the data
// bindings RetroBat themes use ({game:name}, firstfile({game:boxart}, ...), {system:total}, ...).

export type ScreenKind = 'game' | 'system' | 'any';

export interface LibraryItem {
  id: string;
  label: string;
  help: string;
  icon: string;
  category: 'Game artwork' | 'Game details' | 'Game list' | 'System' | 'Screen';
  screens: ScreenKind;
  type: string;
  /** Element name. Native names are filled by RetroBat; others get extra="true". */
  name: string;
  native: boolean;
  /** Child properties, two-space indented, one per line. */
  body: string;
  /** Only in these views (e.g. md_video only exists in the video view). */
  onlyViews?: string[];
}

const ART = (path: string, pos = '0.25 0.42', max = '0.4 0.45', z = 30) => `<pos>${pos}</pos>\n<origin>0.5 0.5</origin>\n<maxSize>${max}</maxSize>\n<path>${path}</path>\n<zIndex>${z}</zIndex>`;
const TEXT = (pos: string, size: string, fs = '0.03', extra = '') => `<pos>${pos}</pos>\n<size>${size}</size>\n<fontSize>${fs}</fontSize>\n<color>FFFFFFFF</color>${extra ? '\n' + extra : ''}\n<zIndex>40</zIndex>`;

export const LIBRARY: LibraryItem[] = [
  // ---- game artwork ----
  {
    id: 'boxart',
    label: 'Box art',
    help: 'The game’s box cover, or its screenshot if there’s no box.',
    icon: 'image',
    category: 'Game artwork',
    screens: 'game',
    type: 'image',
    name: 'boxart',
    native: false,
    body: ART('firstfile({game:boxart}, {game:thumbnail}, {game:image})'),
  },
  {
    id: 'md_image',
    label: 'Game picture',
    help: 'The main picture RetroBat scraped for the game (usually a screenshot).',
    icon: 'image',
    category: 'Game artwork',
    screens: 'game',
    type: 'image',
    name: 'md_image',
    native: true,
    body: '<pos>0.25 0.42</pos>\n<origin>0.5 0.5</origin>\n<maxSize>0.42 0.42</maxSize>',
  },
  {
    id: 'md_marquee',
    label: 'Game logo',
    help: 'The game’s logo or marquee.',
    icon: 'image',
    category: 'Game artwork',
    screens: 'game',
    type: 'image',
    name: 'md_marquee',
    native: true,
    body: '<pos>0.25 0.1</pos>\n<origin>0.5 0.5</origin>\n<maxSize>0.36 0.13</maxSize>',
  },
  {
    id: 'wheel',
    label: 'Game wheel art',
    help: 'The round “wheel” logo, falling back to the marquee.',
    icon: 'image',
    category: 'Game artwork',
    screens: 'game',
    type: 'image',
    name: 'wheelart',
    native: false,
    body: ART('firstfile({game:wheel}, {game:marquee})', '0.25 0.1', '0.36 0.13', 35),
  },
  {
    id: 'fanart',
    label: 'Fan art background',
    help: 'A big faded artwork behind everything, changing with the game.',
    icon: 'image',
    category: 'Game artwork',
    screens: 'game',
    type: 'image',
    name: 'fanart',
    native: false,
    body: '<pos>0 0</pos>\n<size>1 1</size>\n<path>firstfile({game:fanart}, {game:image})</path>\n<color>FFFFFF40</color>\n<zIndex>1</zIndex>',
  },
  {
    id: 'md_video',
    label: 'Game video',
    help: 'The game’s video preview. Shows the picture until the video starts.',
    icon: 'video',
    category: 'Game artwork',
    screens: 'game',
    type: 'video',
    name: 'md_video',
    native: true,
    onlyViews: ['video'],
    body: '<pos>0.25 0.42</pos>\n<origin>0.5 0.5</origin>\n<maxSize>0.42 0.42</maxSize>\n<delay>1</delay>\n<showSnapshotNoVideo>true</showSnapshotNoVideo>',
  },
  {
    id: 'gamevideo',
    label: 'Game video',
    help: 'The game’s video preview on this screen.',
    icon: 'video',
    category: 'Game artwork',
    screens: 'game',
    type: 'video',
    name: 'gamevideo',
    native: false,
    body: '<pos>0.25 0.42</pos>\n<origin>0.5 0.5</origin>\n<maxSize>0.42 0.42</maxSize>\n<path>{game:video}</path>\n<delay>1</delay>\n<zIndex>30</zIndex>',
  },

  // ---- game details ----
  {
    id: 'gametitle',
    label: 'Game name',
    help: 'The selected game’s name.',
    icon: 'text',
    category: 'Game details',
    screens: 'game',
    type: 'text',
    name: 'gametitle',
    native: false,
    body: TEXT('0.04 0.62', '0.44 0.05', '0.04', '<text>{game:name}</text>'),
  },
  {
    id: 'md_description',
    label: 'Description',
    help: 'The game’s story or summary.',
    icon: 'text',
    category: 'Game details',
    screens: 'game',
    type: 'text',
    name: 'md_description',
    native: true,
    body: '<pos>0.04 0.72</pos>\n<size>0.44 0.2</size>\n<fontSize>0.022</fontSize>\n<lineSpacing>1.4</lineSpacing>',
  },
  {
    id: 'md_rating',
    label: 'Star rating',
    help: 'The game’s rating as five stars.',
    icon: 'star',
    category: 'Game details',
    screens: 'game',
    type: 'rating',
    name: 'md_rating',
    native: true,
    body: '<pos>0.04 0.67</pos>\n<size>0 0.035</size>',
  },
  {
    id: 'md_releasedate',
    label: 'Release date',
    help: 'When the game came out.',
    icon: 'clock',
    category: 'Game details',
    screens: 'game',
    type: 'datetime',
    name: 'md_releasedate',
    native: true,
    body: '<pos>0.2 0.67</pos>\n<fontSize>0.026</fontSize>',
  },
  ...(
    [
      ['md_developer', 'Developer', 'Who made the game.'],
      ['md_publisher', 'Publisher', 'Who released the game.'],
      ['md_genre', 'Genre', 'The kind of game, e.g. Platform or Racing.'],
      ['md_players', 'Players', 'How many people can play.'],
      ['md_playcount', 'Times played', 'How often the game was started.'],
    ] as const
  ).map(
    ([name, label, help], i): LibraryItem => ({
      id: name,
      label,
      help,
      icon: 'text',
      category: 'Game details',
      screens: 'game',
      type: 'text',
      name,
      native: true,
      body: `<pos>0.3 ${(0.62 + i * 0.03).toFixed(2)}</pos>\n<size>0.18 0.03</size>\n<fontSize>0.024</fontSize>\n<visible>true</visible>`,
    }),
  ),
  {
    id: 'md_lastplayed',
    label: 'Last played',
    help: 'When the game was last played, like “2 days ago”.',
    icon: 'clock',
    category: 'Game details',
    screens: 'game',
    type: 'datetime',
    name: 'md_lastplayed',
    native: true,
    body: '<pos>0.3 0.77</pos>\n<fontSize>0.024</fontSize>\n<displayRelative>true</displayRelative>\n<visible>true</visible>',
  },
  {
    id: 'favorite',
    label: 'Favourite badge',
    help: 'A star that only shows when the game is a favourite.',
    icon: 'star',
    category: 'Game details',
    screens: 'game',
    type: 'text',
    name: 'favoritebadge',
    native: false,
    body: TEXT('0.04 0.57', '0.2 0.04', '0.028', '<text>★ Favourite</text>\n<color>FFD34DFF</color>\n<visible>{game:favorite}</visible>').replace('<color>FFFFFFFF</color>\n', ''),
  },

  // ---- game list ----
  {
    id: 'gamelist',
    label: 'Game list',
    help: 'The scrolling list of games. RetroBat fills it with the system’s games.',
    icon: 'list',
    category: 'Game list',
    screens: 'game',
    type: 'textlist',
    name: 'gamelist',
    native: true,
    body: '<pos>0.53 0.14</pos>\n<size>0.43 0.76</size>\n<fontSize>0.032</fontSize>\n<primaryColor>FFFFFFFF</primaryColor>\n<selectedColor>FFFFFFFF</selectedColor>\n<selectorColor>2680EBFF</selectorColor>',
  },
  {
    id: 'logo',
    label: 'System logo (header)',
    help: 'The logo of the system you’re browsing, at the top of the game list.',
    icon: 'image',
    category: 'Game list',
    screens: 'game',
    type: 'image',
    name: 'logo',
    native: true,
    body: '<pos>0.04 0.04</pos>\n<maxSize>0.3 0.09</maxSize>',
  },

  // ---- system screen ----
  {
    id: 'systemcarousel',
    label: 'System carousel',
    help: 'The sliding row of console logos.',
    icon: 'carousel',
    category: 'System',
    screens: 'system',
    type: 'carousel',
    name: 'systemcarousel',
    native: true,
    body: '<type>horizontal</type>\n<pos>0 0.38</pos>\n<size>1 0.24</size>\n<logoSize>0.24 0.16</logoSize>\n<maxLogoCount>3</maxLogoCount>',
  },
  {
    id: 'systemname',
    label: 'System name',
    help: 'The full name of the selected console.',
    icon: 'text',
    category: 'System',
    screens: 'system',
    type: 'text',
    name: 'systemname',
    native: false,
    body: TEXT('0 0.66', '1 0.06', '0.045', '<text>{system:fullName}</text>\n<alignment>center</alignment>'),
  },
  {
    id: 'systemmaker',
    label: 'Maker and year',
    help: 'Who made the console and when, like “Nintendo · 1990”.',
    icon: 'text',
    category: 'System',
    screens: 'system',
    type: 'text',
    name: 'systemmaker',
    native: false,
    body: TEXT('0 0.72', '1 0.04', '0.028', '<text>{system:manufacturer} + "  ·  " + {system:releaseYear}</text>\n<alignment>center</alignment>'),
  },
  {
    id: 'systemcount',
    label: 'Game count',
    help: 'How many games the console has.',
    icon: 'text',
    category: 'System',
    screens: 'system',
    type: 'text',
    name: 'systemcount',
    native: false,
    body: TEXT('0 0.77', '1 0.04', '0.026', '<text>{system:total} + " games"</text>\n<alignment>center</alignment>'),
  },
  {
    id: 'systemInfo',
    label: 'System info line',
    help: 'RetroBat’s own line of system info (game count and more).',
    icon: 'text',
    category: 'System',
    screens: 'system',
    type: 'text',
    name: 'systemInfo',
    native: true,
    body: '<pos>0 0.64</pos>\n<size>1 0.05</size>\n<alignment>center</alignment>',
  },
  {
    id: 'systemrandom',
    label: 'Random game art',
    help: 'Art from a random game of the selected console.',
    icon: 'image',
    category: 'System',
    screens: 'system',
    type: 'image',
    name: 'systemrandomart',
    native: false,
    body: ART('firstfile({system:random:image}, {system:random:thumbnail})', '0.5 0.2', '0.5 0.3', 15),
  },

  // ---- any screen ----
  {
    id: 'clock',
    label: 'Clock',
    help: 'The current time.',
    icon: 'clock',
    category: 'Screen',
    screens: 'any',
    type: 'clock',
    name: 'clock',
    native: false,
    body: '<pos>0.96 0.04</pos>\n<origin>1 0</origin>\n<fontSize>0.035</fontSize>\n<color>FFFFFFFF</color>\n<format>%H:%M</format>\n<zIndex>50</zIndex>',
  },
  {
    id: 'help',
    label: 'Button hints',
    help: 'The “A Launch, B Back” hints at the bottom.',
    icon: 'hint',
    category: 'Screen',
    screens: 'any',
    type: 'helpsystem',
    name: 'help',
    native: true,
    body: '<pos>0.015 0.955</pos>\n<textColor>DDDDDDFF</textColor>\n<iconColor>DDDDDDFF</iconColor>',
  },
  {
    id: 'background',
    label: 'Background picture',
    help: 'A full-screen picture behind everything. Pick the file after adding it.',
    icon: 'image',
    category: 'Screen',
    screens: 'any',
    type: 'image',
    name: 'background',
    native: false,
    body: '<pos>0 0</pos>\n<size>1 1</size>\n<path></path>\n<zIndex>0</zIndex>',
  },
];

/** Data bindings that stand in for RetroBat's own elements when they're copied as regular elements. */
export const NATIVE_BINDINGS: Record<string, { prop: string; value: string }> = {
  md_image: { prop: 'path', value: 'firstfile({game:image}, {game:thumbnail})' },
  md_thumbnail: { prop: 'path', value: 'firstfile({game:thumbnail}, {game:image})' },
  md_marquee: { prop: 'path', value: 'firstfile({game:marquee}, {game:wheel})' },
  md_fanart: { prop: 'path', value: '{game:fanart}' },
  md_video: { prop: 'path', value: '{game:video}' },
  md_description: { prop: 'text', value: '{game:desc}' },
  md_name: { prop: 'text', value: '{game:name}' },
  md_developer: { prop: 'text', value: '{game:developer}' },
  md_publisher: { prop: 'text', value: '{game:publisher}' },
  md_genre: { prop: 'text', value: '{game:genre}' },
  md_players: { prop: 'text', value: '{game:players}' },
  logoText: { prop: 'text', value: '{system:fullName}' },
};

export function isGameScreen(view: string): boolean {
  return !['system', 'menu', 'screen', 'splash'].includes(view);
}

/** Library items that make sense on this screen. */
export function itemsFor(view: string): LibraryItem[] {
  const game = isGameScreen(view);
  const items = LIBRARY.filter((i) => {
    if (i.onlyViews && !i.onlyViews.includes(view)) return false;
    if (i.screens === 'any') return view !== 'menu';
    return i.screens === (game ? 'game' : 'system') && view !== 'menu' && view !== 'splash';
  });
  // In the video view the native md_video replaces the generic video element.
  return view === 'video' ? items.filter((i) => i.id !== 'gamevideo') : items;
}

/** True when a value reads RetroBat data (shown as a labelled placeholder in the preview). */
export function isDataBound(value: string | undefined): boolean {
  return !!value && /\{(game|system)[:.]/.test(value);
}
