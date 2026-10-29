import { describe, expect, it } from 'vitest';
import { DEFAULT_LOGO, LOGO_COLOURS, logoSvg, logoUrl } from './logo';

describe('logo colours', () => {
  it('recolours only the gradient of the logo', () => {
    const svg = logoSvg('sunset');
    for (const c of LOGO_COLOURS.sunset.stops) expect(svg).toContain(`stop-color="${c}"`);
    for (const c of LOGO_COLOURS.aurora.stops) expect(svg).not.toContain(c);
    // the brush strokes are untouched
    expect(svg.replace(/<linearGradient[\s\S]*?<\/linearGradient>/, '')).toBe(logoSvg('ocean').replace(/<linearGradient[\s\S]*?<\/linearGradient>/, ''));
  });

  it('falls back to the built-in colour for an unknown one', () => {
    expect(logoSvg('nope')).toBe(logoSvg(DEFAULT_LOGO));
    expect(logoUrl('nope')).toMatch(/^data:image\/svg\+xml/);
  });
});
