import { describe, expect, it } from 'vitest';
import { fontChars } from './fontChars';

/** A minimal font file holding only a cmap table with one subtable. */
function font(sub: number[], platform = 3, encoding = 1): ArrayBuffer {
  const cmap = [0, 0, 0, 1, ...u16(platform), ...u16(encoding), ...u32(12), ...sub];
  const head = [...u32(0x00010000), ...u16(1), 0, 0, 0, 0, 0, 0];
  const rec = [...[0x63, 0x6d, 0x61, 0x70], ...u32(0), ...u32(head.length + 16), ...u32(cmap.length)];
  return new Uint8Array([...head, ...rec, ...cmap]).buffer;
}
function u16(n: number) {
  return [(n >> 8) & 255, n & 255];
}
function u32(n: number) {
  return [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Format 4: segments [start, end, delta]; the last must end at 0xFFFF. */
function format4(segs: [number, number, number][]): number[] {
  const n = segs.length;
  return [
    ...u16(4), ...u16(0), ...u16(0), ...u16(n * 2), 0, 0, 0, 0, 0, 0,
    ...segs.flatMap(([, e]) => u16(e)), 0, 0,
    ...segs.flatMap(([s]) => u16(s)),
    ...segs.flatMap(([, , d]) => u16(d & 0xffff)),
    ...segs.flatMap(() => u16(0)),
  ];
}

describe('which characters a font has (#26)', () => {
  it('reads the basic plane (format 4)', () => {
    // A–Z mapped to glyphs 1–26; the closing segment maps to glyph 0 (none).
    const has = fontChars(font(format4([[0x41, 0x5a, 1 - 0x41], [0xffff, 0xffff, 1]])))!;
    expect(has('A'.codePointAt(0)!)).toBe(true);
    expect(has('Z'.codePointAt(0)!)).toBe(true);
    expect(has('a'.codePointAt(0)!)).toBe(false);
    expect(has('▶'.codePointAt(0)!)).toBe(false);
  });

  it('reads full Unicode (format 12), past the basic plane', () => {
    const groups = [[0x41, 0x41, 1], [0x2605, 0x2605, 2], [0x1f600, 0x1f600, 3]];
    const sub = [...u16(12), ...u16(0), ...u32(16 + groups.length * 12), ...u32(0), ...u32(groups.length), ...groups.flatMap((g) => g.flatMap(u32))];
    const has = fontChars(font(sub, 3, 10))!;
    expect(['A', '★', '😀'].map((c) => has(c.codePointAt(0)!))).toEqual([true, true, true]);
    expect(has('▶'.codePointAt(0)!)).toBe(false);
  });

  it("says null for a file that isn't a font", () => {
    expect(fontChars(new TextEncoder().encode('<svg/>').buffer)).toBeNull();
  });
});
