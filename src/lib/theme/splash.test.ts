import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { splashScene, splashTemplate } from './splash';
import type { Environment } from './context';

const env: Environment = {
  esHome: String.raw`M:\Retrobat\emulationstation\.emulationstation`,
  resourcesDir: String.raw`M:\Retrobat\emulationstation\resources`,
  settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
};

const V5 = String.raw`M:\Retrobat\emulationstation\.emulationstation\themes\Booga's WiiTheme v5`;

describe.skipIf(!existsSync(V5))('loading screen, the way RetroBat draws it (v5, read only)', () => {
  it('reads splash.xml on its own, with RetroBat\u2019s drawing order and built-in parts', async () => {
    const p = await ThemeProject.load(V5, nodeFs);
    const r = resolveTheme(p, env, 'splash.xml');
    const scene = splashScene(r.views.get('splash'), p.fileAt('splash.xml')!, 'splash.svg');
    expect(scene.backgroundColor).toBe('17191DFF');
    const names = scene.elements.map((e) => e.name);
    // The hidden background isn't drawn; the panel (z 2) is below the rule (z 5), the label sits
    // after the progress bar, and the title (z 6) is in the 5–10 group before them.
    expect(names).not.toContain('background');
    expect(names.indexOf('booga-splash-panel')).toBeLessThan(names.indexOf('booga-splash-rule'));
    expect(names.indexOf('booga-splash-title')).toBeLessThan(scene.barIndex);
    expect(names.indexOf('label')).toBe(scene.barIndex);
    // Bar placement and colours come from the theme.
    expect(scene.bar).toMatchObject({ x: 0.3, y: 0.77, w: 0.4, h: 0.01, color: '0C0D0FFF' });
    expect(scene.ignored).toEqual([]);
    // theme.xml is untouched by reading the loading screen.
    expect(p.entry!.rel).toBe('theme.xml');
  });
});

describe('loading screen defaults', () => {
  it('uses RetroBat\u2019s own picture, label and bar when the file sets nothing', async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    const scene = splashScene(undefined, p.entry!, 'splash.svg');
    const bg = scene.elements.find((e) => e.name === 'background')!;
    expect(bg.props.get('path')!.value).toBe('splash.svg');
    expect(bg.props.get('minSize')!.value).toBe('1 1');
    expect(bg.props.get('origin')!.value).toBe('0.5 0.5');
    expect(scene.elements.find((e) => e.name === 'label')!.props.get('text')!.value).toBe('Loading…');
    expect(scene.bar).toMatchObject({ x: 0.25, w: 0.5, h: 0.036, activeColor: 'DF1010FF' });
    expect(scene.backgroundColor).toBe('000000FF');
  });
});

describe('a new loading screen file', () => {
  it('draws like RetroBat’s own, with its built-in parts written out', async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    for (const game of [false, true]) {
      const rel = game ? 'gamesplash.xml' : 'splash.xml';
      p.addFile(rel, splashTemplate(game));
      const r = resolveTheme(p, env, rel);
      const view = r.views.get('splash')!;
      expect([...view.elements.keys()].sort()).toEqual(['background', 'label', 'progressbar', 'progressbar:active', 'splash']);
      const scene = splashScene(view, p.fileAt(rel)!, 'splash.svg');
      const own = splashScene(undefined, p.entry!, 'splash.svg');
      expect(scene.bar).toEqual(own.bar);
      expect(scene.backgroundColor).toBe(own.backgroundColor);
      expect(scene.ignored).toEqual([]);
      expect(scene.elements.find((e) => e.name === 'background')!.props.get('path')!.value).toBe('splash.svg');
    }
  });
});
