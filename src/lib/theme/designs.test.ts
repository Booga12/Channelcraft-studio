import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { applyChanges } from './edits';
import { appliedGameLayout, appliedSystemLayout, designChanges, designVarsChange } from './presets';
import { GAME_LAYOUTS } from './gameLayouts';
import { SYSTEM_LAYOUTS, systemLayout } from './systemLayouts';
import { DESIGNS, DESIGN_GROUPS, DETAIL_LABELS, designAssets, designElements, designVars, recoloured, type DesignContext, type DesignEl } from './designs';
import { BACKGROUNDS } from './designArt';
import { catalogFont } from './fonts';
import { ANIMATIONS } from './animations';
import { parse, print } from '../xml/cst';
import { renderText } from './expr';
import type { Environment } from './context';

const env: Environment = {
  esHome: 'M:\\Retrobat\\emulationstation\\.emulationstation',
  resourcesDir: 'M:\\Retrobat\\emulationstation\\resources',
  settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
};

const ctx = (id: string, logos = false): DesignContext => ({ art: `./_inc/ccs/${id}`, font: './_inc/fonts/x.ttf', titleFont: null, logos: logos ? './_inc/systems/logos' : null, consoles: null });

const GAME_DATA = ['md_image', 'ccs_boxart', 'md_marquee', 'ccs_fanart', 'ccs_title', 'md_description', 'md_rating', 'md_releasedate', 'md_genre', 'md_developer', 'md_players', 'md_lbl_genre', 'md_lbl_developer', 'md_lbl_players', 'ccs_favorite', 'gamelist', 'logo', 'help'];
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
        expect(sys.get('default')!.props.get('backgroundImage')!.value).toContain(`ccs/${d.id}/tile.svg`);
        // The selected tile is a ring and glow in the accent colour, not a flat fill.
        expect(sys.get('selected')!.props.get('backgroundImage')!.value).toContain(`ccs/${d.id}/tile-selected.svg`);
        expect(designAssets(d)['tile-selected.svg']).toContain('stroke-width="5"');
      } else {
        expect(sys.has('systemcarousel')).toBe(true);
      }
      expect(sys.get('ccs_systemname')!.props.get('text')!.value).toBe('{system:fullName}');
      // Written the way RetroBat reads it: {random:...} art (not firstfile), the count as text, PNG backgrounds.
      expect(sys.get('ccs_systemart')!.props.get('path')!.value).toMatch(/^\{random:(fanart|image)\}$/);
      expect(renderText(sys.get('ccs_systemcount')!.props.get('text')!.value, { binding: (n) => (n === 'system:total' ? 2 : undefined), exists: () => false })).toBe('2 games');
      expect(sys.get('staticBackground')!.props.get('path')!.value).toMatch(/background\.png$/);
      expect(p.entry!.src).not.toContain('{system:random');
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
   }, 60_000);

  it('every design works with every game layout, with all the game data on screen', async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    for (const d of DESIGNS) {
      for (const g of GAME_LAYOUTS) {
        applyChanges(p, designChanges(p, resolveTheme(p, env), d, ctx(d.id), ['detailed', 'video'], true, undefined, { gameLayout: g.id }));
        expect(appliedGameLayout(p, 'detailed')).toBe(g.id);
        for (const v of ['detailed', 'video']) {
          const els = resolveTheme(p, env).views.get(v)!.elements;
          for (const n of GAME_DATA) {
            const name = v === 'video' && n === 'md_image' ? 'md_video' : n;
            expect(els.has(name), `${d.id}/${g.id}/${v} has ${name}`).toBe(true);
          }
          for (const e of els.values()) {
            if (!e.name.startsWith('ccs_') && !e.name.startsWith('md_') && e.name !== 'gamelist' && e.name !== 'logo') continue;
            const pos = e.props.get('pos')?.value.split(' ').map(Number);
            const size = (e.props.get('size') ?? e.props.get('maxSize'))?.value.split(' ').map(Number);
            // The reflection hangs off the bottom on purpose, fading out.
            if (!pos || !size || e.props.get('visible')?.value === 'false' || e.name === 'ccs_reflection') continue;
            const [ox, oy] = (e.props.get('origin')?.value ?? '0 0').split(' ').map(Number);
            const x0 = pos[0] - ox * size[0];
            const y0 = pos[1] - oy * size[1];
            expect(x0 >= -0.001 && y0 >= -0.001 && x0 + size[0] <= 1.001 && y0 + size[1] <= 1.001, `${d.id}/${g.id}/${v}/${e.name} fits on screen (${pos} ${size})`).toBe(true);
          }
        }
      }
    }
    expect(p.entry!.src.split('ChannelCraft layout preset (detailed)').length).toBe(2);
  }, 120_000);

  it('swaps one design for another instead of stacking them', async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    applyChanges(p, designChanges(p, resolveTheme(p, env), DESIGNS[0], ctx(DESIGNS[0].id), ['detailed'], true));
    applyChanges(p, designChanges(p, resolveTheme(p, env), DESIGNS[1], ctx(DESIGNS[1].id), ['detailed'], true));
    expect(p.entry!.src.split('ChannelCraft layout preset (detailed)').length).toBe(2);
    expect(p.entry!.src).toContain(`[design-${DESIGNS[1].id}]`);
  });

  it('every design is filed in a group, with fonts, animations and artwork that exist', () => {
    expect(DESIGNS.length).toBeGreaterThanOrEqual(43);
    expect(new Set(DESIGNS.map((d) => d.id)).size).toBe(DESIGNS.length);
    const turning = new Set(['swing-in', 'tilt-in', 'sway', 'swing', 'spin']);
    for (const g of DESIGN_GROUPS) expect(DESIGNS.filter((d) => d.group === g.id).length, g.id).toBeGreaterThanOrEqual(3);
    for (const d of DESIGNS) {
      expect(DESIGN_GROUPS.some((g) => g.id === d.group), d.id).toBe(true);
      for (const f of [d.font, d.titleFont].filter(Boolean)) expect(catalogFont(f!), `${d.id} font ${f}`).toBeTruthy();
      for (const a of Object.values(d.anims ?? {})) expect(ANIMATIONS.some((x) => x.id === a), `${d.id} anim ${a}`).toBe(true);
      expect(BACKGROUNDS).toContain(d.background);
      // A turning animation would undo the tilt.
      if (d.tilt) for (const role of ['art', 'title'] as const) expect(turning.has(d.anims?.[role] ?? ''), `${d.id} ${role}`).toBe(false);
      const files = designAssets(d);
      expect(!!files['deco.png']).toBe(!!d.deco);
      const els = designElements(d, ctx(d.id), 'detailed');
      expect(els.some((e) => e.name === 'ccs_deco')).toBe(!!d.deco);
      // Tilted: the design's own angle, or the one its layout sets (cards, stickers).
      if (d.tilt) expect(els.find((e) => e.name === 'ccs_boxart')!.props.rotation).toBeTruthy();
      expect(els.find((e) => e.name === 'ccs_reflection')?.props.rotation).toBeUndefined();
    }
  });

  it('labels every game detail, without labels, values or the block running into anything', () => {
    const DETAILS = new Set(['md_rating', 'md_releasedate', 'md_genre', 'md_developer', 'md_players', 'ccs_favorite', ...DETAIL_LABELS]);
    // Parts the details must stay clear of (decorations and panels may sit behind them).
    const NEIGHBOURS = ['md_description', 'ccs_title', 'md_image', 'md_video', 'ccs_boxart', 'md_marquee', 'gamelist', 'logo', 'ccs_vs'];
    type Box = [number, number, number, number];
    const nums = (v: unknown) => String(v ?? '0 0').split(' ').map(Number);
    const box = (e: DesignEl): Box => {
      const [x, y] = nums(e.props.pos);
      const [w, h] = nums(e.props.size ?? e.props.maxSize);
      const [ox, oy] = nums(e.props.origin ?? '0 0');
      return [x - ox * w, y - oy * h, w, h];
    };
    const meets = (a: Box, b: Box) => a[0] < b[0] + b[2] - 0.001 && b[0] < a[0] + a[2] - 0.001 && a[1] < b[1] + b[3] - 0.001 && b[1] < a[1] + a[3] - 0.001;
    // The widest label RetroBat writes in English, "Developer: ", at a generous character width.
    const developerW = (fs: number, font: string) => 11 * (['pressstart', 'silkscreen'].includes(font) ? 1 : 0.58) * fs * (9 / 16);
    for (const d of DESIGNS) {
      for (const g of GAME_LAYOUTS) {
        for (const view of ['detailed', 'grid', 'gamecarousel']) {
          const els = designElements(d, ctx(d.id), view, undefined, g.id);
          const at = (n: string) => els.find((e) => e.name === n)!;
          const where = `${d.id}/${g.id}/${view}`;
          for (const n of DETAIL_LABELS) {
            const e = at(n);
            expect(e?.type, `${where} ${n}`).toBe('text');
            expect(e.props.visible).toBe('true');
            // RetroBat fills the label in itself, in its own language.
            expect(e.props.text).toBeUndefined();
          }
          const rows: [string, string][] = [['md_lbl_genre', 'md_genre'], ['md_lbl_developer', 'md_developer'], ['md_lbl_players', 'md_players']];
          for (const [l, v] of rows) {
            const lb = box(at(l));
            const vb = box(at(v));
            expect(lb[1], `${where} ${l} on its value's row`).toBe(vb[1]);
            expect(meets(lb, vb), `${where} ${l} clear of ${v}`).toBe(false);
            expect(Number(at(l).props.fontSize)).toBeLessThan(Number(at(v).props.fontSize));
            // The label column fits "Developer: " unless the block is too narrow, where RetroBat cuts it with "...".
            const narrow = box(at('md_genre'))[0] + box(at('md_genre'))[2] - lb[0] < 0.2;
            if (!narrow && !['pressstart', 'silkscreen'].includes(d.font)) expect(lb[2], `${where} ${l} wide enough`).toBeGreaterThanOrEqual(developerW(Number(at(l).props.fontSize), d.font));
          }
          expect(meets(box(at('md_players')), box(at('ccs_favorite'))), `${where} favourite clear of players`).toBe(false);
          // Rows don't overlap each other.
          for (let i = 1; i < rows.length; i++) expect(box(at(rows[i][0]))[1]).toBeGreaterThanOrEqual(box(at(rows[i - 1][0]))[1] + box(at(rows[i - 1][0]))[3] - 0.001);
          // The whole block: on screen, above the help prompts, clear of what's around it.
          const parts = els.filter((e) => DETAILS.has(e.name) && e.props.size).map(box);
          const left = Math.min(...parts.map((b) => b[0]));
          const top = Math.min(box(at('md_rating'))[1], ...parts.map((b) => b[1]));
          const right = Math.max(...parts.map((b) => b[0] + b[2]));
          const bottom = Math.max(...parts.map((b) => b[1] + b[3]));
          expect(left >= 0 && right <= 1.001 && bottom <= 0.95, `${where} details on screen (${left} ${top} ${right} ${bottom})`).toBe(true);
          const block: Box = [left, top, right - left, bottom - top];
          for (const n of NEIGHBOURS) {
            const e = els.find((x) => x.name === n);
            if (!e || e.props.visible === 'false' || !(e.props.size ?? e.props.maxSize)) continue;
            expect(meets(block, box(e)), `${where} details clear of ${n} (${block} vs ${box(e)})`).toBe(false);
          }
        }
      }
    }
  });

  it('puts arrows beside the big logo only in the arrows layout', () => {
    const d = DESIGNS[0];
    const names = (l: string) => designElements(d, ctx(d.id), 'system', l).map((e) => e.name);
    expect(names('big-arrows')).toEqual(expect.arrayContaining(['ccs_arrow_left', 'ccs_arrow_right']));
    expect(names('carousel-middle')).not.toContain('ccs_arrow_left');
  });

  it('a palette keeps the design’s second accent only while the accent is its own', () => {
    const d = DESIGNS.find((x) => x.accent2)!;
    expect(recoloured(d, d.palette).accent2).toBe(d.accent2);
    expect(recoloured(d, { ...d.palette, accent: '123456' }).accent2).toBeUndefined();
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

describe('design colours as shared variables', () => {
  it('looks exactly the same through the variables, for every design and screen', async () => {
    for (const d of DESIGNS) {
      const fixed = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
      applyChanges(fixed, designChanges(fixed, resolveTheme(fixed, env), d, ctx(d.id), ['system', 'detailed'], true));
      const shared = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
      applyChanges(shared, [designVarsChange(shared, d), ...designChanges(shared, resolveTheme(shared, env), d, { ...ctx(d.id), vars: true }, ['system', 'detailed'], true)]);
      const a = resolveTheme(fixed, env);
      const b = resolveTheme(shared, env);
      for (const view of ['system', 'detailed']) {
        for (const [name, el] of a.views.get(view)!.elements) {
          for (const [k, def] of el.props) expect(b.views.get(view)!.elements.get(name)!.props.get(k)!.value, `${d.id} ${view} ${name}.${k}`).toBe(def.value);
        }
      }
      // The colours are linked: the gamelist's text colour is the shared designText.
      const list = b.views.get('detailed')!.elements.get('gamelist')!.props.get('primaryColor')!;
      expect(list.raw).toBe('${designText}');
    }
  });

  it('replaces its own colours block when another design is applied', async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    applyChanges(p, [designVarsChange(p, DESIGNS[0])]);
    applyChanges(p, [designVarsChange(p, DESIGNS[1])]);
    expect(p.entry!.src.split('ChannelCraft design colours').length).toBe(2);
    expect(resolveTheme(p, env).vars.get('designAccent')!.value).toBe(designVars(DESIGNS[1].palette).designAccent);
  });
});
