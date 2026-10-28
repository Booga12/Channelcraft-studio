import { describe, expect, it, vi } from 'vitest';
import type { ExplorerEntry } from './api';

let respond: (cmd: string, args: Record<string, unknown>) => unknown = () => null;
const calls: { cmd: string; args: Record<string, unknown> }[] = [];
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    calls.push({ cmd, args });
    return respond(cmd, args);
  },
  convertFileSrc: (p: string) => `asset://${p}`,
}));

const { crumbsOf, explorer, formatSize, inThemeKey, isInTheme, kindCounts, kindLine, rangeBetween, summarize, usedWhere, ADD_BATCH } = await import('./explorer.svelte');

const file = (name: string, kind: ExplorerEntry['kind'], size = 100, problem: string | null = null): ExplorerEntry => ({ name, path: `C:\\pack\\${name}`, isDir: false, kind, size, modified: 0, problem, items: null });
const dir = (name: string): ExplorerEntry => ({ name, path: `C:\\pack\\${name}`, isDir: true, kind: '', size: 0, modified: 0, problem: null, items: 3 });

describe('explorer helpers', () => {
  it('shows the path from "This PC", or from the theme without going above it', () => {
    expect(crumbsOf(null, null)).toEqual([{ label: 'This PC', path: null }]);
    expect(crumbsOf('C:\\Users\\me\\Downloads', null)).toEqual([
      { label: 'This PC', path: null },
      { label: 'C:', path: 'C:\\' },
      { label: 'Users', path: 'C:\\Users' },
      { label: 'me', path: 'C:\\Users\\me' },
      { label: 'Downloads', path: 'C:\\Users\\me\\Downloads' },
    ]);
    expect(crumbsOf('D:\\', null).map((c) => c.path)).toEqual([null, 'D:\\']);
    const theme = 'M:\\Retrobat\\themes\\test 69';
    expect(crumbsOf(`${theme}\\_inc\\images`, theme)).toEqual([
      { label: 'test 69', path: theme },
      { label: '_inc', path: `${theme}\\_inc` },
      { label: 'images', path: `${theme}\\_inc\\images` },
    ]);
    expect(crumbsOf(theme, theme)).toHaveLength(1);
  });

  it('counts files by kind, leaving folders out', () => {
    expect(kindCounts([dir('a'), file('a.png', 'image'), file('b.png', 'image'), file('c.ogg', 'sound'), file('d.txt', 'other')])).toEqual({ all: 4, image: 2, video: 0, sound: 1, font: 0 });
  });

  it('picks a range either way for Shift-click', () => {
    const l = ['a', 'b', 'c', 'd'];
    expect(rangeBetween(l, 'b', 'd')).toEqual(['b', 'c', 'd']);
    expect(rangeBetween(l, 'd', 'b')).toEqual(['b', 'c', 'd']);
    expect(rangeBetween(l, 'x', 'c')).toEqual(['c']);
  });

  it('knows a file is already in the theme by its name and size where the copy would go', () => {
    const keys = inThemeKey([{ rel: '_inc/images/Sky.png', kind: 'image', size: 100 }]);
    expect(isInTheme(file('sky.png', 'image', 100), keys)).toBe(true);
    expect(isInTheme(file('sky.png', 'image', 101), keys)).toBe(false);
    expect(isInTheme(file('sky.png', 'video', 100), keys)).toBe(false);
  });

  it('says where a theme file is used, or that only the XML mentions it', () => {
    const el = { props: new Map([['path', { value: './_inc/images/Sky.png' }]]) };
    const res = { views: new Map([['system', { elements: new Map([['bg', el]]) }]]) } as never;
    expect(usedWhere('sky.png', res, [])).toEqual(['System menu']);
    expect(usedWhere('other.png', res, ['<path>./_inc/images/other.png</path>'])).toEqual(['the theme’s files']);
    expect(usedWhere('nope.png', res, ['<theme/>'])).toBeNull();
  });

  it('sums up what was added, by kind, in plain words', () => {
    const s = summarize(['_inc/images/a.png', '_inc/images/b.png', '_inc/videos/c.mp4', '_inc/fonts/d.ttf'], ['_inc/images/x.png'], ['readme.txt can’t be used'], false);
    expect(s.byKind).toEqual({ image: 2, video: 1, sound: 0, font: 1 });
    expect(kindLine(s.byKind)).toBe('2 pictures · 1 video · 1 font');
    expect(s.existing).toBe(1);
    expect(formatSize(560 * 1024)).toBe('560 KB');
    expect(formatSize(1.25 * 1024 * 1024)).toBe('1.3 MB');
    expect(formatSize(3 * 1024 * 1024)).toBe('3 MB');
  });
});

describe('the explorer panel state', () => {
  it('ticks with clicks and Shift-click, skipping files that can’t be added', () => {
    const list = [file('1.png', 'image'), file('2.txt', 'other', 1, 'no'), file('3.png', 'image'), file('4.png', 'image')];
    const can = (e: ExplorerEntry) => !e.problem;
    explorer.clear();
    explorer.click(list[0], list, { shift: false }, can);
    explorer.click(list[3], list, { shift: true }, can);
    expect([...explorer.selected].sort()).toEqual([list[0].path, list[2].path, list[3].path].sort());
    explorer.click(list[1], list, { shift: false }, can);
    expect(explorer.selected.has(list[1].path)).toBe(false);
    explorer.click(list[0], list, { shift: false }, can);
    expect(explorer.selected.has(list[0].path)).toBe(false);
    explorer.clear();
    explorer.selectAll(list, can);
    expect(explorer.selected.size).toBe(3);
    explorer.clear();
  });

  it('adds the ticked files a few at a time, refreshes the theme’s files, and can stop', async () => {
    calls.length = 0;
    const paths = Array.from({ length: ADD_BATCH * 2 + 3 }, (_, i) => `C:\\pack\\f${i}.png`);
    explorer.clear();
    for (const p of paths) explorer.selected.add(p);
    respond = (cmd, args) => {
      if (cmd === 'explorer_add_to_theme') return { added: (args.paths as string[]).map((p) => `_inc/images/${p.split('\\').pop()}`), existing: [], problems: [] };
      if (cmd === 'list_theme_files') return [{ rel: 'theme.xml', kind: 'xml', size: 1 }];
      return null;
    };
    let refreshed: unknown = null;
    await explorer.addToTheme('M:\\theme', (a) => (refreshed = a));
    expect(calls.filter((c) => c.cmd === 'explorer_add_to_theme')).toHaveLength(3);
    expect(explorer.summary?.added).toBe(paths.length);
    expect(explorer.summary?.byKind.image).toBe(paths.length);
    expect(explorer.selected.size).toBe(0);
    expect(refreshed).toEqual([{ rel: 'theme.xml', kind: 'xml', size: 1 }]);

    // Stop between batches: what's done stays done, the rest stays ticked.
    calls.length = 0;
    for (const p of paths) explorer.selected.add(p);
    respond = (cmd, args) => {
      if (cmd === 'explorer_add_to_theme') {
        explorer.stop();
        return { added: (args.paths as string[]).map((p) => `_inc/images/${p.split('\\').pop()}`), existing: [], problems: [] };
      }
      return [];
    };
    await explorer.addToTheme('M:\\theme', () => {});
    expect(calls.filter((c) => c.cmd === 'explorer_add_to_theme')).toHaveLength(1);
    expect(explorer.summary).toMatchObject({ added: ADD_BATCH, stopped: true });
    expect(explorer.selected.size).toBe(paths.length - ADD_BATCH);
    explorer.clear();
    respond = () => null;
  });

  it('goes up a folder, and from the top of a drive back to the start', async () => {
    respond = (cmd, args) => (cmd === 'explorer_list' ? { path: args.path, parent: null, entries: [], total: 0, truncated: false } : cmd === 'explorer_places' ? [] : null);
    await explorer.open('C:\\Users\\me', { source: 'pc' });
    await explorer.up(null);
    expect(explorer.path).toBe('C:\\Users');
    await explorer.up(null);
    expect(explorer.path).toBe('C:\\');
    await explorer.up(null);
    expect(explorer.path).toBeNull();
    await explorer.goBack();
    expect(explorer.path).toBe('C:\\');
    // In the theme it never goes above the theme folder.
    await explorer.open('M:\\themes\\t', { source: 'theme' });
    await explorer.up('M:\\themes\\t');
    expect(explorer.path).toBe('M:\\themes\\t');
    respond = () => null;
  });

  it('matches whole file names only when saying a file is used', async () => {
    const { mentions, folderOf } = await import('./explorer.svelte');
    expect(mentions('./_inc/images/data.png', 'a.png')).toBe(false);
    expect(mentions('./_inc/images/a.png', 'a.png')).toBe(true);
    expect(mentions('<path>a.png</path>', 'a.png')).toBe(true);
    expect(mentions('./_inc/images/A.PNG', 'a.png')).toBe(true);
    expect(folderOf('C:\\pic.png')).toBe('C:\\');
    expect(folderOf('C:\\art\\pic.png')).toBe('C:\\art');
  });

  it('adds up the size of everything ticked, wherever it was ticked', () => {
    const list = [file('a.png', 'image', 1000), file('b.png', 'image', 500)];
    explorer.clear();
    explorer.selectAll(list, () => true);
    expect(explorer.selectedSize).toBe(1500);
    explorer.click(list[0], list, { shift: false }, () => true);
    expect(explorer.selectedSize).toBe(500);
    explorer.clear();
    expect(explorer.selectedSize).toBe(0);
  });

  it('drops a search that finishes after moving to another folder, and starts each folder unfiltered', async () => {
    let release: () => void = () => {};
    respond = (cmd, args) => {
      if (cmd === 'explorer_list') return { path: args.path, parent: null, entries: [], total: 0, truncated: false };
      if (cmd === 'explorer_search') return new Promise((ok) => (release = () => ok({ entries: [file('mario.png', 'image')], truncated: false })));
      return [];
    };
    vi.useFakeTimers();
    await explorer.open('C:\\A', { source: 'pc' });
    explorer.filter = 'video';
    explorer.search('mario');
    await vi.advanceTimersByTimeAsync(300);
    await explorer.open('C:\\B');
    release();
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    expect(explorer.path).toBe('C:\\B');
    expect(explorer.found).toBeNull();
    expect(explorer.filter).toBe('all');
    respond = () => null;
  });

  it('keeps "This theme" on the open theme when another theme is opened', async () => {
    respond = (cmd, args) => (cmd === 'explorer_list' ? { path: args.path, parent: null, entries: [], total: 0, truncated: false } : []);
    explorer.themeChanged('M:\\themes\\A');
    await explorer.open('M:\\themes\\A\\_inc', { source: 'theme' });
    expect(explorer.themeChanged('M:\\themes\\A')).toBe(false);
    expect(explorer.themeChanged('M:\\themes\\B')).toBe(true);
    await vi.waitFor(() => expect(explorer.path).toBe('M:\\themes\\B'));
    expect(explorer.canGoBack).toBe(false);
    await explorer.open(null, { source: 'pc' });
    respond = () => null;
  });

  it('opens a dropped folder, or a dropped file’s folder with it ticked', async () => {
    const entries = [file('a.png', 'image'), file('b.txt', 'other', 1, 'no')];
    respond = (cmd, args) => {
      if (cmd !== 'explorer_list') return [];
      if ((args.path as string).endsWith('.png') || (args.path as string).endsWith('.txt')) throw new Error('not a folder');
      return { path: args.path, parent: null, entries, total: 2, truncated: false };
    };
    explorer.clear();
    await explorer.openDropped([entries[0].path, entries[1].path]);
    expect(explorer.path).toBe('C:\\pack');
    expect([...explorer.selected]).toEqual([entries[0].path]);
    await explorer.openDropped(['D:\\Art']);
    expect(explorer.path).toBe('D:\\Art');
    explorer.clear();
    respond = () => null;
  });
});
