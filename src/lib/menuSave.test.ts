// Menu options through the editor: what Save writes, and what undo leaves behind.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-store', () => ({ load: async () => ({ get: async () => null, set: async () => {} }) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: async () => true, save: async () => null, open: async () => null }));
let saved: { rel: string; text: string; remove?: boolean }[] = [];
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    if (cmd === 'download_font') throw new Error('offline');
    if (cmd === 'save_files') saved.push(...(args.files as { rel: string; text: string; remove?: boolean }[]));
    return null;
  },
  convertFileSrc: (p: string) => p,
}));

const { ed } = await import('./editor.svelte');
const { ThemeProject } = await import('./theme/project');
const { nodeFs } = await import('./theme/nodefs');
const { defaultChoices } = await import('./theme/menuOptions');

async function freshPixel() {
  const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
  ed.project = p;
  ed.screenFile = 'theme.xml';
  ed.view = 'system';
  ed.clearHistory();
  ed.rev++;
  await ed.applyStarter({ design: 'pixel', artFrom: null });
  saved = [];
  return p;
}

describe('menu options through the editor', () => {
  beforeEach(() => {
    saved = [];
  });

  it('saves every option file with its contents, and theme.xml includes them', async () => {
    await freshPixel();
    const base = ed.menuBase!;
    expect(await ed.applyMenuOptions({ ...defaultChoices(base.design, base.systemLayout), gameDesigns: ['pixel', 'cinema'], colorSets: ['d-pixel', 'd-cinema'] })).toBe(true);
    await ed.save();
    const byRel = Object.fromEntries(saved.map((f) => [f.rel, f.text]));
    const optionFiles = Object.keys(byRel).filter((r) => r.startsWith('_inc/ccs/options'));
    expect(optionFiles.length).toBeGreaterThan(2);
    for (const r of optionFiles) expect(byRel[r].length, r).toBeGreaterThan(20);
    expect(byRel['theme.xml']).toContain('_inc/ccs/options.xml');
  });

  it('adding them again after an undo writes them in full', async () => {
    await freshPixel();
    const base = ed.menuBase!;
    const choices = { ...defaultChoices(base.design, base.systemLayout), colorSets: ['d-pixel', 'd-cinema'] };
    await ed.applyMenuOptions(choices);
    ed.undo(true);
    await ed.applyMenuOptions(choices);
    await ed.save();
    const byRel = Object.fromEntries(saved.map((f) => [f.rel, f.text]));
    for (const [r, t] of Object.entries(byRel)) expect(t.length, r).toBeGreaterThan(20);
    expect(byRel['theme.xml']).toContain('_inc/ccs/options.xml');
    expect(Object.keys(byRel).filter((r) => r.startsWith('_inc/ccs/options')).length).toBeGreaterThan(2);
  });

  it('add, save, undo, save: theme.xml is exactly as before and no empty files are written', async () => {
    const p = await freshPixel();
    const before = p.entry!.src;
    const base = ed.menuBase!;
    await ed.applyMenuOptions({ ...defaultChoices(base.design, base.systemLayout), colorSets: ['d-pixel', 'd-cinema'] });
    await ed.save();
    ed.undo(true);
    expect(p.entry!.src).toBe(before);
    saved = [];
    await ed.save();
    // The undone option files are deleted, never written empty.
    for (const f of saved) expect(f.remove || f.text.length > 0, f.rel).toBe(true);
    expect(saved.filter((f) => f.remove).length).toBeGreaterThan(2);
    // And redo still works afterwards.
    ed.redo(true);
    expect(p.entry!.src).toContain('_inc/ccs/options.xml');
  });

  it('a theme left with empty option files can get its options again without damage', async () => {
    // The state found on disk: theme.xml without options, the option files empty.
    const p = await freshPixel();
    const base = ed.menuBase!;
    const choices = { ...defaultChoices(base.design, base.systemLayout), colorSets: ['d-pixel', 'd-cinema'] };
    for (const rel of ['_inc/ccs/options.xml', '_inc/ccs/options/colors-d-cinema.xml', '_inc/ccs/options/colors-d-pixel.xml', '_inc/ccs/options/system-tile-row.xml', '_inc/ccs/options/games-pixel.xml', '_inc/ccs/options/motion-on.xml', '_inc/ccs/options/motion-off.xml']) {
      const f = p.addFile(rel, '');
      f.savedSrc = '';
      f.dirty = false;
    }
    ed.rev++;
    expect(await ed.applyMenuOptions(choices)).toBe(true);
    const src = p.entry!.src;
    expect(src).toContain('<formatVersion>7</formatVersion>');
    expect(src).toContain('_inc/ccs/options.xml');
    // Every option file theme.xml or options.xml includes has content.
    const including = p.entry!.src + (p.fileAt('_inc/ccs/options.xml')?.src ?? '');
    const used = p.xmlFiles.filter((x) => x.rel.startsWith('_inc/ccs/options') && (x.rel.endsWith('options.xml') || including.includes(x.rel.slice('_inc/ccs/'.length))));
    expect(used.length).toBeGreaterThan(3);
    for (const f of used) expect(f.src.length, f.rel).toBeGreaterThan(20);
  });

  it('undo leaves no empty option files to be saved', async () => {
    await freshPixel();
    const base = ed.menuBase!;
    await ed.applyMenuOptions({ ...defaultChoices(base.design, base.systemLayout), colorSets: ['d-pixel', 'd-cinema'] });
    ed.undo(true);
    await ed.save();
    for (const f of saved) expect(f.text.length, f.rel).toBeGreaterThan(0);
  });
});
