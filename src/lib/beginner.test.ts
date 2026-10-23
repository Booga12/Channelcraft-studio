// Help for beginners: a readability check with a fix, resetting one screen, and Surprise me.
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
const { appliedDesign, appliedGameLayout, contrast, readability } = await import('./theme/presets');
const { DESIGNS } = await import('./theme/designs');

async function fresh(design = 'magazine') {
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

describe('readability', () => {
  it('measures contrast like WCAG', () => {
    expect(contrast('000000', 'FFFFFF')).toBeCloseTo(21, 0);
    expect(contrast('777777', '777777')).toBe(1);
  });

  it('every design is readable as it comes', () => {
    for (const d of DESIGNS) expect(readability(d.palette).ratio, d.id).toBeGreaterThanOrEqual(3);
  });

  it('flags pale text on a pale background and fixes it in one step', async () => {
    await fresh();
    ed.setVar('designText', 'EEEEEEFF');
    expect(ed.readability!.ok).toBe(false);
    ed.fixReadability();
    expect(ed.readability!.ok).toBe(true);
    expect(ed.res!.vars.get('designText')!.value).toBe('111111FF');
  });
});

describe('reset this screen to the design', () => {
  it('drops what you added on that screen only, keeping its layout', async () => {
    const p = await fresh();
    ed.view = 'detailed';
    await ed.applyLayout((await import('./theme/presets')).LAYOUTS.find((l) => l.id === 'terminal')!, ['detailed']);
    ed.addElement('text');
    const mine = ed.selected!;
    ed.view = 'basic';
    ed.addElement('text');
    const other = ed.selected!;
    await ed.resetScreen('detailed');
    expect(ed.themeRes!.views.get('detailed')!.elements.has(mine)).toBe(false);
    expect(appliedGameLayout(p, 'detailed')).toBe('terminal');
    expect(ed.themeRes!.views.get('basic')!.elements.has(other)).toBe(true);
  });
});

describe('surprise me', () => {
  it('applies a design with layouts, as one undo step', async () => {
    const p = await fresh();
    const before = p.entry!.src;
    await ed.surprise();
    expect(appliedDesign(p, 'system')).toBeTruthy();
    expect(appliedGameLayout(p, 'detailed')).toBeTruthy();
    ed.undo();
    expect(p.entry!.src).toBe(before);
  });
});
