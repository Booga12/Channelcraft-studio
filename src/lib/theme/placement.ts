// Where a newly added element goes: on top of everything on the screen, in the emptiest spot
// (issue #20: new parts used to land in the middle of the info panel, behind the design's art).
import type { ResolvedElement } from './resolver';
import { fmtNum, parsePair } from './schema';

/** A box in screen fractions (0..1), top-left corner and size. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MARGIN = 0.03;
const STEP = 0.025;

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * The top-left corner for a `w` × `h` box that covers the least of `taken`, trying spots on a
 * small grid inside the screen's margins. Of equally empty spots, the one nearest the middle.
 */
export function freeSpot(taken: Rect[], w: number, h: number): [number, number] {
  const maxX = Math.max(MARGIN, 1 - MARGIN - w);
  const maxY = Math.max(MARGIN, 1 - MARGIN - h);
  let best: [number, number] = [Math.min(maxX, Math.max(MARGIN, 0.5 - w / 2)), Math.min(maxY, Math.max(MARGIN, 0.5 - h / 2))];
  let bestScore = Infinity;
  for (let y = MARGIN; y <= maxY + 1e-9; y += STEP) {
    for (let x = MARGIN; x <= maxX + 1e-9; x += STEP) {
      const r = { x, y, w, h };
      const covered = taken.reduce((s, t) => s + overlap(r, t), 0);
      const dist = Math.hypot(x + w / 2 - 0.5, y + h / 2 - 0.5);
      // Covering things counts far more than being off-centre.
      const score = covered * 1000 + dist;
      if (score < bestScore - 1e-12) {
        bestScore = score;
        best = [x, y];
      }
    }
  }
  return [Math.round(best[0] * 1000) / 1000, Math.round(best[1] * 1000) / 1000];
}

const hidden = (el: ResolvedElement) => /^(false|0)$/i.test(el.props.get('visible')?.value?.trim() ?? '');

/** The boxes of the visible elements with a size, in screen fractions. Full-screen ones (the
 * background) don't count: everything goes over them. */
export function takenBoxes(elements: Iterable<ResolvedElement>): Rect[] {
  const out: Rect[] = [];
  for (const el of elements) {
    if (hidden(el)) continue;
    const pos = parsePair(el.props.get('pos')?.value);
    const size = parsePair(el.props.get('size')?.value) ?? parsePair(el.props.get('maxSize')?.value);
    if (!pos || !size || size[0] <= 0 || size[1] <= 0) continue;
    if (size[0] >= 0.9 && size[1] >= 0.9) continue;
    const origin = parsePair(el.props.get('origin')?.value) ?? [0, 0];
    out.push({ x: pos[0] - origin[0] * size[0], y: pos[1] - origin[1] * size[1], w: size[0], h: size[1] });
  }
  return out;
}

/** One above the highest zIndex on the screen (at least 15, the old starting layer). */
export function topZ(elements: Iterable<ResolvedElement>): number {
  let max = 14;
  for (const el of elements) {
    const z = parseFloat(el.props.get('zIndex')?.value ?? '');
    if (Number.isFinite(z)) max = Math.max(max, z);
  }
  return Math.floor(max) + 1;
}

/**
 * A new element's starting XML (STARTER_PROPS) placed for this screen: its <pos> moved to the
 * emptiest spot (unless `keepPos`, for the clock's usual corner) and its <zIndex> set on top.
 */
export function placeNew(body: string, elements: ResolvedElement[], keepPos = false): string {
  const size = parsePair(/<size>([^<]*)<\/size>/.exec(body)?.[1]) ?? [0.2, 0.2];
  let out = body;
  if (!keepPos && /<pos>/.test(out)) {
    const [x, y] = freeSpot(takenBoxes(elements), size[0], size[1]);
    out = out.replace(/<pos>[^<]*<\/pos>/, `<pos>${fmtNum(x)} ${fmtNum(y)}</pos>`);
  }
  const z = `<zIndex>${topZ(elements)}</zIndex>`;
  out = /<zIndex>/.test(out) ? out.replace(/<zIndex>[^<]*<\/zIndex>/, z) : `${out}\n${z}`;
  return out;
}
