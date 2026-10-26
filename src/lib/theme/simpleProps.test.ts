import { describe, expect, it } from 'vitest';
import { animDemo, cardMatches, delayName, glowOf, glowProps, hex8, resized, sizeName, snapPos, snappedAt, speedName, textKind } from './simpleProps';

describe('what a text says', () => {
  it('knows the sources RetroBat fills in', () => {
    const k = textKind('{system:fullName}');
    expect(k.kind).toBe('source');
    if (k.kind === 'source') expect(k.source.label).toBe('Console name');
    expect(textKind(' {GAME:NAME} ').kind).toBe('source');
  });

  it('tells your own words from what the theme works out', () => {
    expect(textKind('My consoles').kind).toBe('own');
    expect(textKind('{system:total} games').kind).toBe('theme');
    expect(textKind('${myTitle}').kind).toBe('theme');
    expect(textKind('firstfile({game:name})').kind).toBe('theme');
  });

  it('names sizes', () => {
    expect(sizeName(0.04)).toBe('M');
    expect(sizeName(0.0805)).toBe('XL');
    expect(sizeName(0.047)).toBe(null);
  });
});

describe('glow', () => {
  it('reads the glow a text has', () => {
    expect(glowOf(undefined, undefined, undefined)).toBe('none');
    expect(glowOf('FFFFFF80', '2', undefined)).toBe('soft');
    expect(glowOf('FFFFFFCC', '6', '0 0')).toBe('strong');
    expect(glowOf('000000B4', '1', '2 2')).toBe('shadow');
    expect(glowOf('FFFFFF00', '4', undefined)).toBe('none');
  });

  it('writes glows that read back the same', () => {
    for (const g of ['none', 'soft', 'strong', 'shadow'] as const) {
      const p = glowProps(g, 'f2c14eff', true);
      expect(glowOf(p.glowColor ?? 'FFFFFF80', p.glowSize, p.glowOffset)).toBe(g);
    }
    expect(glowProps('soft', 'f2c14eff', false)).toEqual({ glowColor: 'F2C14E80', glowSize: '2' });
  });
});

describe('colours, size and position', () => {
  it('normalises colours', () => {
    expect(hex8('ffcc00')).toBe('FFCC00FF');
    expect(hex8('${x}')).toBe(null);
  });

  it('resizes pictures keeping their shape', () => {
    expect(resized({ w: 0.3, h: 0.2 }, 0.6)).toBe('0.6 0.4');
    expect(resized({ w: 0.3, h: 0 }, 0.5)).toBe('0.5 0');
    expect(resized({ w: 0, h: 0.2 }, 0.4)).toBe('0 0.4');
  });

  it('snaps a box to spots on the screen', () => {
    const rect = { x: 0.3, y: 0.3, w: 0.2, h: 0.1 };
    // pos is the box's centre here (origin 0.5 0.5).
    expect(snapPos(rect, [0.4, 0.35], 'left', 'top')).toEqual([0.14, 0.09]);
    expect(snapPos(rect, [0.4, 0.35], 'center', 'middle')).toEqual([0.5, 0.5]);
    expect(snapPos(rect, [0.4, 0.35], 'right', 'bottom')).toEqual([0.86, 0.91]);
    expect(snappedAt({ x: 0.76, y: 0.86, w: 0.2, h: 0.1 })).toEqual({ x: 'right', y: 'bottom' });
    expect(snappedAt(rect)).toBe(null);
  });
});

describe('animations and finding', () => {
  it('names speeds and delays', () => {
    expect(speedName(1)).toBe('normal');
    expect(speedName(0.5)).toBe('calm');
    expect(speedName(2)).toBe('quick');
    expect(delayName(0)).toBe('now');
    expect(delayName(320)).toBe('later');
  });

  it('picks a sample motion for each kind of animation', () => {
    expect(animDemo('fade-in')).toBe('fade');
    expect(animDemo('slide-left')).toBe('slide');
    expect(animDemo('zoom-bounce')).toBe('pop');
    expect(animDemo('swing-in')).toBe('tilt');
    expect(animDemo('swing')).toBe('sway');
    expect(animDemo('rise-float')).toBe('bob');
  });

  it('finds cards by the words people use', () => {
    expect(cardMatches('colour', 'glow')).toBe(true);
    expect(cardMatches('position', 'front')).toBe(true);
    expect(cardMatches('text', 'glow')).toBe(false);
    expect(cardMatches('more', 'tint', 'tint colour')).toBe(true);
    expect(cardMatches('text', '')).toBe(true);
  });
});
