import { describe, expect, it } from 'vitest';
import { countLines } from './textFit';

const box = (top: number, height: number, width = 40) => ({ top, bottom: top + height, width });

describe('countLines', () => {
  it('counts one line of text as one line', () => {
    expect(countLines([box(100, 20)])).toBe(1);
    // Several fragments on one line (words, or text nodes side by side).
    expect(countLines([box(100, 20), box(100, 20), box(100.4, 19.6)])).toBe(1);
  });

  it("doesn't count the element's own box: the old count gave 2 here", () => {
    // What the preview gave for "PLAY ▶" in a boxed text: the span's line-height box (taller,
    // higher) and the glyph box inside it. Only text-node boxes are passed now, but even both
    // together are one line.
    expect(countLines([box(95, 30), box(100, 20)])).toBe(1);
  });

  it('keeps a glyph from a fallback font on the same line', () => {
    // ▶ from Segoe UI sits a few pixels higher than the VT323 letters.
    expect(countLines([box(100, 20), box(96, 24, 18)])).toBe(1);
  });

  it('counts wrapped lines, even with tight line spacing', () => {
    expect(countLines([box(100, 20), box(130, 20), box(160, 20)])).toBe(3);
    // Line spacing 0.8: the boxes overlap a little but each line's middle is below the last.
    expect(countLines([box(100, 20), box(116, 20)])).toBe(2);
  });

  it('ignores empty boxes and says 1 for no text', () => {
    expect(countLines([])).toBe(1);
    expect(countLines([box(100, 20, 0), box(140, 20)])).toBe(1);
  });
});
