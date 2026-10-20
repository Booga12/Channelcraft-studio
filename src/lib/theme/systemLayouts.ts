// Layouts of the system screen (the console picker). Each one says where RetroBat's own carousel
// or grid goes and where a design puts the console's name, maker, game count, console picture
// and the band behind the logos. Plain layout presets and every design use this same table, so
// any design can be shown with any layout.

import type { Rect } from './presets';

type Props = Record<string, string>;
type Align = 'left' | 'center' | 'right';
/** pos, size, alignment, optional font size */
type TextSpot = [string, string, Align, string?];

export interface SystemLayout {
  id: string;
  label: string;
  description: string;
  /** Mini picture of the layout, in screen fractions. */
  diagram: Rect[];
  /** RetroBat carousel properties (type, pos, size, logoSize, maxLogoCount, wheel settings...). */
  carousel?: Props;
  /** RetroBat imagegrid properties, for layouts that show consoles as tiles. */
  grid?: Props;
  /** Where the plain preset puts RetroBat's "N games available" line. */
  info: [string, string, Align];
  /** Panel behind the logos, in designs. */
  band?: [string, string];
  name: TextSpot;
  maker: TextSpot;
  count: TextSpot;
  /** Console picture: pos (centre) and max size. */
  console: [string, string];
  /** Opacity (hex) of the random game art behind everything, in designs. */
  art?: string;
  /** Darkens the left and bottom so text stays readable over strong art. */
  fade?: boolean;
}

/** Diagram cells for a grid. */
function cells(x: number, y: number, w: number, h: number, cols: number, rows: number): Rect[] {
  const out: Rect[] = [];
  const gw = w / cols;
  const gh = h / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: x + c * gw + gw * 0.06, y: y + r * gh + gh * 0.08, w: gw * 0.88, h: gh * 0.84, role: r === 0 && c === 0 ? 'carousel' : 'art' });
  return out;
}

/** Diagram logos along an arc (for the wheel layouts). */
function arc(cx: number, cy: number, r: number, from: number, to: number, n: number, w: number, h: number): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
    out.push({ x: cx + Math.cos(a) * r - w / 2, y: cy + Math.sin(a) * r - h / 2, w, h, role: i === Math.floor(n / 2) ? 'carousel' : 'art' });
  }
  return out;
}

const info = (x: number, y: number, w = 0.4): Rect => ({ x, y, w, h: 0.045, role: 'info' });
const pic = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h, role: 'logo' });

export const SYSTEM_LAYOUTS: SystemLayout[] = [
  {
    id: 'carousel-middle',
    label: 'Carousel in the middle',
    description: 'Three big console logos across the middle, the classic RetroBat look.',
    diagram: [pic(0.38, 0.08, 0.24, 0.24), { x: 0, y: 0.38, w: 1, h: 0.24, role: 'carousel' }, info(0.3, 0.66)],
    carousel: { type: 'horizontal', pos: '0 0.38', size: '1 0.24', logoSize: '0.22 0.15', maxLogoCount: '3' },
    info: ['0 0.64', '1 0.05', 'center'],
    band: ['0 0.37', '1 0.26'],
    name: ['0.1 0.66', '0.8 0.07', 'center'],
    maker: ['0.1 0.73', '0.8 0.04', 'center'],
    count: ['0.1 0.775', '0.8 0.04', 'center'],
    console: ['0.5 0.19', '0.3 0.26'],
  },
  {
    id: 'wheel-right',
    label: 'Wheel on the right',
    description: 'Console logos curve down the right side on a wheel, like an arcade cabinet.',
    diagram: [...arc(1.45, 0.5, 0.82, 150, 210, 5, 0.22, 0.1), pic(0.12, 0.2, 0.36, 0.44), info(0.05, 0.84)],
    carousel: { type: 'vertical_wheel', pos: '0.6 0', size: '0.4 1', logoSize: '0.24 0.11', maxLogoCount: '5', logoRotation: '-7', logoRotationOrigin: '4 0.5' },
    info: ['0.04 0.88', '0.5 0.05', 'left'],
    band: ['0.6 0', '0.4 1'],
    name: ['0.05 0.76', '0.5 0.07', 'left'],
    maker: ['0.05 0.83', '0.5 0.04', 'left'],
    count: ['0.05 0.875', '0.5 0.04', 'left'],
    console: ['0.3 0.42', '0.44 0.46'],
  },
  {
    id: 'wheel-left',
    label: 'Wheel on the left',
    description: 'The arcade-cabinet wheel, curving down the left side instead.',
    diagram: [...arc(-0.45, 0.5, 0.82, -30, 30, 5, 0.22, 0.1), pic(0.52, 0.2, 0.36, 0.44), info(0.55, 0.84)],
    carousel: { type: 'vertical_wheel', pos: '0 0', size: '0.4 1', logoSize: '0.24 0.11', maxLogoCount: '5', logoRotation: '7', logoRotationOrigin: '-3 0.5' },
    info: ['0.46 0.88', '0.5 0.05', 'right'],
    band: ['0 0', '0.4 1'],
    name: ['0.46 0.76', '0.5 0.07', 'right'],
    maker: ['0.46 0.83', '0.5 0.04', 'right'],
    count: ['0.46 0.875', '0.5 0.04', 'right'],
    console: ['0.7 0.42', '0.44 0.46'],
  },
  {
    id: 'carousel-bottom',
    label: 'Carousel at the bottom',
    description: 'A strip of logos along the bottom, with a big console picture above.',
    diagram: [pic(0.3, 0.12, 0.4, 0.44), { x: 0, y: 0.72, w: 1, h: 0.2, role: 'carousel' }, info(0.3, 0.6)],
    carousel: { type: 'horizontal', pos: '0 0.73', size: '1 0.2', logoSize: '0.16 0.11', maxLogoCount: '5' },
    info: ['0 0.93', '1 0.04', 'center'],
    band: ['0 0.72', '1 0.22'],
    name: ['0.1 0.6', '0.8 0.07', 'center'],
    maker: ['0.1 0.665', '0.8 0.04', 'center'],
    count: ['0.1 0.94', '0.8 0.03', 'center'],
    console: ['0.5 0.34', '0.5 0.44'],
  },
  {
    id: 'carousel-top',
    label: 'Carousel at the top',
    description: 'Logos across the top, the console picture and its details filling the screen below.',
    diagram: [{ x: 0, y: 0.06, w: 1, h: 0.2, role: 'carousel' }, pic(0.1, 0.4, 0.4, 0.44), info(0.56, 0.52, 0.36)],
    carousel: { type: 'horizontal', pos: '0 0.06', size: '1 0.2', logoSize: '0.16 0.11', maxLogoCount: '5' },
    info: ['0 0.28', '1 0.04', 'center'],
    band: ['0 0.05', '1 0.22'],
    name: ['0.56 0.5', '0.4 0.07', 'left'],
    maker: ['0.56 0.57', '0.4 0.04', 'left'],
    count: ['0.56 0.615', '0.4 0.04', 'left'],
    console: ['0.3 0.62', '0.42 0.46'],
  },
  {
    id: 'cover-flow',
    label: 'Cover flow',
    description: 'Five big logos in a row, the selected one zoomed and the others faded.',
    diagram: [pic(0.4, 0.06, 0.2, 0.2), { x: 0, y: 0.32, w: 1, h: 0.36, role: 'carousel' }, info(0.3, 0.74)],
    carousel: { type: 'horizontal', pos: '0 0.32', size: '1 0.36', logoSize: '0.18 0.18', maxLogoCount: '5', logoScale: '1.5', minLogoOpacity: '0.3' },
    info: ['0 0.72', '1 0.05', 'center'],
    name: ['0.1 0.72', '0.8 0.07', 'center'],
    maker: ['0.1 0.79', '0.8 0.04', 'center'],
    count: ['0.1 0.835', '0.8 0.04', 'center'],
    console: ['0.5 0.16', '0.24 0.2'],
  },
  {
    id: 'spotlight',
    label: 'Spotlight',
    description: 'One huge logo in the centre of the stage. Scroll to bring the next console into the light.',
    diagram: [pic(0.42, 0.1, 0.16, 0.18), { x: 0.25, y: 0.36, w: 0.5, h: 0.3, role: 'carousel' }, info(0.3, 0.72)],
    carousel: { type: 'horizontal', pos: '0.25 0.36', size: '0.5 0.3', logoSize: '0.38 0.24', maxLogoCount: '1', logoScale: '1.1' },
    info: ['0 0.7', '1 0.05', 'center'],
    band: ['0.22 0.34', '0.56 0.34'],
    name: ['0.1 0.71', '0.8 0.07', 'center'],
    maker: ['0.1 0.78', '0.8 0.04', 'center'],
    count: ['0.1 0.825', '0.8 0.04', 'center'],
    console: ['0.5 0.19', '0.26 0.24'],
    art: '40',
  },
  {
    id: 'arc-bottom',
    label: 'Arch',
    description: 'Logos fan out in an arch along the bottom, the selected one on top.',
    diagram: [pic(0.32, 0.12, 0.36, 0.34), ...arc(0.5, 1.7, 1.12, -110, -70, 5, 0.15, 0.1), info(0.05, 0.06)],
    carousel: { type: 'horizontal_wheel', pos: '0 0.52', size: '1 0.48', logoSize: '0.18 0.13', maxLogoCount: '5', logoRotation: '20', logoRotationOrigin: '0.5 8', logoAlignment: 'top' },
    info: ['0.05 0.06', '0.6 0.05', 'left'],
    name: ['0.05 0.06', '0.6 0.07', 'left'],
    maker: ['0.05 0.13', '0.6 0.04', 'left'],
    count: ['0.55 0.08', '0.4 0.04', 'right'],
    console: ['0.5 0.31', '0.36 0.34'],
  },
  {
    id: 'arc-top',
    label: 'Hanging arc',
    description: 'Logos hang in a smile-shaped curve across the top, details and console picture below.',
    diagram: [...arc(0.5, -0.9, 1.12, 110, 70, 5, 0.15, 0.1), pic(0.56, 0.5, 0.36, 0.4), info(0.06, 0.6)],
    carousel: { type: 'horizontal_wheel', pos: '0 0', size: '1 0.46', logoSize: '0.18 0.13', maxLogoCount: '5', logoRotation: '-20', logoRotationOrigin: '0.5 -7', logoAlignment: 'bottom' },
    info: ['0.06 0.6', '0.5 0.05', 'left'],
    name: ['0.06 0.6', '0.46 0.07', 'left'],
    maker: ['0.06 0.67', '0.46 0.04', 'left'],
    count: ['0.06 0.715', '0.46 0.04', 'left'],
    console: ['0.74 0.71', '0.36 0.38'],
  },
  {
    id: 'list-left',
    label: 'Logo list on the left',
    description: 'A straight column of console logos down the left side.',
    diagram: [{ x: 0, y: 0, w: 0.3, h: 1, role: 'carousel' }, pic(0.45, 0.15, 0.4, 0.5), info(0.36, 0.86)],
    carousel: { type: 'vertical', pos: '0 0', size: '0.3 1', logoSize: '0.24 0.1', maxLogoCount: '7' },
    info: ['0.36 0.9', '0.6 0.05', 'left'],
    band: ['0 0', '0.3 1'],
    name: ['0.36 0.74', '0.6 0.07', 'left'],
    maker: ['0.36 0.81', '0.6 0.04', 'left'],
    count: ['0.36 0.855', '0.6 0.04', 'left'],
    console: ['0.65 0.4', '0.5 0.5'],
  },
  {
    id: 'list-right',
    label: 'Logo list on the right',
    description: 'A straight column of logos down the right side, a big console picture on the left.',
    diagram: [{ x: 0.7, y: 0, w: 0.3, h: 1, role: 'carousel' }, pic(0.15, 0.15, 0.4, 0.5), info(0.04, 0.86)],
    carousel: { type: 'vertical', pos: '0.7 0', size: '0.3 1', logoSize: '0.24 0.1', maxLogoCount: '7' },
    info: ['0.04 0.9', '0.6 0.05', 'left'],
    band: ['0.7 0', '0.3 1'],
    name: ['0.04 0.74', '0.62 0.07', 'left'],
    maker: ['0.04 0.81', '0.62 0.04', 'left'],
    count: ['0.04 0.855', '0.62 0.04', 'left'],
    console: ['0.35 0.4', '0.5 0.5'],
  },
  {
    id: 'channel-grid',
    label: 'Channel grid',
    description: 'Consoles as a 4 × 3 grid of rounded tiles, like a classic console home screen.',
    diagram: [...cells(0.075, 0.08, 0.85, 0.56, 4, 3), info(0.075, 0.7)],
    grid: { pos: '0.075 0.08', size: '0.85 0.56', autoLayout: '4 3', margin: '0.014 0.028', scrollDirection: 'vertical', centerSelection: 'false' },
    info: ['0 0.7', '1 0.05', 'center'],
    name: ['0.075 0.69', '0.6 0.07', 'left'],
    maker: ['0.075 0.76', '0.6 0.04', 'left'],
    count: ['0.075 0.8', '0.6 0.04', 'left'],
    console: ['0.84 0.78', '0.22 0.24'],
  },
  {
    id: 'grid-shelf',
    label: 'Two-row shelf',
    description: 'Two rows of wide tiles in the middle, the console name above them.',
    diagram: [...cells(0.06, 0.24, 0.88, 0.5, 5, 2), info(0.06, 0.08)],
    grid: { pos: '0.06 0.24', size: '0.88 0.5', autoLayout: '5 2', margin: '0.012 0.026', scrollDirection: 'horizontal', centerSelection: 'false' },
    info: ['0.06 0.8', '0.6 0.05', 'left'],
    name: ['0.06 0.07', '0.7 0.08', 'left', '0.056'],
    maker: ['0.06 0.15', '0.7 0.04', 'left'],
    count: ['0.06 0.79', '0.6 0.04', 'left'],
    console: ['0.88 0.85', '0.16 0.18'],
  },
  {
    id: 'grid-wall',
    label: 'Grid wall',
    description: 'Lots of small tiles filling the screen, to see many consoles at once.',
    diagram: [...cells(0.04, 0.05, 0.92, 0.8, 6, 4), info(0.04, 0.88)],
    grid: { pos: '0.04 0.05', size: '0.92 0.8', autoLayout: '6 4', margin: '0.008 0.014', scrollDirection: 'vertical', centerSelection: 'false' },
    info: ['0 0.89', '1 0.04', 'center'],
    name: ['0.04 0.865', '0.5 0.055', 'left', '0.04'],
    maker: ['0.04 0.915', '0.5 0.035', 'left'],
    count: ['0.5 0.875', '0.36 0.04', 'right'],
    console: ['0.93 0.9', '0.08 0.1'],
  },
  {
    id: 'tile-row',
    label: 'Dashboard row',
    description: 'A row of tiles across the top like a modern console dashboard, with big artwork below.',
    diagram: [...cells(0.04, 0.1, 0.92, 0.2, 7, 1), pic(0.62, 0.45, 0.32, 0.4), info(0.05, 0.62)],
    grid: { pos: '0.04 0.1', size: '0.92 0.2', autoLayout: '7 1', margin: '0.01 0', scrollDirection: 'horizontal', centerSelection: 'false' },
    info: ['0.05 0.72', '0.9 0.05', 'left'],
    name: ['0.05 0.6', '0.66 0.08', 'left'],
    maker: ['0.05 0.68', '0.6 0.04', 'left'],
    count: ['0.05 0.725', '0.6 0.04', 'left'],
    console: ['0.78 0.64', '0.34 0.42'],
    art: 'B3',
    fade: true,
  },
  {
    id: 'big-tiles',
    label: 'Big tiles',
    description: 'Five large tiles across the middle, the selected one in the centre. A modern handheld feel.',
    diagram: [...cells(0.04, 0.3, 0.92, 0.36, 5, 1), info(0.3, 0.12)],
    grid: { pos: '0.04 0.3', size: '0.92 0.36', autoLayout: '5 1', margin: '0.016 0', scrollDirection: 'horizontal', centerSelection: 'true', autoLayoutSelectedZoom: '1.12' },
    info: ['0 0.72', '1 0.05', 'center'],
    name: ['0.1 0.1', '0.8 0.08', 'center', '0.06'],
    maker: ['0.1 0.19', '0.8 0.04', 'center'],
    count: ['0.1 0.72', '0.8 0.04', 'center'],
    console: ['0.5 0.84', '0.2 0.16'],
  },
];

export function systemLayout(id: string): SystemLayout | undefined {
  return SYSTEM_LAYOUTS.find((l) => l.id === id);
}
