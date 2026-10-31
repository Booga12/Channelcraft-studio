import { describe, expect, it } from 'vitest';
import { elementLabel, propHelp, propLabel, SIMPLE_PROPS } from './friendly';

describe('plain words for settings', () => {
  it('explains every setting Simple mode shows ("What\'s this?")', () => {
    const missing = [...SIMPLE_PROPS].filter((p) => !propHelp(p));
    expect(missing).toEqual([]);
  });

  it('gives each one a name that is not its code name', () => {
    for (const p of SIMPLE_PROPS) expect(propLabel(p), p).not.toBe(p);
  });

  it('names RetroBat’s detail labels in plain words', () => {
    expect(elementLabel('md_lbl_genre')).toBe('Genre label');
    expect(elementLabel('md_lbl_developer')).toBe('Developer label');
    expect(elementLabel('md_lbl_players')).toBe('Players label');
  });
});

describe('plain names for the parts designs add (#35)', () => {
  it('names every design part and its shadow', () => {
    expect(elementLabel('ccs_listpanel_shadow')).toBe('Game list panel shadow');
    expect(elementLabel('ccs_infopanel_shadow')).toBe('Info panel shadow');
    expect(elementLabel('ccs_deco')).toBe('Decoration');
    expect(elementLabel('ccs_dpad_h')).toBe('D-pad (across)');
    // The design's backdrop and the theme's own background don't share a name.
    expect(elementLabel('ccs_background')).toBe('Backdrop');
    expect(elementLabel('background')).toBe('Background');
    expect(elementLabel('staticBackground')).toBe('Backdrop');
    expect(elementLabel('bgsound')).toBe('Menu music');
  });

  it("has a plain name for every ccs_ part the designs make", async () => {
    const { readFileSync } = await import('node:fs');
    const src = ['theme/designs.ts', 'theme/designArt.ts', 'editor/restyle.ts', 'editor/featured.ts']
      .map((f) => { try { return readFileSync(new URL(`./${f}`, import.meta.url), 'utf8'); } catch { return ''; } })
      .join('\n');
    const names = new Set([...src.matchAll(/['`](ccs_[a-z0-9_]+)['`]/g)].map((m) => m[1]).filter((n) => n !== 'ccs_test' && n !== 'ccs_mario_bg'));
    // A name of two or more words left as it is ("Dpad h"), or a run-together one ("Listpanel").
    const raw = [...names].filter((n) => {
      const label = elementLabel(n).toLowerCase();
      const bare = n.replace(/^ccs_/, '');
      return label === bare.replace(/_/g, ' ') && (bare.includes('_') || /panel|band|art$/.test(bare));
    });
    expect(raw).toEqual([]);
  });
});
