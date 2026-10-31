import { describe, expect, it } from 'vitest';
import { elementLabel, knownLabel } from '../friendly';
import { freeSpot, placeNew, takenBoxes, topZ } from './placement';
import type { ResolvedElement } from './resolver';

/** A made-up resolved element with just the props these functions read. */
function el(name: string, props: Record<string, string>): ResolvedElement {
  return { name, type: 'image', extra: 'true', defs: [], props: new Map(Object.entries(props).map(([k, value]) => [k, { value } as never])) } as unknown as ResolvedElement;
}

// The Cover shelf game list, roughly: background, box art on the left, info panel in the
// middle, list on the right, all at layers up to 50.
const screen = [
  el('background', { pos: '0 0', size: '1 1', zIndex: '0' }),
  el('ccs_boxart', { pos: '0.08 0.2', size: '0.24 0.62', zIndex: '45' }),
  el('ccs_infopanel', { pos: '0.36 0.15', size: '0.24 0.72', zIndex: '30' }),
  el('md_gamelist', { pos: '0.64 0.15', size: '0.3 0.72', zIndex: '50' }),
  el('md_logo', { pos: '0.03 0.04', size: '0.25 0.1', zIndex: '50' }),
  el('hiddenThing', { pos: '0.4 0.88', size: '0.2 0.1', visible: 'false', zIndex: '99' }),
];

describe('placing a new element', () => {
  it('goes above the highest layer on the screen', () => {
    expect(topZ(screen)).toBe(100);
    expect(topZ([el('a', { zIndex: '3' })])).toBe(15);
    expect(topZ([])).toBe(15);
  });

  it("ignores the full-screen background and hidden parts when looking for room", () => {
    const boxes = takenBoxes(screen);
    expect(boxes).toHaveLength(4);
    expect(boxes).toContainEqual({ x: 0.08, y: 0.2, w: 0.24, h: 0.62 });
  });

  it('respects origin when working out a box', () => {
    expect(takenBoxes([el('c', { pos: '0.5 0.5', size: '0.2 0.2', origin: '0.5 0.5' })])).toEqual([{ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }]);
  });

  it('lands where nothing is, not on the info panel', () => {
    const [x, y] = freeSpot(takenBoxes(screen), 0.2, 0.05);
    const r = { x, y, w: 0.2, h: 0.05 };
    for (const t of takenBoxes(screen)) {
      const ox = Math.min(r.x + r.w, t.x + t.w) - Math.max(r.x, t.x);
      const oy = Math.min(r.y + r.h, t.y + t.h) - Math.max(r.y, t.y);
      expect(ox <= 1e-9 || oy <= 1e-9, `overlaps ${JSON.stringify(t)} at ${x},${y}`).toBe(true);
    }
    expect(x).toBeGreaterThanOrEqual(0.03);
    expect(y + 0.05).toBeLessThanOrEqual(0.97 + 1e-9);
  });

  it('picks the middle of an empty screen', () => {
    const [x, y] = freeSpot([], 0.2, 0.2);
    expect(Math.abs(x + 0.1 - 0.5)).toBeLessThan(0.03);
    expect(Math.abs(y + 0.1 - 0.5)).toBeLessThan(0.03);
  });

  it('rewrites pos and zIndex in the starting XML, and keeps the clock in its corner', () => {
    const text = '<pos>0.4 0.45</pos>\n<size>0.2 0.05</size>\n<text>New text</text>\n<zIndex>15</zIndex>';
    const out = placeNew(text, screen);
    expect(out).toContain('<zIndex>100</zIndex>');
    expect(out).not.toContain('<pos>0.4 0.45</pos>');
    expect(out).toContain('<text>New text</text>');
    const clock = placeNew('<pos>0.85 0.03</pos>\n<size>0.12 0.05</size>', screen, true);
    expect(clock).toContain('<pos>0.85 0.03</pos>');
    expect(clock).toContain('<zIndex>100</zIndex>');
  });
});

describe('the name "label"', () => {
  it('is the loading text only on loading screens', () => {
    expect(elementLabel('label', 'splash')).toBe('Loading text');
    expect(knownLabel('label', 'splash')).toBe('Loading text');
    expect(elementLabel('label', 'detailed')).toBe('Text');
    expect(knownLabel('label', 'detailed')).toBeUndefined();
    // Without a view, as before.
    expect(elementLabel('label')).toBe('Loading text');
    expect(elementLabel('md_genre', 'detailed')).toBe('Genre');
    // Added parts, numbered.
    expect(elementLabel('text2', 'detailed')).toBe('Text 2');
    expect(elementLabel('panel', 'detailed')).toBe('Panel');
  });
});
