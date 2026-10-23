import { describe, expect, it } from 'vitest';
import { TILE_STYLES, tileArt, tileCorner, tileStyleOfPath, tileStyleProps, tileColoursFrom } from './tiles';

const c = { tile: 'F5F5F7', accent: 'E8433A', text: 'F5F5F7' };

describe('tile styles', () => {
  it('draw both pictures as SVG RetroBat can read (no filters or patterns)', () => {
    for (const s of TILE_STYLES) {
      const art = tileArt(s, c);
      for (const f of ['tile.svg', 'tile-selected.svg']) {
        expect(art[f]).toMatch(/^<svg [^>]*width="128" height="128"/);
        expect(art[f]).not.toMatch(/<filter|<pattern|NaN|undefined/);
      }
      expect(tileCorner(s)).toBeLessThan(64);
    }
  });

  it('are recognised from their pictures', () => {
    for (const s of TILE_STYLES) {
      const props = tileStyleProps(s);
      expect(tileStyleOfPath(props.default.backgroundImage)).toBe(s.id);
      expect(tileStyleOfPath(props.selected.backgroundImage)).toBe(s.id);
      expect(props['gridtile.image'].color).toMatch(/^FFFFFF[0-9A-F]{2}$/);
    }
    expect(tileStyleOfPath('./_inc/ccs/cinema/tile.svg')).toBeNull();
  });

  it('use the selected colour unless it is plain white', () => {
    expect(tileColoursFrom('FFFFFF22', 'E8433AFF').accent).toBe('E8433A');
    expect(tileColoursFrom('FFFFFF22', 'FFFFFFF2').accent).toBe('4C8DFF');
  });
});
