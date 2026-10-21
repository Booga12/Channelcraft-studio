// Frames (RetroBat's border shader) and rounded corners, through the editor and in designs.
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
const { frameOf, FRAME_DEFAULT } = await import('./theme/frame');

async function open(design = 'cinema') {
  const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
  ed.project = p;
  ed.screenFile = 'theme.xml';
  ed.view = 'system';
  ed.clearHistory();
  ed.rev++;
  await ed.applyStarter({ design, artFrom: null });
  ed.view = 'detailed';
  ed.rev++;
  return p;
}

describe('frames', () => {
  it('designs frame screenshots with the border shader, saturation kept at 1', async () => {
    await open('cinema');
    const shot = ed.currentView!.elements.get('md_image')!;
    const f = frameOf(shot)!;
    expect(f).toBeTruthy();
    expect(f.frame.shadow).toBeGreaterThan(0);
    expect(f.def.raw ?? '').toContain('');
    expect(ed.project!.entry!.src).toMatch(/<path>:\/shaders\/border\.glsl<\/path>[\s\S]*?<saturation>1<\/saturation>/);
    // Covers have rounded corners of their own.
    expect(ed.currentView!.elements.get('ccs_boxart')!.props.get('roundCorners')!.value).toBe('0.025');
  });

  it('adds, tunes and removes a frame; its corners go back to roundCorners', async () => {
    const p = await open('cinema');
    const before = p.entry!.src;
    ed.setCorners('ccs_boxart', 0.05);
    expect(ed.currentView!.elements.get('ccs_boxart')!.props.get('roundCorners')!.value).toBe('0.05');
    ed.setFrame('ccs_boxart', { ...FRAME_DEFAULT, corners: 0.05 });
    let box = ed.currentView!.elements.get('ccs_boxart')!;
    expect(frameOf(box)!.frame.corners).toBe(0.05);
    expect(box.props.has('roundCorners')).toBe(false);
    ed.setCorners('ccs_boxart', 0.1);
    expect(frameOf(ed.currentView!.elements.get('ccs_boxart')!)!.frame.corners).toBe(0.1);
    ed.setFrame('ccs_boxart', null);
    box = ed.currentView!.elements.get('ccs_boxart')!;
    expect(frameOf(box)).toBeNull();
    expect(box.props.get('roundCorners')!.value).toBe('0.1');
    while (ed.history.done.length) ed.undo(true);
    expect(p.entry!.src).toBe(before);
  });

  it('a picture with the soft shadow shader gets no frame on top', async () => {
    await open('cinema');
    ed.setShadow('ccs_boxart', 4);
    ed.setFrame('ccs_boxart', FRAME_DEFAULT);
    expect(frameOf(ed.currentView!.elements.get('ccs_boxart')!)).toBeNull();
  });
});
