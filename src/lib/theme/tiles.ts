// Tile styles for image grids (RetroBat's imagegrid): the pictures behind each tile and the
// selected one, drawn in the theme's colours, with spacing and selection settings to match.
//
// RetroBat draws a tile's backgroundImage as a nine-patch (corners kept, edges and middle
// stretched) multiplied by backgroundColor. The styles here bake their colours into the
// pictures and leave backgroundColor white, so they can use light and dark parts (a highlight
// and a shadow) at once. Its SVG renderer has no blur filters, so glows are layered outlines.
// A style's pictures live in _inc/ccs/tiles/<style>/, which is also how the style is recognised.

export interface TileColours {
  /** The tiles' own colour, RRGGBB(AA). */
  tile: string;
  /** The selected tile's colour. */
  accent: string;
  /** Text colour, used for light edges. */
  text: string;
}

export interface TileStyle {
  id: string;
  label: string;
  help: string;
  /** Corner radius of the tile shape, in picture pixels (the picture is 128 × 128). */
  radius: number;
  /** How much the selected tile grows. */
  zoom: number;
  /** Logo opacity on tiles that aren't selected, 0–1. */
  dim: number;
  /** Room round the logo inside the tile, in picture pixels. */
  inset: number;
  draw: (c: TileColours) => { tile: string; selected: string };
}

export const TILE_DIR = '_inc/ccs/tiles';
const S = 128;
const M = 12;

const hex = (c: string) => `#${c.slice(0, 6)}`;
const svg = (body: string, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>\n`;
/** The tile shape grown (positive) or shrunk (negative) by `d` pixels. */
const rect = (r: number, d: number, attrs: string, dy = 0) => {
  const x = M - d;
  const w = S - 2 * x;
  return `<rect x="${x}" y="${x + dy}" width="${w}" height="${w}" rx="${Math.max(0, r + d)}" ${attrs}/>`;
};
/** A soft glow round the shape: rings fading outwards. */
const glow = (r: number, colour: string, strength = 1) =>
  [
    [9, 0.06],
    [7, 0.1],
    [5, 0.16],
    [3, 0.24],
  ]
    .map(([d, o]) => rect(r, d, `fill="none" stroke="${hex(colour)}" stroke-opacity="${(o * strength).toFixed(3)}" stroke-width="3"`))
    .join('');
/** A soft shadow under the shape: copies stepping down and out, fading. */
const shadow = (r: number, depth: number) =>
  [1, 2, 3, 4]
    .map((k) => rect(r, k * 0.8, `fill="#000000" fill-opacity="${(0.16 / k).toFixed(3)}"`, (depth * k) / 4))
    .join('');
const grad = (id: string, top: string, bottom: string, a = 1, b = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hex(top)}" stop-opacity="${a}"/><stop offset="1" stop-color="${hex(bottom)}" stop-opacity="${b}"/></linearGradient>`;

/** Mixes two colours (t = 0 gives a), RRGGBB. */
function mix(a: string, b: string, t: number): string {
  const ch = (c: string, i: number) => parseInt(c.slice(i, i + 2), 16) || 0;
  return [0, 2, 4].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0')).join('');
}

export const TILE_STYLES: TileStyle[] = [
  {
    id: 'classic',
    label: 'Square',
    help: 'Plain tiles with slightly rounded corners; the selected one fills with your accent colour.',
    radius: 8,
    zoom: 1.06,
    dim: 0.7,
    inset: 22,
    draw: (c) => ({
      tile: svg(rect(8, 0, `fill="${hex(c.tile)}" fill-opacity="0.16"`) + rect(8, -1.5, `fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="3"`)),
      selected: svg(glow(8, c.accent, 0.8) + rect(8, 0, `fill="${hex(c.accent)}" fill-opacity="0.9"`) + rect(8, -2.5, `fill="none" stroke="#fff" stroke-opacity="0.9" stroke-width="4"`)),
    }),
  },
  {
    id: 'card',
    label: 'Rounded card',
    help: 'Soft, well-rounded cards with a light top edge, like a modern console home screen.',
    radius: 20,
    zoom: 1.08,
    dim: 0.75,
    inset: 24,
    draw: (c) => ({
      tile: svg(rect(20, 0, `fill="url(#f)"`) + rect(20, -1, `fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="2"`), grad('f', mix(c.tile, 'ffffff', 0.1), c.tile, 0.26, 0.18)),
      selected: svg(glow(20, c.accent) + rect(20, 0, `fill="url(#f)"`) + rect(20, -1, `fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="2"`), grad('f', mix(c.accent, 'ffffff', 0.18), c.accent)),
    }),
  },
  {
    id: 'glass',
    label: 'Glass',
    help: 'Frosted see-through tiles with a bright rim and a shine across the top.',
    radius: 16,
    zoom: 1.07,
    dim: 0.8,
    inset: 24,
    draw: (c) => {
      const shine = `<path d="M${M + 16} ${M + 2}H${S - M - 16}Q${S - M - 2} ${M + 2} ${S - M - 2} ${M + 18}V${S / 2 - 6}Q${S / 2} ${S / 2 + 10} ${M + 2} ${S / 2 - 6}V${M + 18}Q${M + 2} ${M + 2} ${M + 16} ${M + 2}Z" fill="#fff" fill-opacity="0.07"/>`;
      return {
        tile: svg(rect(16, 0, `fill="url(#f)"`) + shine + rect(16, -0.75, `fill="none" stroke="#fff" stroke-opacity="0.32" stroke-width="1.5"`), grad('f', 'ffffff', c.tile, 0.16, 0.06)),
        selected: svg(glow(16, c.accent, 0.9) + rect(16, 0, `fill="url(#f)"`) + shine + rect(16, -1, `fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="2"`), grad('f', mix(c.accent, 'ffffff', 0.35), c.accent, 0.55, 0.32)),
      };
    },
  },
  {
    id: 'outline',
    label: 'Outline',
    help: 'Just a thin border; the selected tile fills in. Clean and light.',
    radius: 12,
    zoom: 1.05,
    dim: 0.6,
    inset: 22,
    draw: (c) => ({
      tile: svg(rect(12, -1, `fill="none" stroke="${hex(c.text)}" stroke-opacity="0.3" stroke-width="2"`)),
      selected: svg(rect(12, 0, `fill="${hex(c.accent)}" fill-opacity="0.22"`) + rect(12, -1.5, `fill="none" stroke="${hex(c.accent)}" stroke-width="3"`)),
    }),
  },
  {
    id: 'neon',
    label: 'Neon glow',
    help: 'Glowing outlines in your accent colour, brightest on the selected tile. Great on dark themes.',
    radius: 14,
    zoom: 1.08,
    dim: 0.65,
    inset: 24,
    draw: (c) => ({
      tile: svg(rect(14, 0, `fill="${hex(c.accent)}" fill-opacity="0.06"`) + rect(14, -1, `fill="none" stroke="${hex(c.accent)}" stroke-opacity="0.45" stroke-width="2"`)),
      selected: svg(glow(14, c.accent, 1.6) + rect(14, 0, `fill="${hex(c.accent)}" fill-opacity="0.16"`) + rect(14, -1.5, `fill="none" stroke="${hex(c.accent)}" stroke-width="3"`) + rect(14, -3.5, `fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="1.5"`)),
    }),
  },
  {
    id: 'raised',
    label: 'Raised 3D',
    help: 'Chunky tiles with a shadow underneath and light from above; the selected one lifts up.',
    radius: 14,
    zoom: 1.12,
    dim: 0.8,
    inset: 24,
    draw: (c) => {
      const body = (col: string, depth: number, id: string) =>
        shadow(14, depth) + rect(14, 0, `fill="url(#${id})"`) + rect(14, -1.5, `fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="2"`) + `<rect x="${M + 14}" y="${M + 2}" width="${S - 2 * M - 28}" height="2" rx="1" fill="#fff" fill-opacity="0.35"/>`;
      return {
        tile: svg(body(c.tile, 6, 'f'), grad('f', mix(c.tile, 'ffffff', 0.12), mix(c.tile, '000000', 0.35), 0.5, 0.5)),
        selected: svg(body(c.accent, 10, 'g'), grad('g', mix(c.accent, 'ffffff', 0.25), mix(c.accent, '000000', 0.25))),
      };
    },
  },
  {
    id: 'bubble',
    label: 'Bubble',
    help: 'Very round, soft tiles. Playful and friendly.',
    radius: 42,
    zoom: 1.1,
    dim: 0.75,
    inset: 30,
    draw: (c) => ({
      tile: svg(rect(42, 0, `fill="url(#f)"`) + `<ellipse cx="${S / 2 - 14}" cy="${M + 20}" rx="22" ry="8" fill="#fff" fill-opacity="0.12"/>`, grad('f', mix(c.tile, 'ffffff', 0.15), c.tile, 0.3, 0.2)),
      selected: svg(glow(42, c.accent) + rect(42, 0, `fill="url(#f)"`) + `<ellipse cx="${S / 2 - 14}" cy="${M + 20}" rx="22" ry="8" fill="#fff" fill-opacity="0.3"/>`, grad('f', mix(c.accent, 'ffffff', 0.2), c.accent)),
    }),
  },
  {
    id: 'floating',
    label: 'Floating',
    help: 'No boxes at all: just the logos, which brighten and grow when selected.',
    radius: 18,
    zoom: 1.18,
    dim: 0.5,
    inset: 18,
    draw: (c) => ({
      tile: svg(''),
      selected: svg(rect(18, 0, `fill="${hex(c.accent)}" fill-opacity="0.12"`) + glow(18, c.accent, 0.7)),
    }),
  },
];

/** Nine-patch corner size for a style: the rounded corner plus the glow margin. */
export const tileCorner = (s: TileStyle) => Math.min(S / 2 - 2, M + s.radius + 6);

/** The pictures of a style, by file name. */
export function tileArt(style: TileStyle, c: TileColours): Record<string, string> {
  const { tile, selected } = style.draw(c);
  return { 'tile.svg': tile, 'tile-selected.svg': selected };
}

/** Which style a grid tile's picture comes from, from its path. */
export function tileStyleOfPath(path: string | undefined): string | null {
  const m = path?.replace(/\\/g, '/').match(/_inc\/ccs\/tiles\/([\w-]+)\/tile(-selected)?\.svg$/i);
  return m && TILE_STYLES.some((s) => s.id === m[1]) ? m[1] : null;
}

/**
 * The properties a style sets: the grid tiles' pictures, corner size and room round the logo,
 * the selected tile's zoom, and how bright logos are.
 */
export function tileStyleProps(style: TileStyle, dir = `./${TILE_DIR}/${style.id}`): Record<string, Record<string, string>> {
  const corner = tileCorner(style);
  const pad = String(style.inset + M);
  const alpha = Math.round(style.dim * 255).toString(16).padStart(2, '0').toUpperCase();
  return {
    imagegrid: { autoLayoutSelectedZoom: String(style.zoom), animateSelection: 'true' },
    default: { backgroundImage: `${dir}/tile.svg`, backgroundCornerSize: `${corner} ${corner}`, backgroundColor: 'FFFFFFFF', padding: `${pad} ${pad} ${pad} ${pad}` },
    selected: { backgroundImage: `${dir}/tile-selected.svg`, backgroundCornerSize: `${corner} ${corner}`, backgroundColor: 'FFFFFFFF', padding: `${pad} ${pad} ${pad} ${pad}` },
    'gridtile.image': { color: `FFFFFF${alpha}` },
    'gridtile.image:selected': { color: 'FFFFFFFF' },
  };
}

/** Colours for tiles from a theme's tile and selected colours (RRGGBBAA as written). */
export function tileColoursFrom(tile: string | undefined, selected: string | undefined, text = 'FFFFFF'): TileColours {
  const ok = (c: string | undefined) => (c && /^[0-9a-f]{6}/i.test(c) ? c.slice(0, 6) : null);
  const t = ok(tile) ?? 'FFFFFF';
  // A selected tile that is plain white (or missing) gets a blue accent so it stands out.
  const s = ok(selected);
  return { tile: t, accent: s && s.toUpperCase() !== 'FFFFFF' ? s : '4C8DFF', text: ok(text) ?? 'FFFFFF' };
}
