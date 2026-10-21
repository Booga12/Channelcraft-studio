import { describe, expect, it } from 'vitest';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { addElementChange, applyChanges, type Change } from './edits';
import { designChanges } from './presets';
import { DESIGNS, designVars } from './designs';
import { colorSet, planMenuOptions, readMenuState, type MenuChoices } from './menuOptions';
import type { Environment } from './context';

const pixel = DESIGNS.find((d) => d.id === 'pixel')!;
const env = (subsets: Record<string, string> = {}): Environment => ({
  esHome: 'M:/Retrobat/emulationstation/.emulationstation',
  resourcesDir: 'M:/Retrobat/emulationstation/resources',
  settings: { system: { ...FALLBACK_SYSTEMS[0], name: 'snes', theme: 'snes' }, subsets, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
});

/** The starter with the Pixel design applied the way older versions did (fixed colours), plus a part of the user's own. */
async function themeLikeMine() {
  const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
  const ctx = { art: './_inc/ccs/pixel', font: './_inc/fonts/PressStart2P-Regular.ttf', titleFont: null, logos: null, consoles: null };
  applyChanges(p, designChanges(p, resolveTheme(p, env()), pixel, ctx, ['system', 'basic', 'detailed', 'video'], true, 'tile-row'));
  applyChanges(p, [addElementChange(p, resolveTheme(p, env()), 'system', 'video', 'video2', '<pos>0.1 0.4</pos>\n<path>{random}</path>')]);
  return p;
}

function apply(p: ThemeProject, choices: MenuChoices) {
  const plan = planMenuOptions(p, resolveTheme(p, env()), choices, pixel, 'tile-row', { pressstart: '_inc/fonts/PressStart2P-Regular.ttf' });
  const changes: Change[] = plan.changes(p);
  for (const [rel, xml] of Object.entries(plan.files)) {
    const f = p.fileAt(rel) ?? p.addFile(rel, '');
    changes.push({ file: f, patch: { start: 0, end: f.src.length, text: xml } });
  }
  applyChanges(p, changes);
  return plan;
}

const CHOICES: MenuChoices = { systemViews: ['tile-row', 'carousel-middle'], gameDesigns: ['pixel', 'cinema'], colorSets: ['d-pixel', 'p-neon'], motion: true };

describe('RetroBat menu options', () => {
  it('declares the options RetroBat lists in its Theme Configuration menu', async () => {
    const p = await themeLikeMine();
    const plan = apply(p, CHOICES);
    const r = resolveTheme(p, env());
    const names = Object.fromEntries(r.subsets.map((s) => [s.name, s.options.map((o) => o.name)]));
    expect(names.systemview).toEqual(['tile-row', 'carousel-middle']);
    expect(names.gamelistview).toEqual(['pixel', 'cinema']);
    expect(names.motion).toEqual(['on', 'off']);
    // Ours come first in Color set (the first is RetroBat's default), the starter's stay after.
    expect(names.colorset).toEqual(['ccs-d-pixel', 'ccs-p-neon', 'dark', 'light']);
    expect(readMenuState(p)).toMatchObject({ design: 'pixel', systemViews: ['tile-row', 'carousel-middle'] });
    // Artwork for each design in each colour set.
    expect(plan.art.map((a) => a.dir).sort()).toEqual(['_inc/ccs/art/cinema-d-pixel', '_inc/ccs/art/cinema-p-neon', '_inc/ccs/art/pixel-d-pixel', '_inc/ccs/art/pixel-p-neon']);
  });

  it('keeps the current screens exactly, edits and own parts included, with every style', async () => {
    const p = await themeLikeMine();
    const before = resolveTheme(p, env());
    apply(p, CHOICES);
    const after = resolveTheme(p, env());
    // Same elements and values on every screen (only artwork moved to the colour-set folder).
    for (const view of ['system', 'detailed']) {
      for (const [name, el] of before.views.get(view)!.elements) {
        for (const [k, def] of el.props) {
          const now = after.views.get(view)!.elements.get(name)?.props.get(k);
          expect(now, `${view} ${name}.${k}`).toBeDefined();
          if (k === 'path' || k === 'fontPath' || k === 'backgroundImage') continue;
          // The starter's own colour names now follow the default colour set (the design's colours).
          if (def.raw.includes('$' + '{')) continue;
          expect(now!.value, `${view} ${name}.${k}`).toBe(def.value);
        }
      }
    }
    // Fixed design colours became the shared ones.
    expect(after.views.get('detailed')!.elements.get('gamelist')!.props.get('primaryColor')!.raw).toBe('${designText}');
    // The user's own part stays in theme.xml, shown with the other console-screen style too.
    const other = resolveTheme(p, env({ systemview: 'carousel-middle' }));
    expect(other.views.get('system')!.elements.get('video2')!.defs.map((d) => d.file.rel)).toEqual(['theme.xml']);
    expect(other.views.get('system')!.elements.has('systemcarousel')).toBe(true);
  });

  it('switches colours and artwork with the colour set, and motion off removes animations', async () => {
    const p = await themeLikeMine();
    apply(p, CHOICES);
    const neon = colorSet('p-neon')!;
    const r = resolveTheme(p, env({ colorset: 'ccs-p-neon', gamelistview: 'cinema', motion: 'off' }));
    expect(r.vars.get('designAccent')!.value).toBe(designVars(neon.palette).designAccent);
    const bg = r.views.get('detailed')!.elements.get('ccs_background')!;
    expect(bg.props.get('path')!.value).toBe('../art/cinema-p-neon/background.png');
    expect(bg.props.get('path')!.file.rel).toBe('_inc/ccs/options/games-cinema.xml');
    for (const view of ['system', 'detailed'])
      for (const el of r.views.get(view)!.elements.values()) expect(el.complex.filter((c) => c.name === 'storyboard'), `${view} ${el.name}`).toEqual([]);
    // Motion on keeps them.
    const on = resolveTheme(p, env());
    expect(on.views.get('detailed')!.elements.get('ccs_boxart')!.complex.some((c) => c.name === 'storyboard')).toBe(true);
  });

  it('can be run again: kept styles keep their edits, new ones are added', async () => {
    const p = await themeLikeMine();
    apply(p, CHOICES);
    const kept = p.fileAt('_inc/ccs/options/system-tile-row.xml')!.src;
    const plan = apply(p, { ...CHOICES, systemViews: ['carousel-middle', 'tile-row', 'wheel-right'] });
    expect(plan.files['_inc/ccs/options/system-tile-row.xml']).toBeUndefined();
    expect(p.fileAt('_inc/ccs/options/system-tile-row.xml')!.src).toBe(kept);
    const r = resolveTheme(p, env());
    expect(r.subsets.find((s) => s.name === 'systemview')!.options.map((o) => o.name)).toEqual(['carousel-middle', 'tile-row', 'wheel-right']);
    expect(p.fileAt('_inc/ccs/options/system-wheel-right.xml')).toBeDefined();
    expect(p.entry!.src.split('ChannelCraft design colours').length).toBe(2);
    expect(p.entry!.src.split('<include name="ccs-d-pixel"').length).toBe(2);
  });
});
