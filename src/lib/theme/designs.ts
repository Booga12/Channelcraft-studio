// Complete looks for a theme: artwork (generated SVG), colours, a font, animations, and a layout
// for the system screen and every game list screen. Every game screen gets all of RetroBat's
// game data (fan art, box art, screenshot or video, logo, name, description, rating, year,
// genre, developer, players, favourite) and every system screen the carousel, console art,
// system name, maker, year and game count.

import type { AnimPreset } from './animations';
import { ANIMATIONS, storyboardXml } from './animations';

export interface Palette6 {
  bg: string;
  bg2: string;
  surface: string;
  text: string;
  dim: string;
  accent: string;
  accentText: string;
}

type Background = 'gradient' | 'grid' | 'scanlines' | 'waves' | 'stripes' | 'sunset' | 'dots' | 'plain' | 'glass' | 'pixels';

export interface Design {
  id: string;
  label: string;
  description: string;
  tags: string[];
  palette: Palette6;
  font: string;
  titleFont?: string;
  background: Background;
  /** Corner radius of panels in pixels; 0 for square, pixel corners for the pixel look. */
  radius: number;
  game: 'list-right' | 'cinema' | 'cover' | 'centered';
  system: 'carousel-mid' | 'wheel-right' | 'bottom' | 'left';
  glow?: boolean;
  scanlines?: boolean;
  uppercase?: boolean;
  /** Animation preset id per role. */
  anims?: Partial<Record<'title' | 'art' | 'logo' | 'list' | 'console', string>>;
}

const P = (bg: string, bg2: string, surface: string, text: string, dim: string, accent: string, accentText: string): Palette6 => ({ bg, bg2, surface, text, dim, accent, accentText });

export const DESIGNS: Design[] = [
  {
    id: 'cinema',
    label: 'Cinema',
    description: 'Streaming-style: full-screen fan art, big game logo, details over a dark fade.',
    tags: ['streaming', 'dark'],
    palette: P('0B0B0F', '16161D', 'FFFFFF14', 'F5F5F7', 'A8A8B3', 'E8433A', 'FFFFFF'),
    font: 'inter',
    titleFont: 'bebas',
    background: 'plain',
    radius: 10,
    game: 'cinema',
    system: 'bottom',
    anims: { title: 'fade-in', art: 'fade-in', console: 'rise' },
  },
  {
    id: 'neon',
    label: 'Arcade Neon',
    description: 'Glowing pink and cyan on a retro grid, with a wheel of logos like an arcade cabinet.',
    tags: ['arcade', 'neon', 'dark'],
    palette: P('07030F', '1A0633', 'FF2BD61F', 'F8EEFF', 'B79CE8', 'FF2BD6', 'FFFFFF'),
    font: 'rajdhani',
    titleFont: 'orbitron',
    background: 'grid',
    radius: 4,
    game: 'list-right',
    system: 'wheel-right',
    glow: true,
    uppercase: true,
    anims: { logo: 'pulse', title: 'slide-left', console: 'float' },
  },
  {
    id: 'crt',
    label: 'Retro CRT',
    description: 'Amber phosphor text on a curved-screen look with scanlines.',
    tags: ['retro', 'crt'],
    palette: P('0C0A06', '1A140A', 'FFB00014', 'FFC24D', 'B88A34', 'FFB000', '0C0A06'),
    font: 'vt323',
    background: 'scanlines',
    radius: 26,
    game: 'list-right',
    system: 'carousel-mid',
    scanlines: true,
    uppercase: true,
    anims: { title: 'fade-in', logo: 'breathe' },
  },
  {
    id: 'pixel',
    label: '8-bit Pixel',
    description: 'Chunky pixel frames and a bright console palette.',
    tags: ['retro', 'pixel', 'colourful'],
    palette: P('1D2B53', '29366F', 'FFFFFF1A', 'FFF1E8', 'C2C3C7', 'FFEC27', '1D2B53'),
    font: 'pressstart',
    background: 'pixels',
    radius: 0,
    game: 'centered',
    system: 'carousel-mid',
    uppercase: true,
    anims: { art: 'pop', logo: 'swing' },
  },
  {
    id: 'soft-home',
    label: 'Soft Home',
    description: 'Bright and friendly: rounded cards on soft stripes, a big clock. Inspired by classic console home screens.',
    tags: ['light', 'console menu', 'friendly'],
    palette: P('F4F7FB', 'E3EAF3', 'FFFFFFE6', '2B3440', '6B7685', '35A7E8', 'FFFFFF'),
    font: 'nunito',
    background: 'stripes',
    radius: 28,
    game: 'list-right',
    system: 'carousel-mid',
    anims: { art: 'float', console: 'float' },
  },
  {
    id: 'cross-bar',
    label: 'Cross Bar',
    description: 'Flowing waves behind a row of icons, inspired by classic console media bars.',
    tags: ['console menu', 'dark', 'blue'],
    palette: P('0A1A3A', '1F4C8F', 'FFFFFF12', 'F2F6FF', 'A9BCDD', 'FFFFFF', '0A1A3A'),
    font: 'exo2',
    background: 'waves',
    radius: 6,
    game: 'centered',
    system: 'carousel-mid',
    anims: { title: 'fade-in' },
  },
  {
    id: 'shelf',
    label: 'Cover Shelf',
    description: 'A big box cover with a mirror reflection, details beside it.',
    tags: ['covers', 'dark'],
    palette: P('121417', '23272E', 'FFFFFF10', 'EDEFF2', '9AA1AC', '4FD1C5', '121417'),
    font: 'poppins',
    background: 'gradient',
    radius: 14,
    game: 'cover',
    system: 'left',
    anims: { art: 'rise' },
  },
  {
    id: 'synthwave',
    label: 'Synthwave Sunset',
    description: 'A striped sunset over a purple horizon. Loud and fun.',
    tags: ['retro', 'colourful', 'neon'],
    palette: P('1A0B2E', '4A1569', 'FFFFFF14', 'FFF4E8', 'F5B3D0', 'FF7A3D', 'FFFFFF'),
    font: 'audiowide',
    background: 'sunset',
    radius: 8,
    game: 'cinema',
    system: 'carousel-mid',
    glow: true,
    anims: { console: 'float', title: 'rise' },
  },
  {
    id: 'minimal',
    label: 'Minimal Light',
    description: 'White space, black type, thin lines. Calm and clean.',
    tags: ['light', 'minimal'],
    palette: P('FAFAFA', 'F0F0F0', '0000000A', '111111', '6E6E6E', '111111', 'FFFFFF'),
    font: 'inter',
    background: 'plain',
    radius: 2,
    game: 'list-right',
    system: 'left',
  },
  {
    id: 'magazine',
    label: 'Magazine',
    description: 'Editorial: elegant serif titles, art across the top, text in columns.',
    tags: ['light', 'elegant'],
    palette: P('F3EEE6', 'E7DFD2', 'FFFFFFB3', '1E1A16', '6B5F52', 'B23A2E', 'FFFFFF'),
    font: 'montserrat',
    titleFont: 'playfair',
    background: 'plain',
    radius: 0,
    game: 'cinema',
    system: 'bottom',
    anims: { title: 'fade-in' },
  },
  {
    id: 'handheld',
    label: 'Pocket LCD',
    description: 'Four shades of green and a dot-matrix screen, like an old handheld.',
    tags: ['retro', 'pixel', 'green'],
    palette: P('9BBC0F', '8BAC0F', '306230', '0F380F', '306230', '0F380F', '9BBC0F'),
    font: 'silkscreen',
    background: 'dots',
    radius: 6,
    game: 'centered',
    system: 'carousel-mid',
    uppercase: true,
  },
  {
    id: 'glass',
    label: 'Midnight Glass',
    description: 'Frosted glass panels on a deep blue glow. Modern and polished.',
    tags: ['dark', 'modern'],
    palette: P('070B1A', '1B2A6B', 'FFFFFF1F', 'F4F7FF', 'A9B4D6', '7C9CFF', 'FFFFFF'),
    font: 'montserrat',
    background: 'glass',
    radius: 22,
    game: 'cover',
    system: 'wheel-right',
    anims: { art: 'float', title: 'fade-in', console: 'float' },
  },
];

// ---- artwork ------------------------------------------------------------------------------

const hex = (c: string) => `#${c.slice(0, 6)}`;

/** SVG files for a design, by file name. */
export function designAssets(d: Design): Record<string, string> {
  const p = d.palette;
  const W = 1920;
  const H = 1080;
  const svg = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;
  let bg: string;
  switch (d.background) {
    case 'grid': {
      const lines: string[] = [];
      for (let i = -20; i <= 20; i++) lines.push(`<line x1="${W / 2 + i * 40}" y1="${H * 0.58}" x2="${W / 2 + i * 260}" y2="${H}" />`);
      for (let k = 0; k < 12; k++) {
        const y = H * 0.58 + Math.pow(k / 11, 2) * H * 0.42;
        lines.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" />`);
      }
      bg = svg(
        W,
        H,
        `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hex(p.bg)}"/><stop offset="0.58" stop-color="${hex(p.bg2)}"/><stop offset="1" stop-color="${hex(p.bg)}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#s)"/><g stroke="${hex(p.accent)}" stroke-opacity="0.45" stroke-width="2">${lines.join('')}</g><rect y="${H * 0.575}" width="${W}" height="4" fill="#22e6ff" opacity="0.8"/>`,
      );
      break;
    }
    case 'scanlines':
      bg = svg(W, H, `<defs><radialGradient id="g" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="${hex(p.bg2)}"/><stop offset="1" stop-color="${hex(p.bg)}"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>`);
      break;
    case 'waves': {
      const wave = (y: number, a: number, o: number) => {
        let dpath = `M0 ${y}`;
        for (let x = 0; x <= W; x += 40) dpath += ` L${x} ${(y + Math.sin(x / 260 + o) * a).toFixed(1)}`;
        return `<path d="${dpath}" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3"/>`;
      };
      bg = svg(
        W,
        H,
        `<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hex(p.bg2)}"/><stop offset="1" stop-color="${hex(p.bg)}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#b)"/>${wave(H * 0.55, 60, 0)}${wave(H * 0.58, 45, 1.3)}${wave(H * 0.61, 70, 2.1)}${wave(H * 0.64, 35, 3.4)}`,
      );
      break;
    }
    case 'stripes':
      bg = svg(
        W,
        H,
        `<defs><pattern id="st" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="${hex(p.bg)}"/><rect y="12" width="24" height="12" fill="${hex(p.bg2)}"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#st)"/>`,
      );
      break;
    case 'sunset': {
      const bands: string[] = [];
      for (let i = 0; i < 7; i++) bands.push(`<rect x="660" y="${560 + i * 34}" width="600" height="${10 + i * 2}" fill="${hex(p.bg)}"/>`);
      bg = svg(
        W,
        H,
        `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hex(p.bg)}"/><stop offset="0.7" stop-color="${hex(p.bg2)}"/><stop offset="1" stop-color="#ff5f7e"/></linearGradient><linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23d"/><stop offset="1" stop-color="#ff3d8b"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="960" cy="640" r="300" fill="url(#sun)"/>${bands.join('')}<rect y="780" width="${W}" height="300" fill="${hex(p.bg)}" opacity="0.92"/>`,
      );
      break;
    }
    case 'dots':
      bg = svg(
        W,
        H,
        `<defs><pattern id="d" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${hex(p.bg)}"/><rect x="1" y="1" width="10" height="10" fill="${hex(p.bg2)}"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#d)"/>`,
      );
      break;
    case 'glass':
      bg = svg(
        W,
        H,
        `<defs><radialGradient id="a" cx="0.2" cy="0.2" r="0.6"><stop offset="0" stop-color="${hex(p.bg2)}"/><stop offset="1" stop-color="${hex(p.bg)}" stop-opacity="0"/></radialGradient><radialGradient id="c" cx="0.85" cy="0.85" r="0.55"><stop offset="0" stop-color="#7a2bd6" stop-opacity="0.7"/><stop offset="1" stop-color="${hex(p.bg)}" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="${hex(p.bg)}"/><rect width="${W}" height="${H}" fill="url(#a)"/><rect width="${W}" height="${H}" fill="url(#c)"/>`,
      );
      break;
    case 'pixels': {
      const blocks: string[] = [];
      let seed = 7;
      const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      for (let i = 0; i < 60; i++) blocks.push(`<rect x="${Math.floor(rnd() * 48) * 40}" y="${Math.floor(rnd() * 27) * 40}" width="40" height="40" fill="${hex(p.bg2)}"/>`);
      bg = svg(W, H, `<rect width="${W}" height="${H}" fill="${hex(p.bg)}"/>${blocks.join('')}`);
      break;
    }
    case 'gradient':
      bg = svg(W, H, `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hex(p.bg2)}"/><stop offset="1" stop-color="${hex(p.bg)}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>`);
      break;
    default:
      bg = svg(W, H, `<rect width="${W}" height="${H}" fill="${hex(p.bg)}"/>`);
  }

  // Panels are white so the theme can tint them with <color>; pixel corners for the pixel look.
  const r = d.radius;
  const panel =
    d.id === 'pixel'
      ? svg(96, 96, `<path d="M8 0H88V8H96V88H88V96H8V88H0V8H8Z" fill="#ffffff"/><path d="M8 4H88V8H92V88H88V92H8V88H4V8H8Z" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="4"/>`)
      : svg(Math.max(96, r * 3), Math.max(96, r * 3), `<rect x="1" y="1" width="${Math.max(96, r * 3) - 2}" height="${Math.max(96, r * 3) - 2}" rx="${r}" fill="#ffffff"/>`);

  const fade = svg(
    W,
    H,
    `<defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${hex(p.bg)}"/><stop offset="0.45" stop-color="${hex(p.bg)}" stop-opacity="0.85"/><stop offset="0.75" stop-color="${hex(p.bg)}" stop-opacity="0.15"/><stop offset="1" stop-color="${hex(p.bg)}" stop-opacity="0"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="${hex(p.bg)}" stop-opacity="0"/><stop offset="1" stop-color="${hex(p.bg)}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#l)"/><rect width="${W}" height="${H}" fill="url(#b)"/>`,
  );

  const out: Record<string, string> = { 'background.svg': bg, 'panel.svg': panel, 'fade.svg': fade };
  if (d.scanlines) out['scanlines.svg'] = svg(4, 4, `<rect width="4" height="2" fill="#000" fill-opacity="0.35"/>`);
  if (d.radius >= 20) out['bezel.svg'] = svg(W, H, `<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="80" fill="none" stroke="#000" stroke-width="40" stroke-opacity="0.55"/>`);
  return out;
}

// ---- layouts -------------------------------------------------------------------------------

export interface DesignEl {
  type: string;
  name: string;
  props: Record<string, string | string[]>;
  anim?: string;
}

export interface DesignContext {
  /** Theme-relative folder the design's SVG files go in, e.g. `./_inc/ccs/cinema`. */
  art: string;
  font: string | null;
  titleFont: string | null;
  /** Folders of console art copied into the theme, if any. */
  logos: string | null;
  consoles: string | null;
}

const LABELS_AND_EXTRAS = ['md_lbl_rating', 'md_lbl_releasedate', 'md_lbl_developer', 'md_lbl_publisher', 'md_lbl_genre', 'md_lbl_players', 'md_lbl_lastplayed', 'md_lbl_playcount', 'md_publisher', 'md_playcount', 'md_lastplayed'];

function text(d: Design, c: DesignContext, name: string, props: Record<string, string>, opts: { title?: boolean; dim?: boolean; native?: boolean } = {}): DesignEl {
  const p = d.palette;
  const font = opts.title ? (c.titleFont ?? c.font) : c.font;
  const out: Record<string, string> = {
    color: `${opts.dim ? p.dim : p.text}FF`.slice(0, 8),
    ...(font ? { fontPath: font } : {}),
    ...(d.uppercase && opts.title ? { forceUppercase: 'true' } : {}),
    ...(d.glow && opts.title ? { glowColor: `${p.accent}AA`.slice(0, 8), glowSize: '2' } : {}),
    visible: 'true',
    ...props,
  };
  return { type: opts.native ? (name === 'md_releasedate' ? 'datetime' : 'text') : 'text', name, props: out };
}

const col = (c: string) => (c.length === 6 ? `${c}FF` : c);

/** A rounded panel; the white SVG is tinted with the design's surface colour (or `color`). */
function panel(d: Design, c: DesignContext, name: string, pos: string, size: string, z = 5, color = col(d.palette.surface)): DesignEl {
  const corner = Math.max(8, d.radius);
  return { type: 'ninepatch', name, props: { pos, size, path: `${c.art}/panel.svg`, cornerSize: `${corner} ${corner}`, color, zIndex: String(z) } };
}

function common(d: Design, c: DesignContext, view: string): DesignEl[] {
  const p = d.palette;
  const out: DesignEl[] = [
    { type: 'image', name: 'ccs_background', props: { pos: '0 0', size: '1 1', path: `${c.art}/background.svg`, zIndex: '0' } },
    { type: 'helpsystem', name: 'help', props: { pos: '0.02 0.955', textColor: col(p.dim), iconColor: col(p.dim), ...(c.font ? { fontPath: c.font } : {}) } },
    text(d, c, 'ccs_clock', { pos: '0.97 0.035', origin: '1 0', fontSize: '0.032' }, { dim: true }),
  ];
  out[2].type = 'clock';
  out[2].props.format = '%H:%M';
  if (d.scanlines) out.push({ type: 'image', name: 'ccs_scanlines', props: { pos: '0 0', size: '1 1', path: `${c.art}/scanlines.svg`, tile: 'true', zIndex: '90' } });
  if (d.radius >= 20 && d.id === 'crt') out.push({ type: 'image', name: 'ccs_bezel', props: { pos: '0 0', size: '1 1', path: `${c.art}/bezel.svg`, zIndex: '91' } });
  void view;
  return out;
}

function gameList(d: Design, c: DesignContext, pos: string, size: string, align = 'left'): DesignEl {
  const p = d.palette;
  return {
    type: 'textlist',
    name: 'gamelist',
    props: {
      pos,
      size,
      alignment: align,
      fontSize: d.font === 'pressstart' || d.font === 'silkscreen' ? '0.024' : '0.032',
      lineSpacing: '1.65',
      horizontalMargin: '0.012',
      primaryColor: col(p.text),
      secondaryColor: col(p.accent),
      selectedColor: col(p.accentText),
      selectorColor: col(p.accent),
      ...(c.font ? { fontPath: c.font } : {}),
      ...(d.uppercase ? { forceUppercase: 'true' } : {}),
      zIndex: '40',
    },
    anim: d.anims?.list,
  };
}

/** The game's media and details, wherever the archetype puts them. */
function gameScreen(d: Design, c: DesignContext, view: string): DesignEl[] {
  const p = d.palette;
  const video = view === 'video';
  const els: DesignEl[] = [...common(d, c, view)];
  const art = (name: string, pos: string, max: string, z: number, extra: Record<string, string> = {}, anim?: string): DesignEl => ({
    type: name === 'md_video' ? 'video' : 'image',
    name,
    props: { pos, origin: extra.origin ?? '0.5 0.5', maxSize: max, visible: 'true', zIndex: String(z), ...extra },
    anim,
  });
  const boxart = (pos: string, max: string, z = 32, extra: Record<string, string> = {}) => art('ccs_boxart', pos, max, z, { path: 'firstfile({game:boxart}, {game:thumbnail}, {game:image})', ...extra }, d.anims?.art);
  const screenshot = (pos: string, max: string, extra: Record<string, string> = {}) => (video ? art('md_video', pos, max, 31, { delay: '0.8', showSnapshotNoVideo: 'true', ...extra }) : art('md_image', pos, max, 31, extra));
  const fanart = (opacityHex: string) => ({ type: 'image', name: 'ccs_fanart', props: { pos: '0 0', size: '1 1', path: 'firstfile({game:fanart}, {game:image})', color: `FFFFFF${opacityHex}`, zIndex: '1' } }) as DesignEl;
  const systemLogo = (pos: string, origin: string, max: string): DesignEl => ({
    type: 'image',
    name: 'logo',
    props: { pos, origin, maxSize: max, ...(c.logos ? { path: [`${c.logos}/\${system.theme}.svg`, `${c.logos}/\${system.theme}.png`] } : {}), zIndex: '50' },
    anim: d.anims?.logo,
  });
  // RetroBat shows the system's name as text where there's no logo picture: same place, same look.
  const systemLogoText = (pos: string, origin: string, max: string): DesignEl => {
    const [w] = max.split(' ');
    const align = origin.startsWith('1') ? 'right' : origin.startsWith('0.5') ? 'center' : 'left';
    // Full system names are long ("Super Nintendo Entertainment System"): give the text room.
    return text(d, c, 'logoText', { pos, origin, size: `${Math.max(Number(w), 0.36)} 0.05`, fontSize: '0.03', alignment: align, zIndex: '50' }, { title: true, native: true });
  };
  const details = (x: number, y: number, w: number, step = 0.036) => [
    { type: 'rating', name: 'md_rating', props: { pos: `${x} ${y}`, size: `0 ${(step * 0.85).toFixed(3)}`, color: col(p.accent), unfilledColor: `${p.dim.slice(0, 6)}55`, visible: 'true', zIndex: '40' } } as DesignEl,
    { ...text(d, c, 'md_releasedate', { pos: `${(x + w * 0.42).toFixed(3)} ${y}`, fontSize: '0.024', format: '%Y', zIndex: '40' }, { dim: true, native: true }), type: 'datetime' },
    text(d, c, 'md_genre', { pos: `${x} ${(y + step).toFixed(3)}`, size: `${(w * 0.5).toFixed(3)} 0.03`, fontSize: '0.022', zIndex: '40' }, { dim: true, native: true }),
    text(d, c, 'md_developer', { pos: `${(x + w * 0.5).toFixed(3)} ${(y + step).toFixed(3)}`, size: `${(w * 0.5).toFixed(3)} 0.03`, fontSize: '0.022', zIndex: '40' }, { dim: true, native: true }),
    text(d, c, 'md_players', { pos: `${x} ${(y + step * 2).toFixed(3)}`, size: `${(w * 0.5).toFixed(3)} 0.03`, fontSize: '0.022', zIndex: '40' }, { dim: true, native: true }),
    text(d, c, 'ccs_favorite', { pos: `${(x + w * 0.5).toFixed(3)} ${(y + step * 2).toFixed(3)}`, size: `${(w * 0.5).toFixed(3)} 0.03`, fontSize: '0.022', text: '★ Favourite', color: col(p.accent), visible: '{game:favorite}', zIndex: '40' }),
  ];
  const desc = (pos: string, size: string, fs = '0.02') => text(d, c, 'md_description', { pos, size, fontSize: fs, lineSpacing: '1.45', verticalAlignment: 'top', zIndex: '40' }, { dim: true, native: true });
  const title = (pos: string, size: string, fs = '0.046', align = 'left') => ({ ...text(d, c, 'ccs_title', { pos, size, fontSize: fs, alignment: align, text: '{game:name}', zIndex: '45' }, { title: true }), anim: d.anims?.title });
  const marquee = (pos: string, max: string, origin = '0 0') => art('md_marquee', pos, max, 46, { origin });

  switch (d.game) {
    case 'cinema':
      els.push(
        fanart('FF'),
        { type: 'image', name: 'ccs_fade', props: { pos: '0 0', size: '1 1', path: `${c.art}/fade.svg`, zIndex: '2' } },
        systemLogo('0.97 0.09', '1 0', '0.16 0.06'),
        systemLogoText('0.97 0.09', '1 0', '0.16 0.06'),
        marquee('0.05 0.09', '0.36 0.15'),
        title('0.05 0.26', '0.42 0.06', '0.05'),
        ...details(0.05, 0.34, 0.4),
        desc('0.05 0.46', '0.4 0.16'),
        screenshot('0.15 0.77', '0.2 0.2'),
        boxart('0.34 0.77', '0.1 0.2'),
        panel(d, c, 'ccs_listpanel', '0.65 0.14', '0.32 0.74', 20, `${p.bg.slice(0, 6)}B3`),
        gameList(d, c, '0.665 0.16', '0.29 0.7'),
      );
      break;
    case 'cover':
      els.push(
        fanart('22'),
        systemLogo('0.04 0.05', '0 0', '0.22 0.07'),
        systemLogoText('0.04 0.05', '0 0', '0.22 0.07'),
        boxart('0.22 0.47', '0.3 0.56'),
        { ...boxart('0.22 0.75', '0.3 0.56', 31, { origin: '0.5 0', flipY: 'true', color: 'FFFFFF33' }), name: 'ccs_reflection', anim: undefined },
        panel(d, c, 'ccs_infopanel', '0.41 0.12', '0.24 0.8', 10),
        marquee('0.53 0.15', '0.2 0.08', '0.5 0'),
        title('0.425 0.26', '0.21 0.08', '0.03'),
        ...details(0.425, 0.36, 0.21, 0.034),
        screenshot('0.53 0.57', '0.2 0.14'),
        desc('0.425 0.67', '0.21 0.22', '0.017'),
        panel(d, c, 'ccs_listpanel', '0.67 0.12', '0.3 0.8', 10),
        gameList(d, c, '0.685 0.14', '0.27 0.76'),
      );
      break;
    case 'centered':
      els.push(
        fanart('26'),
        systemLogo('0.5 0.04', '0.5 0', '0.26 0.07'),
        systemLogoText('0.5 0.04', '0.5 0', '0.26 0.07'),
        panel(d, c, 'ccs_artpanel', '0.08 0.13', '0.84 0.42', 8),
        boxart('0.2 0.34', '0.16 0.36'),
        screenshot('0.5 0.34', '0.36 0.36'),
        marquee('0.8 0.34', '0.2 0.16', '0.5 0.5'),
        title('0.1 0.555', '0.8 0.055', '0.04', 'center'),
        ...details(0.1, 0.63, 0.32, 0.034),
        desc('0.46 0.625', '0.44 0.11', '0.017'),
        panel(d, c, 'ccs_listpanel', '0.25 0.76', '0.5 0.17', 20),
        gameList(d, c, '0.27 0.77', '0.46 0.15', 'center'),
      );
      break;
    default:
      els.push(
        fanart('26'),
        systemLogo('0.04 0.04', '0 0', '0.28 0.08'),
        systemLogoText('0.04 0.04', '0 0', '0.28 0.08'),
        panel(d, c, 'ccs_infopanel', '0.03 0.14', '0.46 0.78', 10),
        title('0.05 0.16', '0.42 0.06'),
        boxart('0.14 0.41', '0.17 0.3'),
        screenshot('0.35 0.41', '0.22 0.3'),
        marquee('0.47 0.24', '0.12 0.06', '1 0.5'),
        ...details(0.05, 0.585, 0.42),
        desc('0.05 0.705', '0.42 0.19'),
        panel(d, c, 'ccs_listpanel', '0.52 0.14', '0.45 0.78', 10),
        gameList(d, c, '0.54 0.16', '0.41 0.74'),
      );
  }
  return els;
}

function systemScreen(d: Design, c: DesignContext): DesignEl[] {
  const p = d.palette;
  const els: DesignEl[] = [...common(d, c, 'system')];
  const consoleArt = (pos: string, max: string): DesignEl => ({
    type: 'image',
    name: 'ccs_console',
    props: {
      pos,
      origin: '0.5 0.5',
      maxSize: max,
      path: c.consoles ? [`${c.consoles}/\${system.theme}.png`, `${c.consoles}/\${system.theme}.svg`] : 'firstfile({system:random:thumbnail}, {system:random:image})',
      zIndex: '20',
    },
    anim: d.anims?.console,
  });
  const randomArt: DesignEl = { type: 'image', name: 'ccs_systemart', props: { pos: '0 0', size: '1 1', path: 'firstfile({system:random:fanart}, {system:random:image})', color: 'FFFFFF2E', zIndex: '1' } };
  const carousel = (type: string, pos: string, size: string, logo: string, count: string): DesignEl => ({
    type: 'carousel',
    name: 'systemcarousel',
    props: { type, pos, size, logoSize: logo, maxLogoCount: count, color: '00000000', logoScale: '1.25', minLogoOpacity: '0.45', zIndex: '40' },
  });
  const logoStyle: DesignEl[] = [
    { type: 'image', name: 'logo', props: c.logos ? { path: [`${c.logos}/\${system.theme}.svg`, `${c.logos}/\${system.theme}.png`] } : {} },
    text(d, c, 'logoText', { fontSize: '0.06' }, { title: true, native: true }),
  ];
  const name = (pos: string, size: string, align: string, fs = '0.052') => text(d, c, 'ccs_systemname', { pos, size, alignment: align, fontSize: fs, text: '{system:fullName}', zIndex: '45' }, { title: true });
  const maker = (pos: string, size: string, align: string) => text(d, c, 'ccs_systemmaker', { pos, size, alignment: align, fontSize: '0.026', text: '{system:manufacturer} + "  ·  " + {system:releaseYear}', zIndex: '45' }, { dim: true });
  const count = (pos: string, size: string, align: string) => text(d, c, 'ccs_systemcount', { pos, size, alignment: align, fontSize: '0.024', text: '{system:total} + " games"', color: col(p.accent), zIndex: '45' });
  const hideInfo: DesignEl = { type: 'text', name: 'systemInfo', props: { visible: 'false' } };

  switch (d.system) {
    case 'wheel-right':
      els.push(randomArt, panel(d, c, 'ccs_wheelpanel', '0.6 0', '0.4 1', 10), carousel('vertical_wheel', '0.6 0', '0.4 1', '0.28 0.13', '5'), ...logoStyle, consoleArt('0.3 0.42', '0.44 0.46'), name('0.05 0.76', '0.5 0.07', 'left'), maker('0.05 0.83', '0.5 0.04', 'left'), count('0.05 0.875', '0.5 0.04', 'left'), hideInfo);
      break;
    case 'bottom':
      els.push(randomArt, panel(d, c, 'ccs_band', '0 0.72', '1 0.22', 10), carousel('horizontal', '0 0.73', '1 0.2', '0.16 0.11', '5'), ...logoStyle, consoleArt('0.5 0.34', '0.5 0.44'), name('0.1 0.6', '0.8 0.07', 'center'), maker('0.1 0.665', '0.8 0.04', 'center'), count('0.1 0.94', '0.8 0.03', 'center'), hideInfo);
      break;
    case 'left':
      els.push(randomArt, panel(d, c, 'ccs_column', '0 0', '0.3 1', 10), carousel('vertical', '0 0', '0.3 1', '0.24 0.1', '7'), ...logoStyle, consoleArt('0.65 0.4', '0.5 0.5'), name('0.36 0.74', '0.6 0.07', 'left'), maker('0.36 0.81', '0.6 0.04', 'left'), count('0.36 0.855', '0.6 0.04', 'left'), hideInfo);
      break;
    default:
      els.push(randomArt, panel(d, c, 'ccs_band', '0 0.37', '1 0.26', 10), carousel('horizontal', '0 0.38', '1 0.24', '0.22 0.15', '3'), ...logoStyle, consoleArt('0.5 0.19', '0.3 0.26'), name('0.1 0.66', '0.8 0.07', 'center'), maker('0.1 0.73', '0.8 0.04', 'center'), count('0.1 0.775', '0.8 0.04', 'center'), hideInfo);
  }
  return els;
}

/** Elements of a design for one screen. */
export function designElements(d: Design, c: DesignContext, view: string): DesignEl[] {
  if (view === 'system') return systemScreen(d, c);
  if (['basic', 'detailed', 'video'].includes(view)) {
    const els = gameScreen(d, c, view);
    for (const n of LABELS_AND_EXTRAS) els.push({ type: n === 'md_lastplayed' ? 'datetime' : 'text', name: n, props: { visible: 'false' } });
    return els;
  }
  return [];
}

/** Markup lines (two-space indented, inside a <view>) for elements, with their animations. */
export function elementsMarkup(els: DesignEl[], extraNames: Set<string>): string[] {
  const lines: string[] = [];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  for (const e of els) {
    const extra = extraNames.has(e.name) ? ' extra="true"' : '';
    lines.push(`  <${e.type} name="${e.name}"${extra}>`);
    for (const [k, v] of Object.entries(e.props)) for (const one of Array.isArray(v) ? v : [v]) lines.push(`    <${k}>${esc(one)}</${k}>`);
    const preset = e.anim ? ANIMATIONS.find((a: AnimPreset) => a.id === e.anim) : undefined;
    if (preset) {
      const pos = String(e.props.pos ?? '0 0').split(' ').map(Number) as [number, number];
      for (const l of storyboardXml(preset, pos).split('\n')) lines.push(`    ${l}`);
    }
    lines.push(`  </${e.type}>`);
  }
  return lines;
}

/** Names in a design that are the design's own (not RetroBat's), so they get extra="true". */
export function isDesignExtra(name: string): boolean {
  return name.startsWith('ccs_');
}
