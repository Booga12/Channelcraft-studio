// Depth and motion feel on a theme made from a design: every screen at once, one undo step.
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
const { shaderOf } = await import('./theme/shadow');
const { frameOf } = await import('./theme/frame');
const { presetOf, tuningOf } = await import('./theme/animations');

const el = (view: string, name: string) => ed.themeRes!.views.get(view)!.elements.get(name)!;

async function fresh(design = 'magazine') {
  const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
  ed.project = p;
  ed.screenFile = 'theme.xml';
  ed.view = 'system';
  ed.clearHistory();
  ed.rev++;
  await ed.applyStarter({ design, artFrom: null });
  ed.clearHistory();
  return p;
}

describe('depth', () => {
  it('starts at the design’s own depth, with shadows and lifted logos', async () => {
    await fresh();
    expect(ed.depth).toBe('subtle');
    expect(shaderOf(el('system', 'ccs_console'))?.offset).toBe(5);
    expect(frameOf(el('detailed', 'md_image'))?.frame.shadow).toBe(14);
  });

  it('changes every screen as one step, and undo puts it all back', async () => {
    const p = await fresh();
    const before = p.entry!.src;
    const view = ed.view;
    await ed.setDepth('strong');
    expect(ed.depth).toBe('strong');
    expect(shaderOf(el('system', 'ccs_console'))?.offset).toBe(9);
    expect(frameOf(el('detailed', 'md_image'))?.frame.shadow).toBe(24);
    expect(shaderOf(el('detailed', 'ccs_boxart'))?.offset).toBe(9);
    expect(shaderOf(el('basic', 'ccs_boxart'))?.offset).toBe(9);
    expect(presetOf(el('detailed', 'ccs_fanart'), 'list')).toBe('slow-zoom');
    expect(presetOf(el('system', 'ccs_systemart'), 'console')).toBe('slow-zoom');
    expect(el('system', 'systemcarousel').props.get('logoScale')?.value).toBe('1.4');
    expect(ed.view).toBe(view);
    expect(ed.history.done).toHaveLength(1);

    await ed.setDepth('off');
    expect(shaderOf(el('system', 'ccs_console'))).toBeNull();
    expect(presetOf(el('detailed', 'ccs_fanart'), 'list')).toBeNull();

    ed.undo();
    ed.undo();
    expect(p.entry!.src).toBe(before);
    ed.redo();
    expect(ed.depth).toBe('strong');
  });

  it('Strong puts depth on text, panels, reflections and layers, and Off takes it all away', async () => {
    await fresh('studio');
    ed.view = 'detailed';
    ed.addElement('text');
    const mine = ed.selected!;
    await ed.setDepth('strong');
    const title = el('detailed', 'ccs_title');
    expect(title.props.get('glowOffset')?.value).toBe('3 3');
    expect(el('detailed', 'gamelist').props.get('glowOffset')?.value).toBe('3 3');
    expect(el('detailed', 'ccs_heroband_shadow')).toBeTruthy();
    expect(presetOf(el('detailed', 'ccs_fanart'), 'list')).toBe('slow-zoom');
    // Studio's system screen is Cover flow 3D: logos stand on a floor, so they're reflected.
    expect(el('system', 'logo').props.get('reflexion')?.value).toBe('0.22 0');
    // What you added stays through depth changes.
    expect(el('detailed', mine)).toBeTruthy();

    await ed.setDepth('off');
    expect(el('detailed', 'ccs_title').props.get('glowOffset')).toBeUndefined();
    expect(ed.themeRes!.views.get('detailed')!.elements.has('ccs_heroband_shadow')).toBe(false);
    expect(el('system', 'logo').props.get('reflexion')).toBeUndefined();
    expect(el('detailed', mine)).toBeTruthy();
  });

  it('decorations drift on Strong, and a one-row grid gets reflections and a bigger lift', async () => {
    await fresh('glass');
    await ed.setDepth('strong');
    expect(presetOf(el('detailed', 'ccs_deco'), 'list')).toBe('drift');
    // Midnight Glass uses Big tiles: one row.
    expect(el('system', 'default').props.get('reflexion')?.value).toBe('0.18 0');
    expect(Number(el('system', 'imagegrid').props.get('autoLayoutSelectedZoom')!.value)).toBeGreaterThan(1.12);
  });

  it('motion feel retunes every animation', async () => {
    await fresh('neon');
    const animated = [...ed.themeRes!.views.get('detailed')!.elements.values()].filter((e) => tuningOf(e, 'list'));
    expect(animated.length).toBeGreaterThan(0);
    ed.setMotionFeel('lively');
    for (const e of animated) {
      const t = tuningOf(el('detailed', e.name), 'list')!;
      expect(t.speed).toBeCloseTo(1.25, 1);
    }
    expect(ed.history.done).toHaveLength(1);
  });
});
