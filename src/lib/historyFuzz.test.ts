// Random sequences of edits, undo, redo and save on a designed theme: theme.xml must never get
// damaged, and undoing everything must give back the exact starting text.
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
const { defaultChoices } = await import('./theme/menuOptions');

function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

const SETS = ['d-pixel', 'd-cinema', 'p-neon', 'd-neon'];
const GAMES = ['pixel', 'cinema', 'neon'];
const SYS = ['tile-row', 'carousel-middle', 'wheel-right'];

describe('history fuzz (in memory)', () => {
  it('never damages theme.xml, and undoing everything restores it exactly', async () => {
    for (let run = 0; run < 40; run++) {
      const rand = rng(run + 1);
      const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
      const some = <T,>(a: T[]) => {
        const out = a.filter(() => rand() < 0.5);
        return out.length ? out : [a[0]];
      };
      const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
      ed.project = p;
      ed.screenFile = 'theme.xml';
      ed.view = 'system';
      ed.clearHistory();
      ed.rev++;
      await ed.applyStarter({ design: 'pixel', artFrom: null });
      const start = p.entry!.src;
      const log: string[] = [];
      for (let step = 0; step < 8; step++) {
        const r = rand();
        if (r < 0.35) {
          const base = ed.menuBase;
          if (!base) continue;
          const c = { ...defaultChoices(base.design, base.systemLayout), systemViews: some(SYS), gameDesigns: some(GAMES), colorSets: some(SETS), motion: rand() < 0.7 };
          log.push(`apply ${JSON.stringify(c)}`);
          await ed.applyMenuOptions(c);
        } else if (r < 0.6) {
          log.push('undo');
          ed.undo(true);
        } else if (r < 0.75) {
          log.push('redo');
          ed.redo(true);
        } else if (r < 0.9) {
          log.push('save');
          await ed.save();
        } else {
          log.push('setVar');
          ed.setVar('designAccent', pick(['FF0000FF', '00FF00FF', '123456FF']));
        }
        const src = p.entry!.src;
        expect(src, `run ${run}: ${log.join(' → ')}`).toContain('<formatVersion>7</formatVersion>');
        expect(p.entry!.doc.root, `run ${run}: ${log.join(' → ')}`).toBeTruthy();
        // Every file theme.xml includes for the menu options has content.
        if (src.includes('_inc/ccs/options.xml')) for (const f of p.xmlFiles.filter((x) => x.rel.startsWith('_inc/ccs/options'))) if (src.includes(f.rel.replace('_inc/ccs/', '')) || f.rel.endsWith('options.xml')) expect(f.src.trim().length, `run ${run}: ${f.rel} empty after ${log.join(' → ')}`).toBeGreaterThan(0);
      }
      while (ed.history.done.length) ed.undo(true);
      expect(p.entry!.src, `run ${run}: ${log.join(' → ')}`).toBe(start);
    }
  });
});
