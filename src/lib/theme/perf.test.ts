// Timings on the installed themes (read-only), to keep editing responsive on big themes.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { parse, patchInsertChild } from '../xml/cst';
import type { Environment } from './context';
import { applyChanges, insertTarget, type Change } from './edits';
import { designChanges, designVarsChange } from './presets';
import { DESIGNS, type DesignContext } from './designs';
import { ANIMATIONS, animationCss, storyboardXml } from './animations';
import { parsePair } from './schema';

const STARTER = 'src-tauri/resources/starter-theme';

const THEMES = 'M:\\Retrobat\\emulationstation\\.emulationstation\\themes';
const env: Environment = {
  esHome: 'M:\\Retrobat\\emulationstation\\.emulationstation',
  resourcesDir: 'M:\\Retrobat\\emulationstation\\resources',
  settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
};

function time(fn: () => void, n = 20) {
  fn();
  const t = performance.now();
  for (let i = 0; i < n; i++) fn();
  return (performance.now() - t) / n;
}

describe.skipIf(!existsSync(THEMES))('performance (read-only)', () => {
  for (const name of ["Booga's WiiTheme v5", 'es-theme-carbon', 'Alekfull-ARTFLIX']) {
    it.skipIf(!existsSync(`${THEMES}\\${name}`))(`${name}: resolve and re-parse fast enough for live editing`, async () => {
      const p = await ThemeProject.load(`${THEMES}\\${name}`, nodeFs);
      const resolveMs = time(() => resolveTheme(p, env));
      const biggest = [...p.files.values()].sort((a, b) => b.src.length - a.src.length)[0];
      const parseMs = time(() => parse(biggest.src));
      console.log(`${name}: resolve ${resolveMs.toFixed(1)} ms, parse ${biggest.rel} (${Math.round(biggest.src.length / 1024)} KB) ${parseMs.toFixed(1)} ms`);
      // One edit = one re-parse + one resolve; keep it well under a frame budget on a normal PC.
      expect(resolveMs + parseMs).toBeLessThan(60);
    });
  }
});

// The speed budgets from docs/futureplans.md, on the bundled starter theme so they also run on
// GitHub (whose computers are slower than most PCs, so these are upper limits, not targets).
describe('speed budgets (starter theme)', () => {
  const ctx = (id: string): DesignContext => ({ art: `./_inc/ccs/${id}`, font: './_inc/fonts/x.ttf', titleFont: null, logos: null, consoles: null });
  const SCREENS = ['system', 'basic', 'detailed', 'video'];

  it('a design applies to every screen in under 1 second', async () => {
    const p = await ThemeProject.load(STARTER, nodeFs);
    const d = DESIGNS[0];
    const t = performance.now();
    applyChanges(p, [designVarsChange(p, d), ...designChanges(p, resolveTheme(p, env), d, { ...ctx(d.id), vars: true }, SCREENS, true)]);
    resolveTheme(p, env);
    const ms = performance.now() - t;
    console.log(`design applied in ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(1000);
  });

  it('the preview updates in under 50 ms after an edit', async () => {
    const p = await ThemeProject.load(STARTER, nodeFs);
    const d = DESIGNS[0];
    applyChanges(p, designChanges(p, resolveTheme(p, env), d, ctx(d.id), SCREENS, true));
    const biggest = [...p.files.values()].sort((a, b) => b.src.length - a.src.length)[0];
    const ms = time(() => {
      parse(biggest.src);
      resolveTheme(p, env);
    });
    console.log(`edit: re-parse ${biggest.rel} and resolve in ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(50);
  });

  it('every animation on a screen is worked out in under 50 ms', async () => {
    const p = await ThemeProject.load(STARTER, nodeFs);
    const d = DESIGNS[0];
    applyChanges(p, designChanges(p, resolveTheme(p, env), d, ctx(d.id), SCREENS, true));
    // Every element gets an animation (the busiest a screen gets), written as the editor does.
    const res = resolveTheme(p, env);
    const changes: Change[] = [];
    const done = new Set<unknown>();
    [...res.views.get('detailed')!.elements.values()].forEach((el, i) => {
      const target = insertTarget(el, 'detailed');
      if (!target || done.has(target.node)) return;
      done.add(target.node);
      const pos = parsePair(el.props.get('pos')?.value) ?? [0.5, 0.5];
      changes.push({ file: target.file, patch: patchInsertChild(target.file.doc, target.node, storyboardXml(ANIMATIONS[i % ANIMATIONS.length], pos, 1, 1, 'list')) });
    });
    applyChanges(p, changes);
    const els = [...resolveTheme(p, env).views.get('detailed')!.elements.values()].filter((e) => e.complex.some((c) => c.name === 'storyboard'));
    expect(els.length).toBeGreaterThan(15);
    let n = 0;
    const ms = time(() => {
      for (const el of els) animationCss(el, 1920, 1080, 'none', { screen: 'list', token: String(n++) });
    }, 5);
    console.log(`${els.length} animations worked out in ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(50);
  });
});
