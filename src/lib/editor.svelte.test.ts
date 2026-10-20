// The editor's operations on the bundled starter theme, in memory (nothing is written to disk).
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The editor talks to Tauri for files and dialogs; these tests never need it.
vi.mock('@tauri-apps/plugin-store', () => ({ load: async () => ({ get: async () => null, set: async () => {} }) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: async () => true, save: async () => null, open: async () => null }));
const calls: { cmd: string; args: Record<string, unknown> }[] = [];
let respond: (cmd: string, args: Record<string, unknown>) => unknown = () => null;
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    calls.push({ cmd, args });
    return respond(cmd, args);
  },
  convertFileSrc: (p: string) => p,
}));

const { ed } = await import('./editor.svelte');
const { ThemeProject } = await import('./theme/project');
const { nodeFs } = await import('./theme/nodefs');
const { ANIMATIONS } = await import('./theme/animations');

async function open() {
  const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
  ed.project = p;
  ed.view = 'detailed';
  ed.selection = [];
  ed.jumpTo(0);
  ed.rev++;
  return p;
}

const pos = (name: string) => ed.currentView!.elements.get(name)!.props.get('pos')!.value;

describe('editor operations (starter theme, in memory)', () => {
  let original = '';
  beforeEach(async () => {
    const p = await open();
    original = p.entry!.src;
  });

  it('merges quick repeated edits into one undo step, and undoes to the exact bytes', () => {
    ed.setProps('md_image', { pos: '0.3 0.4' }, 'drag.x');
    ed.setProps('md_image', { pos: '0.31 0.41' }, 'drag.x');
    ed.setProps('md_image', { pos: '0.32 0.42' }, 'drag.x');
    expect(pos('md_image')).toBe('0.32 0.42');
    expect(ed.history.done.length).toBe(1);
    ed.undo(true);
    expect(ed.project!.entry!.src).toBe(original);
  });

  it('moves several elements as one step', () => {
    ed.selection = ['md_image', 'md_rating'];
    ed.moveSelection({ md_image: [0.26, 0.38], md_rating: [0.05, 0.66] }, 0.1, -0.05, 'drag.both');
    expect(pos('md_image')).toBe('0.36 0.33');
    expect(pos('md_rating')).toBe('0.15 0.61');
    expect(ed.history.done.length).toBe(1);
    ed.undo(true);
    expect(ed.project!.entry!.src).toBe(original);
  });

  it('sets position and size together, adding the missing property', () => {
    ed.setProps('md_rating', { pos: '0.1 0.7', size: '0.2 0.04' });
    const el = ed.currentView!.elements.get('md_rating')!;
    expect(el.props.get('size')!.value).toBe('0.2 0.04');
    expect(el.props.get('pos')!.value).toBe('0.1 0.7');
  });

  it('copies RetroBat’s own picture as a regular element that still shows the game’s data', () => {
    ed.selection = ['md_image'];
    ed.copy();
    ed.paste();
    const pasted = ed.selection[0];
    const el = ed.currentView!.elements.get(pasted)!;
    expect(pasted).not.toBe('md_image');
    expect(el.extra).toBe('true');
    expect(el.props.get('path')!.value).toContain('{game:image}');
    expect(el.props.get('pos')!.value).toBe('0.28 0.4');
  });

  it('duplicates, renames and deletes an element, and undoes it all', () => {
    ed.selection = ['md_image'];
    ed.duplicate();
    const copy = ed.selection[0];
    ed.rename(copy, 'second-art');
    expect(ed.currentView!.elements.has('second-art')).toBe(true);
    expect(ed.currentView!.elements.has(copy)).toBe(false);
    ed.selection = ['second-art'];
    ed.deleteSelection();
    expect(ed.currentView!.elements.has('second-art')).toBe(false);
    ed.jumpTo(0);
    expect(ed.project!.entry!.src).toBe(original);
    ed.jumpTo(3);
    expect(ed.currentView!.elements.has('second-art')).toBe(false);
    expect(ed.history.done.length).toBe(3);
  });

  it('keeps RetroBat’s own element names', () => {
    ed.rename('md_image', 'whatever');
    expect(ed.currentView!.elements.has('md_image')).toBe(true);
  });

  it('replaces an animation instead of stacking them, and removes it', () => {
    const storyboards = () => ed.currentView!.elements.get('md_image')!.complex.filter((c) => c.name === 'storyboard').length;
    ed.setAnimation('md_image', 'pulse');
    expect(storyboards()).toBe(1);
    ed.setAnimation('md_image', 'spin');
    expect(storyboards()).toBe(1);
    const sb = ed.currentView!.elements.get('md_image')!.complex.find((c) => c.name === 'storyboard')!;
    expect(ed.project!.entry!.src.slice(sb.node.start, sb.node.end)).toContain('property="rotation"');
    ed.setAnimation('md_image', null);
    expect(storyboards()).toBe(0);
    expect(ANIMATIONS.length).toBeGreaterThan(5);
  });

  it('aligns and spaces elements using their measured boxes', () => {
    ed.rects = {
      md_image: { x: 0.1, y: 0.2, w: 0.2, h: 0.2 },
      md_rating: { x: 0.3, y: 0.5, w: 0.1, h: 0.04 },
      md_releasedate: { x: 0.6, y: 0.6, w: 0.1, h: 0.03 },
    };
    ed.selection = ['md_image', 'md_rating', 'md_releasedate'];
    ed.align('left');
    // Its left edge (0.3) moves to the leftmost edge (0.1).
    expect(pos('md_rating')).toBe('-0.15 0.66');
    ed.undo(true);
    ed.distribute('h');
    // Gaps become equal: 0.1 between each box, so the middle box's left edge goes from 0.3 to 0.4.
    expect(pos('md_rating')).toBe('0.15 0.66');
    expect(pos('md_releasedate')).toBe('0.2 0.66');
  });

  it('ignores edits meant for a theme that was closed', async () => {
    const old = ed.project!;
    const staleNode = ed.currentView!.elements.get('md_image')!.props.get('pos')!;
    await open();
    ed.commit('stale', [{ file: old.entry!, patch: { start: staleNode.node.start, end: staleNode.node.end, text: 'x' } }]);
    expect(ed.history.done.length).toBe(0);
  });

  it('saves every changed file in one call and asks before overwriting files changed elsewhere', async () => {
    ed.setProps('md_image', { pos: '0.3 0.4' });
    const expected = ed.project!.entry!.src;
    calls.length = 0;
    let first = true;
    respond = (cmd) => {
      if (cmd === 'save_files' && first) {
        first = false;
        throw 'CHANGED_OUTSIDE:["theme.xml"]';
      }
      return null;
    };
    await ed.save();
    respond = () => null;
    const saves = calls.filter((c) => c.cmd === 'save_files');
    // Refused once because theme.xml changed elsewhere; the user agreed (mocked), so it was forced.
    expect(saves.map((c) => c.args.force)).toEqual([false, true]);
    expect(saves[1].args.files).toEqual([{ rel: 'theme.xml', text: expected, bom: false }]);
    // The first save of the session makes a backup first.
    expect(calls.findIndex((c) => c.cmd === 'backup_theme')).toBeLessThan(calls.findIndex((c) => c.cmd === 'save_files'));
    expect(ed.dirtyCount).toBe(0);
  });

  it('sets and clears the theme screen transition on theme.xml, undoably', () => {
    expect(ed.themeTransition).toBe('');
    ed.setThemeTransition('slide');
    expect(ed.project!.entry!.src).toMatch(/<theme[^>]*defaultTransition="slide"/);
    expect(ed.themeTransition).toBe('slide');
    ed.setThemeTransition('');
    expect(ed.project!.entry!.src).toBe(original);
    ed.setThemeTransition('fade');
    ed.undo(true);
    expect(ed.project!.entry!.src).toBe(original);
  });

  it('edits the loading screen in splash.xml, leaving theme.xml alone', () => {
    const p = ed.project!;
    const splash = p.addFile('splash.xml', `<theme>
  <formatVersion>7</formatVersion>
  <view name="splash">
    <text name="label">
      <pos>0.5 0.8</pos>
    </text>
  </view>
</theme>
`);
    ed.rev++;
    expect(ed.screens.map((t) => t.id)).toContain('@splash.xml');
    ed.showScreen({ view: 'splash', file: 'splash.xml' });
    expect(ed.currentView!.elements.has('label')).toBe(true);
    ed.setProps('label', { pos: '0.5 0.7' });
    expect(splash.src).toContain('<pos>0.5 0.7</pos>');
    expect(p.fileAt('theme.xml')!.src).toBe(original);
    // Back on a theme.xml screen, edits go to theme.xml again.
    ed.showScreen({ view: 'detailed', file: 'theme.xml' });
    expect(ed.currentView!.elements.has('md_image')).toBe(true);
    expect(p.entry!.rel).toBe('theme.xml');
  });
});
