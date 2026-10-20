import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { applyChanges } from './edits';
import { appliedSystemLayout, designChanges } from './presets';
import { SYSTEM_LAYOUTS, systemLayout } from './systemLayouts';
import { DESIGNS, designAssets, type DesignContext } from './designs';
import { parse, print } from '../xml/cst';
import type { Environment } from './context';

const env: Environment = {
  esHome: 'M:\\Retrobat\\emulationstation\\.emulationstation',
  resourcesDir: 'M:\\Retrobat\\emulationstation\\resources',
  settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
};

const ctx = (id: string, logos = false): DesignContext => ({ art: `./_inc/ccs/${id}`, font: './_inc/fonts/x.ttf', titleFont: null, logos: logos ? './_inc/systems/logos' : null, consoles: null });

const GAME_DATA = ['md_image', 'ccs_boxart', 'md_marquee', 'ccs_fanart', 'ccs_title', 'md_description', 'md_rating', 'md_releasedate', 'md_genre', 'md_developer', 'md_players', 'ccs_favorite', 'gamelist', 'logo', 'help', 'ccs_clock'];
const SYSTEM_DATA = ['ccs_console', 'ccs_systemname', 'ccs_systemmaker', 'ccs_systemcount', 'ccs_systemart', 'help'];

describe('designs on the starter theme (in memory)', () => {
  for (const d of DESIGNS) {
    it(`${d.label}: every screen gets all RetroBat data, in view`, async () => {
      const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
      applyChanges(p, designChanges(p, resolveTheme(p, env), d, ctx(d.id), ['system', 'basic', 'detailed', 'video'], true));
      const r = resolveTheme(p, env);
      expect(r.unknownConditions).toBe(0);
      for (const v of ['basic', 'detailed', 'video']) {
        const els = r.views.get(v)!.elements;
        for (const n of GAME_DATA) {
          const name = v === 'video' && n === 'md_image' ? 'md_video' : n;
          expect(els.has(name), `${v} has ${name}`).toBe(true);
          expect(els.get(name)!.props.get('visible')?.value ?? 'true').not.toBe('false');
        }
        expect(els.get('ccs_boxart')!.props.get('path')!.value).toContain('{game:boxart}');
        expect(els.get('ccs_title')!.props.get('text')!.value).toBe('{game:name}');
        // The starter's own decorations are hidden by the design.
        expect(els.get('background')!.props.get('visible')!.value).toBe('false');
        // Everything sits on the screen.
        for (const e of els.values()) {
          const pos = e.props.get('pos')?.value.split(' ').map(Number);
          if (pos) expect(pos.every((n) => n >= 0 && n <= 1), `${v}/${e.name} pos ${pos}`).toBe(true);
        }
      }
      const sys = r.views.get('system')!.elements;
      for (const n of SYSTEM_DATA) expect(sys.has(n), `system has ${n}`).toBe(true);
      // Consoles are shown either as a carousel or as a grid of tiles.
      if (systemLayout(d.system)!.grid) {
        expect(sys.get('imagegrid')!.props.get('autoLayout')).toBeTruthy();
        expect(sys.get('selected')!.type).toBe('gridtile');
        expect(sys.get('default')!.props.get('backgroundImage')!.value).toContain(`ccs/${d.id}/panel.svg`);
      } else {
        expect(sys.has('systemcarousel')).toBe(true);
      }
      expect(sys.get('ccs_systemname')!.props.get('text')!.value).toBe('{system:fullName}');
      // Theme.xml stays a well-formed, lossless document.
      expect(print(parse(p.entry!.src))).toBe(p.entry!.src);
    });
  }

  it('every design works with every system layout, with all the system data on screen', async () => {
    expect(SYSTEM_LAYOUTS.length).toBeGreaterThanOrEqual(16);
    // Every layout has a design made for it.
    for (const l of SYSTEM_LAYOUTS) expect(DESIGNS.some((d) => d.system === l.id), `a design for ${l.id}`).toBe(true);
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    for (const d of DESIGNS) {
      for (const l of SYSTEM_LAYOUTS) {
        applyChanges(p, designChanges(p, resolveTheme(p, env), d, ctx(d.id), ['system'], true, l.id));
        expect(appliedSystemLayout(p)).toBe(l.id);
        const sys = resolveTheme(p, env).views.get('system')!.elements;
        for (const n of SYSTEM_DATA) expect(sys.has(n), `${d.id}/${l.id} has ${n}`).toBe(true);
        expect(sys.get('systemInfo')!.props.get('visible')!.value).toBe('false');
        if (l.grid) expect(sys.get('imagegrid')!.props.get('autoLayout')!.value).toBe(l.grid.autoLayout);
        else expect(sys.get('systemcarousel')!.props.get('type')!.value).toBe(l.carousel!.type);
        for (const e of sys.values()) {
          if (e.name === 'systemcarousel' || e.name === 'imagegrid' || !e.name.startsWith('ccs_')) continue;
          const pos = e.props.get('pos')?.value.split(' ').map(Number);
          const size = (e.props.get('size') ?? e.props.get('maxSize'))?.value.split(' ').map(Number);
          if (!pos || !size) continue;
          const [ox, oy] = (e.props.get('origin')?.value ?? '0 0').split(' ').map(Number);
          const x0 = pos[0] - ox * size[0];
          const y0 = pos[1] - oy * size[1];
          expect(x0 >= -0.001 && y0 >= -0.001 && x0 + size[0] <= 1.001 && y0 + size[1] <= 1.001, `${l.id}/${e.name} fits on screen`).toBe(true);
        }
      }
    }
    // Still one block for the system screen.
    expect(p.entry!.src.split('ChannelCraft layout preset (system)').length).toBe(2);
    expect(print(parse(p.entry!.src))).toBe(p.entry!.src);
  });

  it('swaps one design for another instead of stacking them', async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    applyChanges(p, designChanges(p, resolveTheme(p, env), DESIGNS[0], ctx(DESIGNS[0].id), ['detailed'], true));
    applyChanges(p, designChanges(p, resolveTheme(p, env), DESIGNS[1], ctx(DESIGNS[1].id), ['detailed'], true));
    expect(p.entry!.src.split('ChannelCraft layout preset (detailed)').length).toBe(2);
    expect(p.entry!.src).toContain(`[design-${DESIGNS[1].id}]`);
  });

  it('builds valid SVG artwork for every design', () => {
    for (const d of DESIGNS) {
      for (const [file, svg] of Object.entries(designAssets(d))) {
        const doc = parse(svg);
        expect(doc.root?.name, `${d.id}/${file}`).toBe('svg');
        expect(print(doc)).toBe(svg);
      }
    }
  });
});

const V5 = "M:\\Retrobat\\emulationstation\\.emulationstation\\themes\\Booga's WiiTheme v5";
describe.skipIf(!existsSync(V5))('a design on v5 (in memory)', () => {
  it('uses the theme’s own logos and hides its decorations', async () => {
    const p = await ThemeProject.load(V5, nodeFs);
    applyChanges(p, designChanges(p, resolveTheme(p, env), DESIGNS[0], ctx(DESIGNS[0].id, true), ['system', 'detailed'], true));
    const r = resolveTheme(p, env);
    const det = r.views.get('detailed')!.elements;
    expect(det.get('bottom-bar')!.props.get('visible')!.value).toBe('false');
    expect(det.get('logo')!.history.get('path')!.some((d) => d.value.includes('_inc/systems/logos/snes'))).toBe(true);
  });
});
