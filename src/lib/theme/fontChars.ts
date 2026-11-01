// Which characters a TTF or OTF font has, from its cmap table, so Check theme can say when a
// text uses one the font lacks (#26). RetroBat then borrows it from one of its own fonts.

/**
 * The fonts in RetroBat's resources folder it borrows a character from when a theme's font
 * lacks it, in the order it tries them (Font.cpp, getFallbackFontPaths). When none has it,
 * RetroBat draws the font's empty box.
 */
export const RETROBAT_FALLBACK_FONTS = ['fontawesome-webfont.ttf', 'DroidSansFallbackFull.ttf', 'PyeojinGothic-Medium.ttf', 'Vazirmatn-Regular.ttf', 'Rubik-Regular.ttf'];

/** Whether the font has a character (by code point). */
export type HasChar = (cp: number) => boolean;

/** A font file's character check, or null if it can't be read as a TTF/OTF font. */
export function fontChars(buf: ArrayBuffer): HasChar | null {
  try {
    const v = new DataView(buf);
    let base = 0;
    // A collection (.ttc): its first font.
    if (v.getUint32(0) === 0x74746366) base = v.getUint32(12);
    const tables = v.getUint16(base + 4);
    let cmap = -1;
    for (let i = 0; i < tables; i++) {
      const rec = base + 12 + i * 16;
      if (v.getUint32(rec) === 0x636d6170) cmap = v.getUint32(rec + 8);
    }
    if (cmap < 0) return null;
    // Best subtable: full Unicode (format 12) first, then the basic plane (format 4).
    const subs: { rank: number; at: number }[] = [];
    for (let i = 0, n = v.getUint16(cmap + 2); i < n; i++) {
      const rec = cmap + 4 + i * 8;
      const platform = v.getUint16(rec);
      const encoding = v.getUint16(rec + 2);
      const at = cmap + v.getUint32(rec + 4);
      const format = v.getUint16(at);
      const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
      if (!unicode || (format !== 4 && format !== 12)) continue;
      subs.push({ rank: format === 12 ? 0 : 1, at });
    }
    subs.sort((a, b) => a.rank - b.rank);
    const best = subs[0];
    if (!best) return null;
    return v.getUint16(best.at) === 12 ? format12(v, best.at) : format4(v, best.at);
  } catch {
    return null;
  }
}

function format12(v: DataView, at: number): HasChar {
  const groups: [number, number, number][] = [];
  for (let i = 0, n = v.getUint32(at + 12); i < n; i++) {
    const g = at + 16 + i * 12;
    groups.push([v.getUint32(g), v.getUint32(g + 4), v.getUint32(g + 8)]);
  }
  return (cp) => groups.some(([s, e, glyph]) => cp >= s && cp <= e && glyph + (cp - s) !== 0);
}

function format4(v: DataView, at: number): HasChar {
  const seg = v.getUint16(at + 6) / 2;
  const ends = at + 14;
  const starts = ends + seg * 2 + 2;
  const deltas = starts + seg * 2;
  const ranges = deltas + seg * 2;
  return (cp) => {
    if (cp > 0xffff) return false;
    for (let i = 0; i < seg; i++) {
      if (cp > v.getUint16(ends + i * 2)) continue;
      const start = v.getUint16(starts + i * 2);
      if (cp < start) return false;
      const delta = v.getInt16(deltas + i * 2);
      const range = v.getUint16(ranges + i * 2);
      if (!range) return ((cp + delta) & 0xffff) !== 0;
      const g = v.getUint16(ranges + i * 2 + range + (cp - start) * 2);
      return g !== 0 && ((g + delta) & 0xffff) !== 0;
    }
    return false;
  };
}
