import { describe, expect, it } from 'vitest';
import { drawMovingBg, MOVING_BGS, movingFileName } from './movingBg';
import { BUILT_IN_DESIGNS } from './designCatalog';
import { designElements, type DesignContext } from './designs';

/** A drawing surface that writes down everything drawn on it, numbers rounded. */
function recorder() {
  const log: string[] = [];
  const round = (n: number) => Math.round(n * 100) / 100;
  const r = (v: unknown) => (typeof v === 'number' ? round(v) : typeof v === 'string' ? v.replace(/-?\d+\.\d+/g, (x) => String(round(Number(x)))) : v);
  const grad = { addColorStop: (...a: unknown[]) => log.push(`stop ${a.map(r).join(' ')}`) };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_t, k: string) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? (...a: unknown[]) => (log.push(`${k} ${a.map(r).join(' ')}`), grad) : (...a: unknown[]) => log.push(`${k} ${a.map(r).join(' ')}`)),
    set: (_t, k: string, v) => (log.push(`${k}=${typeof v === 'object' ? 'gradient' : r(v)}`), true),
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
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
      // Shooting stars are off at both ends; otherwise every shape is where it began.
      // (Shapes may come in another order; each is drawn the same.)
      expect([...at(1 - 1e-9)].sort()).toEqual([...start].sort());
      expect(at(0.37)).not.toEqual(start);
    });
  }

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
      const v = els.find((e) => e.name === 'ccs_movingbg');
      expect(v?.type, view).toBe('video');
      expect(v?.props.path).toBe(c.movingBg);
      expect(v?.props.audio).toBe('false');
      expect(Number(v?.props.zIndex)).toBeLessThan(Math.min(...els.filter((e) => e.name !== 'ccs_background' && e.name !== 'ccs_movingbg' && e.props.zIndex).map((e) => Number(e.props.zIndex))));
    }
    expect(designElements(BUILT_IN_DESIGNS[0], { ...c, movingBg: null }, 'system').some((e) => e.name === 'ccs_movingbg')).toBe(false);
  });
});
