// Changing a layout on a design theme keeps the theme's look: colours, your own elements and
// tweaks, chosen animations, hidden parts, the grid's tile style and the motion feel.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-store', () => ({ load: async () => ({ get: async () => null, set: async () => {} }) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: async () => true, save: async () => null, open: async () => null }));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string) => {
    if (cmd === 'download_font') throw new Error('offline');
    return null;
  },
  convertFileSrc: (p: string) => p,
}));

const { ed } = await import('./editor.svelte');
const { ThemeProject } = await import('./theme/project');
const { nodeFs } = await import('./theme/nodefs');
const { LAYOUTS, PALETTES, appliedGameLayout, appliedSystemLayout, layoutChanges } = await import('./theme/presets');
const { DESIGNS } = await import('./theme/designs');
const { presetOf, tuningOf } = await import('./theme/animations');
const { GAME_LAYOUTS } = await import('./theme/gameLayouts');
const { applyChanges } = await import('./theme/edits');
const { resolveTheme } = await import('./theme/resolver');
const { FALLBACK_SYSTEMS } = await import('./theme/systems');
const env: import('./theme/context').Environment = { esHome: '', resourcesDir: '', settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false } };

const LISTS = ['basic', 'detailed', 'video'];
const layout = (id: string) => LAYOUTS.find((l) => l.id === id)!;
const el = (view: string, name: string) => ed.themeRes!.views.get(view)!.elements.get(name);
const v = (n: string) => ed.res!.vars.get(n)?.value;

async function fresh(design = 'bubblegum') {
  const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
  ed.project = p;
  ed.screenFile = 'theme.xml';
  ed.view = 'system';
  ed.consoleOnly = false;
  ed.clearHistory();
  ed.rev++;
  await ed.applyStarter({ design, artFrom: null });
  ed.clearHistory();
  return p;
}

describe('game list layouts on a design theme', () => {
  it('keep the design and the palette you picked', async () => {
    const p = await fresh();
    ed.applyPalette(PALETTES.find((x) => x.id === 'lavender')!);
    const accent = v('designAccent');
    expect(accent).toBe('A66CFFFF');
    ed.view = 'detailed';
    const done = ed.history.done.length;
    await ed.applyLayout(layout('cinema-left'), LISTS);
    expect(ed.history.done.length).toBe(done + 1);
    expect(v('designAccent')).toBe(accent);
    for (const view of LISTS) {
      expect(appliedGameLayout(p, view)).toBe('cinema-left');
      for (const n of ['ccs_background', 'ccs_listpanel', 'ccs_deco', 'ccs_fanart', 'ccs_title']) expect(el(view, n), `${view}/${n}`).toBeTruthy();
      // The list moved to the left.
      expect(Number(el(view, 'gamelist')!.props.get('pos')!.value.split(' ')[0])).toBeLessThan(0.5);
      expect(el(view, 'gamelist')!.props.get('primaryColor')!.raw).toBe('${designText}');
    }
    // One undo step puts the old layout back.
    ed.undo();
    expect(appliedGameLayout(p, 'detailed')).toBe('classic');
  });

  it('keep what you added, changed, animated and hid', async () => {
    await fresh();
    ed.view = 'detailed';
    ed.addElement('text');
    const mine = ed.selected!;
    ed.setProps('ccs_title', { color: 'FF0000FF' });
    ed.setProps('md_rating', { visible: 'false' });
    ed.setAnimation('md_marquee', 'pulse');
    ed.setAnimation('ccs_boxart', null);
    await ed.applyLayout(layout('cover'), ['detailed']);
    expect(el('detailed', mine), 'your own text').toBeTruthy();
    expect(el('detailed', 'ccs_title')!.props.get('color')!.value).toBe('FF0000FF');
    expect(el('detailed', 'md_rating')!.props.get('visible')!.value).toBe('false');
    expect(presetOf(el('detailed', 'md_marquee')!, 'list')).toBe('pulse');
    expect(presetOf(el('detailed', 'ccs_boxart')!, 'list')).toBeNull();
    // The cover layout's own parts are there.
    expect(el('detailed', 'ccs_reflection')).toBeTruthy();
  });

});

describe('system layouts and designs keep your choices', () => {
  it('a system layout keeps your colours and the grid keeps its tile style', async () => {
    await fresh('soft-home');
    ed.applyPalette(PALETTES.find((x) => x.id === 'sakura')!);
    const accent = v('designAccent');
    ed.view = 'system';
    const style = DESIGNS.find((d) => d.id === 'soft-home')!;
    await ed.applyTileStyle('neon');
    expect(el('system', 'default')!.props.get('backgroundImage')!.value).toContain('tiles/neon');
    await ed.applyLayout(layout('big-tiles'), ['system'], style);
    expect(appliedSystemLayout(ed.project!)).toBe('big-tiles');
    expect(v('designAccent')).toBe(accent);
    expect(el('system', 'default')!.props.get('backgroundImage')!.value).toContain('tiles/neon');
  });

  it('another design keeps the motion feel and your own elements', async () => {
    await fresh('magazine');
    ed.setMotionFeel('lively');
    expect(v('designMotion')).toBe('lively');
    ed.view = 'detailed';
    ed.addElement('text');
    const mine = ed.selected!;
    await ed.applyDesign(DESIGNS.find((d) => d.id === 'neon')!);
    expect(el('detailed', mine)).toBeTruthy();
    expect(v('designMotion')).toBe('lively');
    const animated = [...ed.themeRes!.views.get('detailed')!.elements.values()].map((e) => tuningOf(e, 'list')).filter((t) => t && t.preset.id !== 'slow-zoom');
    expect(animated.length).toBeGreaterThan(0);
    for (const t of animated) expect(t!.speed).toBeCloseTo(1.25, 1);
  });
});

describe('game list layouts on a plain theme', () => {
  it('move only RetroBat’s own parts, for every layout', async () => {
    for (const g of GAME_LAYOUTS) {
      const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
      applyChanges(p, layoutChanges(p, resolveTheme(p, env), layout(g.id), ['detailed']));
      const els = resolveTheme(p, env).views.get('detailed')!.elements;
      expect(els.get('gamelist')!.props.get('pos'), g.id).toBeTruthy();
      expect([...els.keys()].some((n) => n.startsWith('ccs_')), `${g.id} adds no decorations`).toBe(false);
    }
  });
});
