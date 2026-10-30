import { describe, expect, it } from 'vitest';
import { FONT_CATALOG, fontName } from './fonts';

describe('fontName', () => {
  it('drops variable-font axis tags from saved catalogue files', () => {
    expect(fontName('_inc/fonts/Inter_opsz_wght_.ttf')).toBe('Inter');
    expect(fontName('_inc/fonts/Orbitron_wght_.ttf')).toBe('Orbitron');
    expect(fontName('_inc/fonts/Fredoka_wdth_wght_.ttf')).toBe('Fredoka');
    expect(fontName('_inc/fonts/Roboto_GRAD_XOPQ_wght_.ttf')).toBe('Roboto');
  });

  it('handles other common file names', () => {
    expect(fontName('C:\\fonts\\Inter[opsz,wght].ttf')).toBe('Inter');
    expect(fontName('Inter-VariableFont_opsz,wght.ttf')).toBe('Inter');
    expect(fontName('_inc/fonts/BebasNeue-Regular.ttf')).toBe('Bebas Neue');
    expect(fontName('_inc/fonts/PressStart2P-Regular.ttf')).toBe('Press Start2P');
    expect(fontName('my_font.ttf')).toBe('my font');
  });

  it('gives every catalogue font a name without axis tags', () => {
    for (const f of FONT_CATALOG) expect(fontName(f.file)).not.toMatch(/\b(wght|opsz|wdth)\b/);
  });
});
