import { describe, expect, it } from 'vitest';
import { drawMovingBg, MOVING_BGS, MOVING_GROUPS, movingFileName, movingIdOf } from './movingBg';
import { BUILT_IN_DESIGNS } from './designCatalog';
import { backgroundName, designElements, movingBgName, type DesignContext } from './designs';

/** A drawing surface that writes down everything drawn on it. */
function recorder() {
  const log: string[] = [];
  const v = (x: unknown) => (typeof x === 'object' ? 'gradient' : String(x));
  const grad = { addColorStop: (...a: unknown[]) => log.push(`stop ${a.map(v).join(' ')}`) };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_t, k: string) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? (...a: unknown[]) => (log.push(`${k} ${a.map(v).join(' ')}`), grad) : (...a: unknown[]) => log.push(`${k} ${a.map(v).join(' ')}`)),
    set: (_t, k: string, x) => (log.push(`${k}=${v(x)}`), true),
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

/**
 * Whether two drawings are the same, in any order, allowing for the tiny differences in the last
 * decimals that sums of floating point numbers make.
 */
function sameDrawing(a: string[], b: string[]): string | null {
  const num = /-?\d+(?:\.\d+)?(?:e-?\d+)?/g;
  const parse = (l: string) => ({ key: l.replace(num, '#'), nums: (l.match(num) ?? []).map(Number), line: l });
  const order = (x: ReturnType<typeof parse>, y: ReturnType<typeof parse>) => {
    if (x.key !== y.key) return x.key < y.key ? -1 : 1;
    for (let i = 0; i < x.nums.length; i++) {
      const d = Math.round(x.nums[i] * 1e4) - Math.round(y.nums[i] * 1e4);
      if (d) return d;
    }
    return 0;
  };
  const pa = a.map(parse).sort(order);
  const pb = b.map(parse).sort(order);
  if (pa.length !== pb.length) return `${pa.length} vs ${pb.length} drawing steps`;
  for (let i = 0; i < pa.length; i++) {
    if (pa[i].key !== pb[i].key || pa[i].nums.some((n, j) => Math.abs(n - pb[i].nums[j]) > 1e-6)) return `${pa[i].line}  vs  ${pb[i].line}`;
  }
  return null;
}

const palette = BUILT_IN_DESIGNS[0].palette;

describe('moving backgrounds', () => {
  for (const m of MOVING_BGS) {
    it(`${m.label} loops without a jump, and moves in between`, () => {
      const at = (t: number) => {
        const { ctx, log } = recorder();
        drawMovingBg(ctx, m.id, palette, t);
        return log;
      };
      const start = at(0);
      expect(start.length).toBeGreaterThan(10);
      // The end of the loop is drawn exactly like the start. (Shapes may come in another order;
      // each is drawn the same.)
      expect(sameDrawing(at(1), start)).toBeNull();
      expect(at(0.37)).not.toEqual(start);
    });
  }

  it('has about ten scenes in every group, each with its own id', () => {
    expect(new Set(MOVING_BGS.map((m) => m.id)).size).toBe(MOVING_BGS.length);
    for (const g of MOVING_GROUPS) expect(MOVING_BGS.filter((m) => m.group === g.id).length, g.label).toBeGreaterThanOrEqual(8);
    // The four first scenes keep their ids, so themes already using them still work.
    for (const id of ['bokeh', 'stars', 'waves', 'grid']) expect(MOVING_BGS.some((m) => m.id === id)).toBe(true);
  });

  it('tells which scene a video file is, even when ids share a start', () => {
    expect(movingIdOf('stars-abc123.webm')).toBe('stars');
    expect(movingIdOf('./_inc/ccs/moving/starlayers-0f0f0f.webm')).toBe('starlayers');
    expect(movingIdOf('nothing-abc123.webm')).toBeNull();
    expect(movingIdOf('stars.webm')).toBeNull();
  });

  it('names the video after its colours, so new colours make a new video', () => {
    const a = movingFileName('bokeh', palette);
    expect(a).toMatch(/^bokeh-[0-9a-f]{6}\.webm$/);
    expect(movingFileName('bokeh', palette)).toBe(a);
    expect(movingFileName('bokeh', { ...palette, accent: '00FF00' })).not.toBe(a);
  });

  it('puts the video behind everything on every screen of a design', () => {
    const c: DesignContext = { art: './_inc/ccs/x', font: null, titleFont: null, logos: null, consoles: null, movingBg: './_inc/ccs/moving/bokeh-abc123.webm' };
    for (const view of ['system', 'detailed', 'grid']) {
      const els = designElements(BUILT_IN_DESIGNS[0], c, view);
      const v = els.find((e) => e.name === movingBgName(view));
      expect(v?.type, view).toBe('video');
      expect(v?.props.path).toBe(c.movingBg);
      expect(v?.props.audio).toBe('false');
      expect(Number(v?.props.zIndex)).toBeLessThan(Math.min(...els.filter((e) => e.name !== backgroundName(view) && e.name !== movingBgName(view) && e.props.zIndex).map((e) => Number(e.props.zIndex))));
    }
    expect(designElements(BUILT_IN_DESIGNS[0], { ...c, movingBg: null }, 'system').some((e) => e.name === movingBgName('system'))).toBe(false);
    // On the console screen both stay put while the consoles scroll (RetroBat's staticBackground).
    expect(movingBgName('system')).toMatch(/^staticBackground/);
    expect(backgroundName('system')).toMatch(/^staticBackground/);
  });
});
