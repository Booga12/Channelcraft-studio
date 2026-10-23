import { describe, expect, it } from 'vitest';
import { reorder, zIndexFor, type Layer } from './layers';

/** Order after applying the new values (top first), as RetroBat draws it: zIndex, then file order. */
function drawn(layers: Layer[], z: Record<string, number>, fileOrder: string[]): string[] {
  return [...layers]
    .map((l) => ({ name: l.name, z: z[l.name] ?? l.z }))
    .sort((a, b) => b.z - a.z || fileOrder.indexOf(b.name) - fileOrder.indexOf(a.name))
    .map((l) => l.name);
}

function move(layers: Layer[], moving: string[], before: string | null) {
  const order = reorder(layers, moving, before);
  const z = zIndexFor(order, new Set(moving));
  // File order: later in the file draws on top among equals; take the listed order bottom-up.
  const fileOrder = [...layers].reverse().map((l) => l.name);
  return { order: order.map((l) => l.name), got: drawn(layers, z, fileOrder), z };
}

const L = (...p: [string, number][]): Layer[] => p.map(([name, z]) => ({ name, z }));

describe('layer drag and drop', () => {
  it('fits a layer between two others without touching them', () => {
    const r = move(L(['a', 50], ['b', 40], ['c', 30], ['d', 10]), ['d'], 'b');
    expect(r.got).toEqual(r.order);
    expect(Object.keys(r.z)).toEqual(['d']);
    expect(r.z.d).toBeGreaterThan(40);
    expect(r.z.d).toBeLessThan(50);
  });

  it('moves to the very top and the very bottom', () => {
    const layers = L(['a', 50], ['b', 40], ['c', 30]);
    for (const [m, before] of [[['c'], 'a'], [['a'], null], [['b'], null]] as [string[], string | null][]) {
      const r = move(layers, m, before);
      expect(r.got).toEqual(r.order);
    }
  });

  it('works when every layer has the same zIndex', () => {
    const layers = L(['a', 0], ['b', 0], ['c', 0], ['d', 0]);
    for (const [m, before] of [[['d'], 'a'], [['a'], null], [['c'], 'b'], [['a', 'b'], 'd']] as [string[], string | null][]) {
      const r = move(layers, m, before);
      expect(r.got, `${m} before ${before}`).toEqual(r.order);
    }
  });

  it('moves several layers together', () => {
    const r = move(L(['a', 9], ['b', 8], ['c', 7], ['d', 6], ['e', 5]), ['a', 'c'], 'e');
    expect(r.order).toEqual(['b', 'd', 'a', 'c', 'e']);
    expect(r.got).toEqual(r.order);
  });

  it('keeps every order for random stacks', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let t = 0; t < 400; t++) {
      const n = 2 + Math.floor(rnd() * 8);
      const zs = Array.from({ length: n }, () => Math.floor(rnd() * 4) * 10).sort((a, b) => b - a);
      const layers = zs.map((z, i) => ({ name: `l${i}`, z }));
      const pick = layers.filter(() => rnd() < 0.3).map((l) => l.name);
      if (!pick.length) pick.push(layers[Math.floor(rnd() * n)].name);
      const rest = layers.filter((l) => !pick.includes(l.name));
      const before = rnd() < 0.2 || !rest.length ? null : rest[Math.floor(rnd() * rest.length)].name;
      const r = move(layers, pick, before);
      expect(r.got, JSON.stringify({ layers, pick, before })).toEqual(r.order);
    }
  });
});
