import { describe, expect, it } from 'vitest';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { applyChanges } from './edits';
import { designChanges, LAYOUTS, layoutChanges } from './presets';
import { DESIGNS, type DesignContext } from './designs';
import { GAME_LAYOUTS } from './gameLayouts';
import { SYSTEM_LAYOUTS } from './systemLayouts';
import { LIBRARY } from './library';
import { isKnownType, propertyKind, supportsProperty } from './retrobatProfile';
import type { Environment } from './context';

const env: Environment = {
  esHome: String.raw`M:\Retrobat\emulationstation\.emulationstation`,
  resourcesDir: String.raw`M:\Retrobat\emulationstation\resources`,
  settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
};
const ctx = (id: string): DesignContext => ({ art: `./_inc/ccs/${id}`, font: './_inc/fonts/x.ttf', titleFont: null, logos: './_inc/systems/logos', consoles: './_inc/systems/consoles' });

/** Every element property RetroBat would skip, as "view/element.prop". */
function unsupported(p: ThemeProject): string[] {
  const out = new Set<string>();
  const r = resolveTheme(p, env);
  for (const [view, v] of r.views) {
    for (const e of v.elements.values()) {
      if (!isKnownType(e.type)) out.add(`${view}/${e.name}: unknown type ${e.type}`);
      for (const prop of [...e.props.keys(), ...e.complex.map((c) => c.name)]) if (supportsProperty(e.type, prop) === false) out.add(`${view}/${e.name}.${prop} (${e.type})`);
    }
  }
  return [...out].sort();
}

describe('RetroBat property profile', () => {
  it('knows the basics and inherited properties', () => {
    expect(propertyKind('carousel', 'logoRotationOrigin')).toBe('NORMALIZED_PAIR');
    expect(supportsProperty('clock', 'fontPath')).toBe(true); // clock inherits text
    expect(supportsProperty('clock', 'format')).toBe(false); // RetroBat's clock has no format
    expect(supportsProperty('image', 'storyboard')).toBe(true);
    expect(supportsProperty('madeup', 'pos')).toBe(null);
  });

  it('the starter theme only uses what RetroBat reads', async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    expect(unsupported(p)).toEqual([]);
  });

  it('every design, on every screen and with every system layout, only uses what RetroBat reads', async () => {
    const problems = new Set<string>();
    for (const d of DESIGNS) {
      const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
      applyChanges(p, designChanges(p, resolveTheme(p, env), d, ctx(d.id), ['basic', 'detailed', 'video', 'grid', 'gamecarousel'], true));
      for (const u of unsupported(p)) problems.add(`${d.id}: ${u}`);
      for (const g of GAME_LAYOUTS) {
        applyChanges(p, designChanges(p, resolveTheme(p, env), d, ctx(d.id), ['detailed'], true, undefined, { gameLayout: g.id }));
        for (const u of unsupported(p)) problems.add(`${d.id}+${g.id}: ${u}`);
      }
      for (const l of SYSTEM_LAYOUTS) {
        applyChanges(p, designChanges(p, resolveTheme(p, env), d, ctx(d.id), ['system'], true, l.id));
        for (const u of unsupported(p)) problems.add(`${d.id}+${l.id}: ${u}`);
      }
    }
    expect([...problems]).toEqual([]);
  }, 180_000);

  it('every plain layout preset only uses what RetroBat reads', async () => {
    const problems: string[] = [];
    for (const l of LAYOUTS) {
      const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
      const views = l.kind === 'system' ? ['system'] : ['basic', 'detailed', 'video'];
      applyChanges(p, layoutChanges(p, resolveTheme(p, env), l, views));
      problems.push(...unsupported(p).map((u) => `${l.id}: ${u}`));
    }
    expect(problems).toEqual([]);
  });

  it('every ready-made element only uses what RetroBat reads', () => {
    const problems: string[] = [];
    for (const item of LIBRARY) {
      for (const m of item.body.matchAll(/<(\w+)>/g)) if (supportsProperty(item.type, m[1]) === false) problems.push(`${item.id}.${m[1]} (${item.type})`);
    }
    expect(problems).toEqual([]);
  });
});
