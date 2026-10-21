// "New theme" with a design: the design must be on screen and in the saved theme.xml.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-store', () => ({ load: async () => ({ get: async () => null, set: async () => {} }) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: async () => true, save: async () => null, open: async () => null }));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string) => {
    // Offline: fonts can't be downloaded.
    if (cmd === 'download_font') throw new Error('offline');
    return null;
  },
  convertFileSrc: (p: string) => p,
}));

const { ed } = await import('./editor.svelte');
const { ThemeProject } = await import('./theme/project');
const { nodeFs } = await import('./theme/nodefs');
const { DESIGNS } = await import('./theme/designs');

describe('new theme with a design', () => {
  for (const d of DESIGNS) {
    it(`${d.label} shows on the console and game screens`, async () => {
      const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
      ed.project = p;
      ed.screenFile = 'theme.xml';
      ed.view = 'system';
      ed.clearHistory();
      ed.rev++;
      await ed.applyStarter({ design: d.id, artFrom: null });
      for (const view of ['system', 'detailed']) {
        const els = [...(ed.themeRes!.views.get(view)?.elements.keys() ?? [])];
        expect(els.some((n) => n.startsWith('ccs_')), `${view}: ${els.join(', ')}`).toBe(true);
      }
      expect(p.entry!.src).toContain('ChannelCraft design colours');
    });
  }
});
