import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { applyChanges } from './edits';
import { appliedDesign, appliedGameLayout, appliedSystemLayout, designChanges } from './presets';
import { BUILT_IN_DESIGNS } from './designCatalog';
import { cleanSavedDesign, designFileText, DESIGN_GROUPS, DESIGNS, myDesigns, putMyDesign, readDesignFile, removeMyDesign, savedToDesign, type SavedDesign } from './designList.svelte';
import type { DesignContext } from './designs';
import type { Environment } from './context';

const env: Environment = {
  esHome: 'M:\\none',
  resourcesDir: 'M:\\none\\resources',
  settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
};

const mine = (over: Partial<SavedDesign> = {}): SavedDesign => ({
  id: 'my-cosy-arcade-1a2b',
  label: 'Cosy Arcade',
  base: 'cinema',
  palette: { bg: '201010', bg2: '301818', surface: 'FFFFFF14', text: 'FFF4E0', dim: 'C8A888', accent: 'FF8A3D', accentText: '201010' },
  depth: 'off',
  system: 'wheel-right',
  gameLayout: 'mirrored',
  font: 'nunito',
  titleFont: 'bebas',
  ...over,
});

afterEach(() => {
  for (const s of [...myDesigns.list]) removeMyDesign(s.id);
});

describe('my designs', () => {
  it('shows saved designs first, in their own group, and takes them out again', () => {
    const d = putMyDesign(mine());
    expect(DESIGNS[0].id).toBe(d.id);
    expect(DESIGNS.length).toBe(BUILT_IN_DESIGNS.length + 1);
    expect(DESIGN_GROUPS[0].id).toBe('mine');
    expect(d.group).toBe('mine');
    removeMyDesign(d.id);
    expect(DESIGNS.length).toBe(BUILT_IN_DESIGNS.length);
    expect(DESIGN_GROUPS.some((g) => g.id === 'mine')).toBe(false);
  });

  it('keeps what you chose and the base design’s artwork style', () => {
    const base = BUILT_IN_DESIGNS.find((d) => d.id === 'cinema')!;
    const d = savedToDesign(mine());
    expect(d.background).toBe(base.background);
    expect(d.palette.accent).toBe('FF8A3D');
    expect(d.system).toBe('wheel-right');
    expect(d.font).toBe('nunito');
    // A new accent: the base's second accent no longer fits.
    expect(d.accent2).toBeUndefined();
  });

  it('is used on a theme with its own layouts, and recognised afterwards', async () => {
    const d = putMyDesign(mine());
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    const ctx: DesignContext = { art: `./_inc/ccs/${d.id}`, font: null, titleFont: null, logos: null, consoles: null };
    applyChanges(p, designChanges(p, resolveTheme(p, env), d, ctx, ['system', 'basic', 'detailed', 'video'], true));
    expect(appliedDesign(p, 'detailed')?.id).toBe(d.id);
    expect(appliedSystemLayout(p)).toBe('wheel-right');
    expect(appliedGameLayout(p, 'detailed')).toBe('mirrored');
  });

  it('goes through a .ccdesign file unchanged, with a new id if you have it already', () => {
    putMyDesign(mine());
    const back = readDesignFile(designFileText(mine()));
    expect(typeof back).toBe('object');
    const s = back as SavedDesign;
    expect(s.id).not.toBe(mine().id);
    expect({ ...s, id: '' }).toEqual({ ...mine(), id: '', description: undefined });
  });

  it('turns down files that aren’t designs, and fixes what it can', () => {
    expect(readDesignFile('hello')).toMatch(/isn’t a ChannelCraft design/);
    expect(readDesignFile(JSON.stringify({ format: 'channelcraft-design', version: 9, design: mine() }))).toMatch(/newer/);
    expect(cleanSavedDesign({ ...mine(), base: 'nope' })).toBeNull();
    expect(cleanSavedDesign({ ...mine(), id: '../../evil' })).toBeNull();
    const fixed = cleanSavedDesign({ ...mine(), palette: { ...mine().palette, text: 'red;<x>' }, system: 'gone', font: 'comic', label: 'x'.repeat(99) })!;
    const base = BUILT_IN_DESIGNS.find((d) => d.id === 'cinema')!;
    expect(fixed.palette.text).toBe(base.palette.text);
    expect(fixed.system).toBe(base.system);
    expect(fixed.font).toBe(base.font);
    expect(fixed.label.length).toBe(40);
  });
});
