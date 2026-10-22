// Colour palettes on a theme made from a design: every colour changes, artwork included.
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
const { PALETTES, paletteColours, coloursFromVars, paletteCoverage } = await import('./theme/presets');
const { designVars } = await import('./theme/designs');
const { fileUrl } = await import('./api');
const { join } = await import('./path');

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const v = (n: string) => ed.res!.vars.get(n)?.value;

describe('palettes on a design theme', () => {
  it('turn into design colours and back', () => {
    for (const pal of PALETTES) {
      const c = paletteColours(pal);
      expect(coloursFromVars((n) => designVars(c)[n])).toMatchObject({ bg: c.bg, accent: c.accent, text: c.text });
    }
  });

  it('change the design colours and redraw the artwork, and undo puts both back', async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    ed.project = p;
    ed.screenFile = 'theme.xml';
    ed.view = 'system';
    ed.clearHistory();
    ed.rev++;
    await ed.applyStarter({ design: 'cinema', artFrom: null });
    const fade = join(p.dir, '_inc/ccs/cinema/fade.png');
    ed.syncDesignArt(); // notes what the artwork was drawn with
    const before = v('designAccent');

    const day = PALETTES.find((x) => x.id === 'daylight')!;
    expect(paletteCoverage(day, ed.res!)).toBe(Object.keys(day.colors).length);
    expect(ed.applyPalette(day)).toBeGreaterThan(Object.keys(day.colors).length);
    expect(v('designAccent')).toBe(day.colors.accentColor);
    expect(v('designBackground')).toBe(day.colors.bgColor);
    expect(v('bgColor')).toBe(day.colors.bgColor);

    ed.syncDesignArt();
    await wait(500);
    expect(decodeURIComponent(fileUrl(fade))).toContain(`#${day.colors.bgColor.slice(0, 6)}`);

    ed.undo();
    expect(v('designAccent')).toBe(before);
    ed.syncDesignArt();
    await wait(500);
    expect(decodeURIComponent(fileUrl(fade))).not.toContain(`#${day.colors.bgColor.slice(0, 6)}`);
  });
});
