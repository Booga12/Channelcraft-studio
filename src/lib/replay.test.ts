// Animations play again in the preview: on Replay, on a new animation, and on moving to another
// game, even with sample data; and small motion can be shown bigger without changing the theme.
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
const { animationCss } = await import('./theme/animations');

async function fresh() {
  const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
  ed.project = p;
  ed.screenFile = 'theme.xml';
  ed.view = 'system';
  ed.clearHistory();
  ed.rev++;
  await ed.applyStarter({ design: 'magazine', artFrom: null });
  ed.clearHistory();
}

describe('animations play again in the preview', () => {
  it('on Replay, on a new animation and on the next game with sample data', async () => {
    await fresh();
    ed.view = 'detailed';
    ed.playAnimations = false;
    const r0 = ed.replay;
    ed.replayAnimations();
    expect(ed.playAnimations).toBe(true);
    expect(ed.replay).toBe(r0 + 1);
    ed.setAnimation('ccs_title', 'pop');
    expect(ed.replay).toBe(r0 + 2);
    // No scraped games here: moving down the list just replays, from below.
    ed.stepGame(1);
    expect(ed.replay).toBe(r0 + 3);
    expect(ed.replayDir).toBe(1);
  });

  it('a new token restarts the motion, and Boost makes it bigger without changing the theme', async () => {
    await fresh();
    ed.view = 'detailed';
    ed.setAnimation('ccs_title', 'rise');
    const again = ed.themeRes!.views.get('detailed')!.elements.get('ccs_title')!;
    const a = animationCss(again, 1920, 1080, 'translate(0, 0)', { screen: 'list', token: 'a' })!;
    const b = animationCss(again, 1920, 1080, 'translate(0, 0)', { screen: 'list', token: 'b' })!;
    expect(a.split(' ')[0]).not.toBe(b.split(' ')[0]);
    const big = animationCss(again, 1920, 1080, 'translate(0, 0)', { screen: 'list', token: 'a', boost: 3 })!;
    expect(big.split(' ')[0]).not.toBe(a.split(' ')[0]);
  });
});
