// Complete looks for a theme: artwork (generated SVG), colours, a font, animations, and a layout
// for the system screen and every game list screen. Every game screen gets all of RetroBat's
// game data (fan art, box art, screenshot or video, logo, name, description, rating, year,
// genre, developer, players, favourite) and every system screen the carousel, console art,
// system name, maker, year and game count.

import type { AnimPreset } from './animations';
import { ANIMATIONS, screenOf, storyboardXml } from './animations';
import { systemLayout, type SystemLayout } from './systemLayouts';
import { frameXml, type Frame } from './frame';
import { shadowXml } from './shadow';
import { depthLevel, PARALLAX, PARALLAX_ANIM, SHADOWED, type Depth } from './depth';
import { backgroundSvg, decoSvg, hex, svg as svgDoc, type Background, type Deco } from './designArt';

export interface Palette6 {
  bg: string;
  bg2: string;
  surface: string;
  text: string;
  dim: string;
  accent: string;
  accentText: string;
}

/** Style groups designs are filed under (the filter in New theme and Presets). */
export type DesignGroup = 'professional' | 'gaming' | 'cute' | 'tech' | 'anime' | 'retro' | 'mood';

export interface Design {
  id: string;
  label: string;
  description: string;
  group: DesignGroup;
  tags: string[];
  palette: Palette6;
  font: string;
  titleFont?: string;
  background: Background;
  /** Corner radius of panels in pixels; 0 for square, pixel corners for the pixel look. */
  radius: number;
  game: 'list-right' | 'cinema' | 'cover' | 'centered';
  /** Id of the system screen layout the design comes with (any layout in SYSTEM_LAYOUTS works). */
  system: string;
  glow?: boolean;
  scanlines?: boolean;
  uppercase?: boolean;
  /** Animation preset id per role. */
  anims?: Partial<Record<'title' | 'art' | 'logo' | 'list' | 'console', string>>;
  /** How much depth the design has (see depth.ts); Subtle when not given. */
  depth?: Depth;
  /** A second accent for two-colour artwork. */
  accent2?: string;
  /** Decorations floating round the edges of every screen. */
  deco?: Deco;
  decoColors?: string[];
  /** Box art (and, half as much, the title) set at a jaunty angle, in degrees. */
  tilt?: number;
  /** Pixel corners on panels and tiles. */
  pixel?: boolean;
  /** A dark curved-screen bezel over everything. */
  bezel?: boolean;
}

/**
 * The design drawn in other colours (a palette, or the theme's own design colours). Its own
 * second accent and decoration colours only stay while the accent is still the design's.
 */
export function recoloured(d: Design, palette: Palette6): Design {
  if (palette.accent.slice(0, 6).toUpperCase() === d.palette.accent.slice(0, 6).toUpperCase()) return { ...d, palette };
  return { ...d, palette, accent2: undefined, decoColors: undefined };
}

export { DESIGNS, DESIGN_GROUPS } from './designCatalog';

// ---- artwork ------------------------------------------------------------------------------

/** SVG files for a design, by file name. */
export function designAssets(d: Design, depth: Depth = d.depth ?? 'subtle'): Record<string, string> {
  const p = d.palette;
  const W = 1920;
  const H = 1080;
  const svg = svgDoc;
  const bg = backgroundSvg(d);

  // Panels are white so the theme can tint them with <color>; pixel corners for the pixel look.
  const r = d.radius;
  const panel =
    d.pixel
      ? svg(96, 96, `<path d="M8 0H88V8H96V88H88V96H8V88H0V8H8Z" fill="#ffffff"/><path d="M8 4H88V8H92V88H88V92H8V88H4V8H8Z" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="4"/>`)
      : (() => {
          // With depth, a light top edge and a darker bottom edge make the panel look raised
          // (the panel is tinted, so these stay lighter and darker than its colour).
          const n = Math.max(96, r * 3);
          const b = depthLevel(depth).bevel;
          const bevel = b
            ? `<defs><linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${(0.28 * b).toFixed(2)}"/></linearGradient></defs><rect x="1" y="1" width="${n - 2}" height="${n - 2}" rx="${r}" fill="url(#v)"/><rect x="2" y="2" width="${n - 4}" height="${n - 4}" rx="${Math.max(0, r - 1)}" fill="none" stroke="#000" stroke-opacity="${(0.22 * b).toFixed(2)}" stroke-width="2"/><path d="M${r + 2} 2.5H${n - r - 2}" stroke="#fff" stroke-opacity="${(0.55 * b).toFixed(2)}" stroke-width="2" stroke-linecap="round"/>`
            : '';
          return svg(n, n, `<rect x="1" y="1" width="${n - 2}" height="${n - 2}" rx="${r}" fill="#ffffff"/>${bevel}`);
        })();

  // Console tiles: a tile with a soft inner edge, and the selected tile with a ring and a glow
  // (white, tinted by the theme). Both leave the same margin round the tile for the glow.
  const T = tileGeometry(d);
  const shape = (inset: number, attrs: string) => {
    const x = T.margin - inset;
    const w = T.size - 2 * x;
    const rr = Math.max(0, T.radius + inset);
    if (!d.pixel) return `<rect x="${x}" y="${x}" width="${w}" height="${w}" rx="${rr}" ${attrs}/>`;
    const k = Math.max(4, Math.round(rr / 2));
    return `<path d="M${x + k} ${x}H${x + w - k}V${x + k}H${x + w}V${x + w - k}H${x + w - k}V${x + w}H${x + k}V${x + w - k}H${x}V${x + k}H${x + k}Z" ${attrs}/>`;
  };
  const tile = svg(T.size, T.size, `${shape(0, 'fill="#ffffff"')}${shape(-2, 'fill="none" stroke="#000000" stroke-opacity="0.22" stroke-width="3"')}`);
  const tileSelected = svg(
    T.size,
    T.size,
    `${shape(8, 'fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="4"')}${shape(5, 'fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="3"')}${shape(0, 'fill="#ffffff" fill-opacity="0.3"')}${shape(-2.5, 'fill="none" stroke="#ffffff" stroke-width="5"')}`,
  );

  const fade = svg(
    W,
    H,
    `<defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${hex(p.bg)}"/><stop offset="0.45" stop-color="${hex(p.bg)}" stop-opacity="0.85"/><stop offset="0.75" stop-color="${hex(p.bg)}" stop-opacity="0.15"/><stop offset="1" stop-color="${hex(p.bg)}" stop-opacity="0"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="${hex(p.bg)}" stop-opacity="0"/><stop offset="1" stop-color="${hex(p.bg)}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#l)"/><rect width="${W}" height="${H}" fill="url(#b)"/>`,
  );

  // RetroBat's SVG renderer can't draw patterns and blends gradients differently, so full-screen
  // art is written as PNG (given here as SVG source; the editor rasterizes it when writing).
  // An arrow for layouts with arrows beside the logo (white, tinted by the theme; the left one is flipped).
  const arrow = svg(64, 96, `<path d="M14 10L50 48L14 86" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`);
  const out: Record<string, string> = { 'background.png': bg, 'panel.svg': panel, 'fade.png': fade, 'tile.svg': tile, 'tile-selected.svg': tileSelected, 'arrow.svg': arrow };
  const deco = decoSvg(d);
  if (deco) out['deco.png'] = deco;
  if (d.scanlines) out['scanlines.svg'] = svg(4, 4, `<rect width="4" height="2" fill="#000" fill-opacity="0.35"/>`);
  if (d.bezel) out['bezel.svg'] = svg(W, H, `<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="80" fill="none" stroke="#000" stroke-width="40" stroke-opacity="0.55"/>`);
  return out;
}

/** Size, glow margin and corner radius of a design's tile pictures, in pixels. */
export function tileGeometry(d: Design): { size: number; margin: number; radius: number; corner: number } {
  const radius = d.pixel ? 8 : Math.max(6, Math.min(d.radius, 28));
  const margin = 10;
  return { size: 128, margin, radius, corner: margin + radius + 6 };
}

/**
 * The frame round a design's screenshots and videos (RetroBat's border shader): rounded unless
 * the design is square or pixel-cornered, a thin light border, and a soft drop shadow.
 */
export function designFrame(d: Design, accent = `${d.palette.accent.slice(0, 6)}FF`, depth: Depth = d.depth ?? 'subtle'): Frame {
  const square = d.pixel || d.radius === 0;
  const lv = depthLevel(depth);
  return { corners: square ? 0 : Math.min(0.06, Math.max(0.02, d.radius / 500)), border: d.pixel ? 4 : 2, borderColor: d.pixel ? accent : 'FFFFFF55', shadow: lv.frameShadow, shadowColor: lv.id === 'strong' ? '000000AA' : '00000088' };
}

// ---- layouts -------------------------------------------------------------------------------

export interface DesignEl {
  type: string;
  name: string;
  props: Record<string, string | string[]>;
  anim?: string;
  /** Nested blocks written as they are (a <shader>, for example). */
  blocks?: string[];
}

export interface DesignContext {
  /** Colours as shared variables (designText, designAccent...) instead of fixed values. */
  vars?: boolean;
  /** Theme-relative folder the design's SVG files go in, e.g. `./_inc/ccs/cinema`. */
  art: string;
  font: string | null;
  titleFont: string | null;
  /** Folders of console art copied into the theme, if any. */
  logos: string | null;
  consoles: string | null;
  /** Depth to build with; the design's own when not given. */
  depth?: Depth;
}

const LABELS_AND_EXTRAS = ['md_lbl_rating', 'md_lbl_releasedate', 'md_lbl_developer', 'md_lbl_publisher', 'md_lbl_genre', 'md_lbl_players', 'md_lbl_lastplayed', 'md_lbl_playcount', 'md_publisher', 'md_playcount', 'md_lastplayed'];

function text(d: Design, c: DesignContext, name: string, props: Record<string, string>, opts: { title?: boolean; dim?: boolean; native?: boolean } = {}): DesignEl {
  const p = d.palette;
  const font = opts.title ? (c.titleFont ?? c.font) : c.font;
  const out: Record<string, string> = {
    color: K(d, c, opts.dim ? 'designDimText' : 'designText'),
    ...(font ? { fontPath: font } : {}),
    ...(d.uppercase && opts.title ? { forceUppercase: 'true' } : {}),
    ...(d.glow && opts.title ? { glowColor: K(d, c, 'designGlow'), glowSize: '2' } : {}),
    visible: 'true',
    ...props,
  };
  return { type: opts.native ? (name === 'md_releasedate' ? 'datetime' : 'text') : 'text', name, props: out };
}

const col = (c: string) => (c.length === 6 ? `${c}FF` : c);

/**
 * The colours a design's parts use, by the shared variable name each is written as when
 * `DesignContext.vars` is set. A colour set (RetroBat's Color set option) redefines them.
 */
export function designVars(p: Palette6): Record<DesignVar, string> {
  const faint = p.surface.length === 8 && parseInt(p.surface.slice(6), 16) < 0x30;
  return {
    designBackground: col(p.bg),
    designBackground2: col(p.bg2),
    designPanel: col(p.surface),
    designText: `${p.text}FF`.slice(0, 8),
    designDimText: `${p.dim}FF`.slice(0, 8),
    designAccent: col(p.accent),
    designSelectedText: col(p.accentText),
    designGlow: `${p.accent}AA`.slice(0, 8),
    designRatingOff: `${p.dim.slice(0, 6)}55`,
    designListPanel: `${p.bg.slice(0, 6)}B3`,
    designTile: col(faint ? `${p.text}22` : p.surface),
  };
}

export type DesignVar = 'designBackground' | 'designBackground2' | 'designPanel' | 'designText' | 'designDimText' | 'designAccent' | 'designSelectedText' | 'designGlow' | 'designRatingOff' | 'designListPanel' | 'designTile';

/** A design colour: its variable when the context asks for shared colours, else its value. */
function K(d: Design, c: DesignContext, name: DesignVar): string {
  return c.vars ? '${' + name + '}' : designVars(d.palette)[name];
}

/** A rounded panel; the white SVG is tinted with the design's surface colour (or `color`). */
function panel(d: Design, c: DesignContext, name: string, pos: string, size: string, z = 5, color = K(d, c, 'designPanel')): DesignEl {
  const corner = Math.max(8, d.radius);
  return { type: 'ninepatch', name, props: { pos, size, path: `${c.art}/panel.svg`, cornerSize: `${corner} ${corner}`, color, zIndex: String(z) } };
}

function common(d: Design, c: DesignContext, view: string): DesignEl[] {
  const p = d.palette;
  const out: DesignEl[] = [
    { type: 'image', name: 'ccs_background', props: { pos: '0 0', size: '1 1', path: `${c.art}/background.png`, zIndex: '0' } },
    { type: 'helpsystem', name: 'help', props: { pos: '0.02 0.955', textColor: K(d, c, 'designDimText'), iconColor: K(d, c, 'designDimText'), ...(c.font ? { fontPath: c.font } : {}) } },
    text(d, c, 'ccs_clock', { pos: '0.97 0.035', origin: '1 0', fontSize: '0.032' }, { dim: true }),
  ];
  // RetroBat's clock has no format: 12 or 24 hours comes from its own ClockMode12 setting.
  out[2].type = 'clock';
  if (d.scanlines) out.push({ type: 'image', name: 'ccs_scanlines', props: { pos: '0 0', size: '1 1', path: `${c.art}/scanlines.svg`, tile: 'true', zIndex: '90' } });
  if (d.deco) out.push({ type: 'image', name: 'ccs_deco', props: { pos: '0 0', size: '1 1', path: `${c.art}/deco.png`, zIndex: '3' }, anim: 'hover' });
  if (d.bezel) out.push({ type: 'image', name: 'ccs_bezel', props: { pos: '0 0', size: '1 1', path: `${c.art}/bezel.svg`, zIndex: '91' } });
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
      primaryColor: K(d, c, 'designText'),
      secondaryColor: K(d, c, 'designAccent'),
      selectedColor: K(d, c, 'designSelectedText'),
      selectorColor: K(d, c, 'designAccent'),
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
  // Covers get rounded corners; screenshots and videos a frame with a border and soft shadow.
  const round: Record<string, string> = d.pixel || d.radius === 0 ? {} : { roundCorners: '0.025' };
  const tilt = (deg: number): Record<string, string> => (deg ? { rotation: String(Math.round(deg * 10) / 10), rotationOrigin: '0.5 0.5' } : {});
  const boxart = (pos: string, max: string, z = 32, extra: Record<string, string> = {}) => art('ccs_boxart', pos, max, z, { path: 'firstfile({game:boxart}, {game:thumbnail}, {game:image})', ...round, ...tilt(d.tilt ?? 0), ...extra }, d.anims?.art);
  const framed = (e: DesignEl): DesignEl => ({ ...e, blocks: [frameXml(designFrame(d, K(d, c, 'designAccent'), depthOf(d, c)))] });
  const screenshot = (pos: string, max: string, extra: Record<string, string> = {}) => framed(video ? art('md_video', pos, max, 31, { delay: '0.8', showSnapshotNoVideo: 'true', ...extra }) : art('md_image', pos, max, 31, extra));
  // Full-screen and centred, so a slow zoom (depth) never shows its edges.
  const fanart = (opacityHex: string) => ({ type: 'image', name: 'ccs_fanart', props: { pos: '0.5 0.5', origin: '0.5 0.5', size: '1 1', path: 'firstfile({game:fanart}, {game:image})', color: `FFFFFF${opacityHex}`, zIndex: '1' } }) as DesignEl;
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
    { type: 'rating', name: 'md_rating', props: { pos: `${x} ${y}`, size: `0 ${(step * 0.85).toFixed(3)}`, color: K(d, c, 'designAccent'), unfilledColor: K(d, c, 'designRatingOff'), visible: 'true', zIndex: '40' } } as DesignEl,
    { ...text(d, c, 'md_releasedate', { pos: `${(x + w * 0.42).toFixed(3)} ${y}`, fontSize: '0.024', format: '%Y', zIndex: '40' }, { dim: true, native: true }), type: 'datetime' },
    text(d, c, 'md_genre', { pos: `${x} ${(y + step).toFixed(3)}`, size: `${(w * 0.5).toFixed(3)} 0.03`, fontSize: '0.022', zIndex: '40' }, { dim: true, native: true }),
    text(d, c, 'md_developer', { pos: `${(x + w * 0.5).toFixed(3)} ${(y + step).toFixed(3)}`, size: `${(w * 0.5).toFixed(3)} 0.03`, fontSize: '0.022', zIndex: '40' }, { dim: true, native: true }),
    text(d, c, 'md_players', { pos: `${x} ${(y + step * 2).toFixed(3)}`, size: `${(w * 0.5).toFixed(3)} 0.03`, fontSize: '0.022', zIndex: '40' }, { dim: true, native: true }),
    text(d, c, 'ccs_favorite', { pos: `${(x + w * 0.5).toFixed(3)} ${(y + step * 2).toFixed(3)}`, size: `${(w * 0.5).toFixed(3)} 0.03`, fontSize: '0.022', text: '★ Favourite', color: K(d, c, 'designAccent'), visible: '{game:favorite}', zIndex: '40' }),
  ];
  const desc = (pos: string, size: string, fs = '0.02') => text(d, c, 'md_description', { pos, size, fontSize: fs, lineSpacing: '1.45', verticalAlignment: 'top', zIndex: '40' }, { dim: true, native: true });
  const title = (pos: string, size: string, fs = '0.046', align = 'left') => ({ ...text(d, c, 'ccs_title', { pos, size, fontSize: fs, alignment: align, text: '{game:name}', zIndex: '45', ...tilt((d.tilt ?? 0) / 2) }, { title: true }), anim: d.anims?.title });
  const marquee = (pos: string, max: string, origin = '0 0') => art('md_marquee', pos, max, 46, { origin });

  switch (d.game) {
    case 'cinema':
      els.push(
        fanart('FF'),
        { type: 'image', name: 'ccs_fade', props: { pos: '0 0', size: '1 1', path: `${c.art}/fade.png`, zIndex: '2' } },
        systemLogo('0.97 0.09', '1 0', '0.16 0.06'),
        systemLogoText('0.97 0.09', '1 0', '0.16 0.06'),
        marquee('0.05 0.09', '0.36 0.15'),
        title('0.05 0.26', '0.42 0.06', '0.05'),
        ...details(0.05, 0.34, 0.4),
        desc('0.05 0.46', '0.4 0.16'),
        screenshot('0.15 0.77', '0.2 0.2'),
        boxart('0.34 0.77', '0.1 0.2'),
        panel(d, c, 'ccs_listpanel', '0.65 0.14', '0.32 0.74', 20, K(d, c, 'designListPanel')),
        gameList(d, c, '0.665 0.16', '0.29 0.7'),
      );
      break;
    case 'cover':
      els.push(
        fanart('22'),
        systemLogo('0.04 0.05', '0 0', '0.22 0.07'),
        systemLogoText('0.04 0.05', '0 0', '0.22 0.07'),
        boxart('0.22 0.47', '0.3 0.56'),
        (() => {
          // The reflection hangs straight down from the cover, never tilted.
          const r = boxart('0.22 0.75', '0.3 0.56', 31, { origin: '0.5 0', flipY: 'true', color: 'FFFFFF33' });
          delete r.props.rotation;
          delete r.props.rotationOrigin;
          return { ...r, name: 'ccs_reflection', anim: undefined };
        })(),
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

function systemScreen(d: Design, c: DesignContext, l: SystemLayout): DesignEl[] {
  const p = d.palette;
  const els: DesignEl[] = [...common(d, c, 'system')];
  const consoleArt = (pos: string, max: string): DesignEl => ({
    type: 'image',
    name: 'ccs_console',
    props: {
      pos,
      origin: '0.5 0.5',
      maxSize: max,
      path: c.consoles ? [`${c.consoles}/\${system.theme}.png`, `${c.consoles}/\${system.theme}.svg`] : ['{random:thumbnail}', '{random:image}'],
      zIndex: '20',
    },
    anim: d.anims?.console,
  });
  const logoStyle: DesignEl[] = [
    { type: 'image', name: 'logo', props: c.logos ? { path: [`${c.logos}/\${system.theme}.svg`, `${c.logos}/\${system.theme}.png`] } : {} },
    // Shown in the carousel for systems without a logo picture.
    text(d, c, 'logoText', { fontSize: l.carousel && Number(l.carousel.maxLogoCount) <= 1 ? '0.08' : '0.06', alignment: 'center' }, { title: true, native: true }),
  ];
  const spot = ([pos, size, align, fs]: [string, string, string, string?], name: string, value: string, kind: 'title' | 'dim' | 'accent', defFs: string): DesignEl => {
    // Pixel fonts are very wide: long names like "Super Nintendo Entertainment System" need a smaller size.
    const font = kind === 'title' ? (d.titleFont ?? d.font) : d.font;
    const scale = ['pressstart', 'silkscreen'].includes(font) ? 0.62 : ['orbitron', 'audiowide', 'monoton', 'russo', 'lilita', 'bungee', 'michroma', 'cinzel', 'creepster'].includes(font) ? 0.85 : 1;
    const size0 = Number(fs ?? defFs) * scale;
    const el = text(d, c, name, { pos, size, alignment: align, fontSize: String(Math.round(size0 * 1000) / 1000), text: value, zIndex: '45' }, kind === 'title' ? { title: true } : { dim: kind === 'dim' });
    if (kind === 'accent') el.props.color = K(d, c, 'designAccent');
    return el;
  };

  // A random game's art behind everything, filling the screen (RetroBat's {random:...} bindings).
  els.push({ type: 'image', name: 'ccs_systemart', props: { pos: '0.5 0.5', origin: '0.5 0.5', minSize: '1 1', path: ['{random:fanart}', '{random:image}'], color: `FFFFFF${l.art ?? '2E'}`, zIndex: '1' } });
  if (l.fade) els.push({ type: 'image', name: 'ccs_fade', props: { pos: '0 0', size: '1 1', path: `${c.art}/fade.png`, zIndex: '2' } });
  if (l.band) els.push(panel(d, c, 'ccs_band', l.band[0], l.band[1], 10));
  if (l.arrows) {
    const arrow = (name: string, pos: string, flip: boolean): DesignEl => ({ type: 'image', name, props: { pos, origin: '0.5 0.5', maxSize: '0.045 0.09', path: `${c.art}/arrow.svg`, color: K(d, c, 'designAccent'), ...(flip ? { flipX: 'true' } : {}), zIndex: '42' }, anim: 'pulse' });
    els.push(arrow('ccs_arrow_left', l.arrows[0], true), arrow('ccs_arrow_right', l.arrows[1], false));
  }

  if (l.grid) {
    // Tiles in the design's colours, logos washed out until selected.
    const { corner, margin } = tileGeometry(d);
    const pad = String(margin + 20);
    els.push(
      { type: 'imagegrid', name: 'imagegrid', props: { autoLayoutSelectedZoom: '1.08', animateSelection: 'true', padding: '0.012 0.012 0.012 0.012', scrollLoop: 'false', scrollbarColor: '00000000', zIndex: '30', ...l.grid } },
      // The selected tile gets a ring and glow in the accent colour over a lightly tinted fill.
      { type: 'gridtile', name: 'default', props: { backgroundImage: `${c.art}/tile.svg`, backgroundCornerSize: `${corner} ${corner}`, backgroundColor: K(d, c, 'designTile'), imageColor: 'FFFFFFFF', padding: `${pad} ${pad} ${pad} ${pad}`, selectionMode: 'full', imageSizeMode: 'maxSize' } },
      { type: 'gridtile', name: 'selected', props: { backgroundImage: `${c.art}/tile-selected.svg`, backgroundCornerSize: `${corner} ${corner}`, backgroundColor: K(d, c, 'designAccent'), imageColor: 'FFFFFFFF', padding: `${pad} ${pad} ${pad} ${pad}` } },
      { type: 'text', name: 'gridtile', props: { visible: 'false', size: '0 0' } },
      { type: 'image', name: 'gridtile.image', props: { color: 'FFFFFFAA' } },
      { type: 'image', name: 'gridtile.image:selected', props: { color: 'FFFFFFFF' } },
    );
  } else {
    els.push({
      type: 'carousel',
      name: 'systemcarousel',
      props: { color: '00000000', logoScale: '1.25', minLogoOpacity: '0.45', zIndex: '40', ...l.carousel },
    });
  }
  els.push(
    ...logoStyle,
    spot(l.name, 'ccs_systemname', '{system:fullName}', 'title', '0.052'),
    spot(l.maker, 'ccs_systemmaker', '{system:manufacturer} + "  ·  " + {system:releaseYear}', 'dim', '0.026'),
    spot(l.count, 'ccs_systemcount', "'' + {system:total} + ' games'", 'accent', '0.024'),
    consoleArt(l.console[0], l.console[1]),
    // The design shows the game count itself.
    { type: 'text', name: 'systemInfo', props: { visible: 'false' } },
  );
  return els;
}

const depthOf = (d: Design, c: DesignContext): Depth => c.depth ?? d.depth ?? 'subtle';

/** Elements of a design for one screen. */
export function designElements(d: Design, c: DesignContext, view: string, systemLayoutId = d.system): DesignEl[] {
  if (view === 'system') return withDepth(systemScreen(d, c, systemLayout(systemLayoutId) ?? systemLayout(d.system)!), depthOf(d, c), 'system');
  if (['basic', 'detailed', 'video'].includes(view)) {
    const els = gameScreen(d, c, view);
    for (const n of LABELS_AND_EXTRAS) els.push({ type: n === 'md_lastplayed' ? 'datetime' : 'text', name: n, props: { visible: 'false' } });
    return withDepth(els, depthOf(d, c), 'game');
  }
  return [];
}

/**
 * The selected logo's zoom at another depth. Layouts have their own zoom (a dock's logos grow a
 * lot more than a carousel's), so depth scales it rather than replacing it.
 */
export function depthLogoScale(now: number, from: Depth, to: Depth): string {
  const v = (now / depthLevel(from).logoScale) * depthLevel(to).logoScale;
  return String(Math.round(Math.max(1, v) * 100) / 100);
}

/** Shadows under art, the selected logo's lift and the background's slow zoom for a depth. */
function withDepth(els: DesignEl[], depth: Depth, kind: 'system' | 'game'): DesignEl[] {
  const lv = depthLevel(depth);
  return els.map((e) => {
    if (lv.shadow && e.type === 'image' && SHADOWED[kind].includes(e.name) && Object.keys(e.props).length > 1) return { ...e, blocks: [...(e.blocks ?? []), shadowXml(lv.shadow)] };
    if (e.type === 'carousel') return { ...e, props: { ...e.props, logoScale: depthLogoScale(Number(e.props.logoScale ?? 1.25), 'subtle', depth) } };
    if (lv.parallax && e.name === PARALLAX[kind] && !e.anim) return { ...e, anim: PARALLAX_ANIM };
    return e;
  });
}

/** Markup lines (two-space indented, inside a <view>) for elements, with their animations. */
export function elementsMarkup(els: DesignEl[], extraNames: Set<string>, view: string): string[] {
  const lines: string[] = [];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  for (const e of els) {
    const extra = extraNames.has(e.name) ? ' extra="true"' : '';
    lines.push(`  <${e.type} name="${e.name}"${extra}>`);
    for (const [k, v] of Object.entries(e.props)) for (const one of Array.isArray(v) ? v : [v]) lines.push(`    <${k}>${esc(one)}</${k}>`);
    for (const b of e.blocks ?? []) for (const l of b.split('\n')) lines.push(`    ${l}`);
    const preset = e.anim ? ANIMATIONS.find((a: AnimPreset) => a.id === e.anim) : undefined;
    if (preset) {
      const pos = String(e.props.pos ?? '0 0').split(' ').map(Number) as [number, number];
      for (const l of storyboardXml(preset, pos, 1, 1, screenOf(view)).split('\n')) lines.push(`    ${l}`);
    }
    lines.push(`  </${e.type}>`);
  }
  return lines;
}

/** Names in a design that are the design's own (not RetroBat's), so they get extra="true". */
export function isDesignExtra(name: string): boolean {
  return name.startsWith('ccs_');
}
