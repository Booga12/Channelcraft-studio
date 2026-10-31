import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { addElementChange, applyChanges, inverse } from './edits';
import { appliedLayout, LAYOUTS, layoutChanges, PALETTES, paletteCoverage } from './presets';
import { itemsFor, LIBRARY } from './library';
import type { Environment } from './context';

const ROOT = 'M:\\Retrobat';
const V5 = `${ROOT}\\emulationstation\\.emulationstation\\themes\\Booga's WiiTheme v5`;

const env: Environment = {
  esHome: `${ROOT}\\emulationstation\\.emulationstation`,
  resourcesDir: `${ROOT}\\emulationstation\\resources`,
  settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
};

describe('starter theme with presets (in memory)', () => {
  it('takes every palette colour and both layout kinds', async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    let r = resolveTheme(p, env);
    for (const pal of PALETTES) expect(paletteCoverage(pal, r)).toBe(Object.keys(pal.colors).length);
    const wheel = LAYOUTS.find((l) => l.id === 'wheel-right')!;
    const video = LAYOUTS.find((l) => l.id === 'videofocus')!;
    applyChanges(p, [...layoutChanges(p, r, wheel, ['system'])]);
    r = resolveTheme(p, env);
    applyChanges(p, layoutChanges(p, r, video, ['basic', 'detailed', 'video']));
    r = resolveTheme(p, env);
    expect(r.views.get('system')!.elements.get('systemcarousel')!.props.get('type')!.value).toBe('vertical_wheel');
    expect(r.views.get('video')!.elements.get('md_video')!.props.get('maxSize')!.value).toBe('0.6 0.56');
    expect(r.views.get('detailed')!.elements.has('md_video')).toBe(false);
    expect(r.unknownConditions).toBe(0);
  });
});

describe('plain game layouts (in memory)', () => {
  it('put RetroBat’s own labels in front of genre, developer and players', async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    const l = LAYOUTS.find((x) => x.id === 'showcase')!;
    applyChanges(p, layoutChanges(p, resolveTheme(p, env), l, ['detailed']));
    const els = resolveTheme(p, env).views.get('detailed')!.elements;
    for (const f of ['genre', 'developer', 'players']) {
      const lbl = els.get(`md_lbl_${f}`)!;
      const val = els.get(`md_${f}`)!;
      expect(lbl.props.get('visible')!.value, f).toBe('true');
      // No text of its own: RetroBat writes the label in its language.
      expect(lbl.props.has('text')).toBe(false);
      const [lx, ly] = lbl.props.get('pos')!.value.split(' ').map(Number);
      const [vx, vy] = val.props.get('pos')!.value.split(' ').map(Number);
      const lw = Number(lbl.props.get('size')!.value.split(' ')[0]);
      expect(ly).toBe(vy);
      expect(lx + lw).toBeLessThanOrEqual(vx + 0.001);
    }
  });
});

describe('system grid layouts (in memory)', () => {
  it('write an imagegrid with tile styles RetroBat understands', async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    for (const id of ['channel-grid', 'grid-wall', 'tile-row', 'big-tiles', 'cover-flow', 'wheel-left']) {
      const l = LAYOUTS.find((x) => x.id === id)!;
      applyChanges(p, layoutChanges(p, resolveTheme(p, env), l, ['system']));
      const sys = resolveTheme(p, env).views.get('system')!.elements;
      if (l.assets) {
        expect(sys.get('imagegrid')!.type).toBe('imagegrid');
        expect(sys.get('default')!.type).toBe('gridtile');
        expect(sys.get('selected')!.props.get('backgroundImage')!.value).toBe('./_inc/ccs/common/tile.svg');
        expect(sys.get('gridtile.image:selected')!.props.get('color')!.value).toBe('FFFFFFFF');
      } else {
        expect(sys.get('systemcarousel')!.props.get('maxLogoCount')).toBeTruthy();
      }
      expect(appliedLayout(p, 'system')).toBe(id);
    }
    // Swapping layouts kept a single block.
    expect(p.entry!.src.split('ChannelCraft layout preset (system)').length).toBe(2);
  });
});

describe('library', () => {
  it('offers game items on game screens and system items on the system screen', () => {
    const game = itemsFor('detailed').map((i) => i.id);
    const sys = itemsFor('system').map((i) => i.id);
    expect(game).toContain('boxart');
    expect(game).not.toContain('systemcarousel');
    expect(game).not.toContain('md_video');
    expect(itemsFor('video').map((i) => i.id)).toContain('md_video');
    expect(sys).toContain('systemname');
    expect(sys).not.toContain('boxart');
  });
});

// In-memory only: nothing is written to disk.
describe.skipIf(!existsSync(V5))('presets and library on v5 (in memory)', () => {
  it('applies a layout preset as a separate block, swaps it, and undoes cleanly', async () => {
    const p = await ThemeProject.load(V5, nodeFs);
    const entry = p.entry!;
    const original = entry.src;
    const classic = LAYOUTS.find((l) => l.id === 'classic')!;
    const mirrored = LAYOUTS.find((l) => l.id === 'mirrored')!;

    const a1 = applyChanges(p, layoutChanges(p, resolveTheme(p, env), classic, ['detailed']));
    let r = resolveTheme(p, env);
    expect(r.views.get('detailed')!.elements.get('gamelist')!.props.get('pos')!.value).toBe('0.52 0.13');
    expect(appliedLayout(p, 'detailed')).toBe('classic');
    // Everything before the preset block is untouched.
    expect(entry.src.startsWith(original.slice(0, original.lastIndexOf('</theme>')).trimEnd())).toBe(true);

    applyChanges(p, layoutChanges(p, r, mirrored, ['detailed']));
    r = resolveTheme(p, env);
    expect(appliedLayout(p, 'detailed')).toBe('mirrored');
    expect(r.views.get('detailed')!.elements.get('gamelist')!.props.get('pos')!.value).toBe('0.03 0.13');
    // Swapping replaced the block instead of adding a second one.
    expect(entry.src.split('ChannelCraft layout preset (detailed)').length).toBe(2);
    expect(a1.length).toBe(1);
  });

  it('round-trips a single preset exactly', async () => {
    const p = await ThemeProject.load(V5, nodeFs);
    const original = p.entry!.src;
    const applied = applyChanges(p, layoutChanges(p, resolveTheme(p, env), LAYOUTS[0], ['basic', 'detailed']));
    applyChanges(p, inverse(p, applied));
    expect(p.entry!.src).toBe(original);
  });

  it('adds library items wired to RetroBat data', async () => {
    const p = await ThemeProject.load(V5, nodeFs);
    for (const item of LIBRARY.filter((i) => !i.native && i.screens === 'game')) {
      applyChanges(p, [addElementChange(p, resolveTheme(p, env), 'detailed', item.type, item.name, item.body, true)]);
    }
    const v = resolveTheme(p, env).views.get('detailed')!;
    expect(v.elements.get('boxart')!.props.get('path')!.value).toBe('firstfile({game:boxart}, {game:thumbnail}, {game:image})');
    expect(v.elements.get('gametitle')!.props.get('text')!.value).toBe('{game:name}');
    expect(v.elements.get('favoritebadge')!.props.get('visible')!.value).toBe('{game:favorite}');
    expect(v.elements.get('boxart')!.extra).toBe('true');
  });
});
