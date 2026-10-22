import { describe, expect, it } from 'vitest';
import { ThemeProject } from './project';
import { resolveTheme, romStem } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { applyChanges } from './edits';
import { EMPTY_GAME_FILE, gameEditChanges, gameExtrasChange, screensWithoutGameExtras } from './perGame';
import { join } from '../path';
import type { Environment } from './context';
import type { GameInfo } from './games';

const game = (path: string): GameInfo => ({ path, name: path, description: '', rating: 0, releasedate: '', developer: '', publisher: '', genre: '', players: '', playcount: '', lastplayed: '', gametime: '', favorite: false, media: {} });

const env = (g?: GameInfo): Environment => ({
  esHome: 'C:\\es',
  resourcesDir: 'C:\\es\\resources',
  settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
  game: g,
});

describe('per-game looks', () => {
  it('names files after the ROM without its extension', () => {
    expect(romStem('./Super Mario World (USA).sfc')).toBe('Super Mario World (USA)');
    expect(romStem('./roms/Game.v1.2.zip')).toBe('Game.v1.2');
    expect(romStem('./Folder Game/')).toBe('Folder Game');
  });

  it("lays a game's own file over the theme for that game only, the way RetroBat does", async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    const mario = env(game('./Mario World.sfc'));
    let res = resolveTheme(p, mario);
    const screens = screensWithoutGameExtras(res);
    expect(screens).toContain('detailed');
    applyChanges(p, [gameExtrasChange(p.entry!, screens)!]);
    res = resolveTheme(p, mario);
    const info = res.perGame.get('detailed')!;
    expect(info.root).toBe(join(p.dir, 'games', FALLBACK_SYSTEMS[0].name));
    expect(info.file).toBeNull();

    const before = res.views.get('detailed')!.elements.get('md_image')!.props.get('pos')?.value;
    const file = p.addFile(`games/${FALLBACK_SYSTEMS[0].name}/Mario World/theme.xml`, EMPTY_GAME_FILE);
    applyChanges(p, gameEditChanges(file, 'detailed', [
      { name: 'md_image', type: 'image', props: { pos: '0.1 0.2' } },
      { name: 'ccs_mario_bg', type: 'image', extra: true, props: { path: './bg.png' } },
    ]));
    res = resolveTheme(p, mario);
    const els = res.views.get('detailed')!.elements;
    expect(res.perGame.get('detailed')!.file).toBe(file);
    expect(els.get('md_image')!.props.get('pos')!.value).toBe('0.1 0.2');
    expect(els.get('ccs_mario_bg')!.extra).toBe('true');
    // The video screen and every other game keep the theme's own look.
    expect(res.views.get('video')!.elements.has('ccs_mario_bg')).toBe(false);
    const other = resolveTheme(p, env(game('./Zelda.sfc'))).views.get('detailed')!.elements;
    expect(other.get('md_image')!.props.get('pos')?.value).toBe(before);
    expect(other.has('ccs_mario_bg')).toBe(false);

    // A second change replaces the value instead of adding another one.
    applyChanges(p, gameEditChanges(file, 'detailed', [{ name: 'md_image', type: 'image', props: { pos: '0.3 0.3', size: '0.2 0.2' } }]));
    expect(file.src.match(/<pos>/g)).toHaveLength(1);
    expect(resolveTheme(p, mario).views.get('detailed')!.elements.get('md_image')!.props.get('size')!.value).toBe('0.2 0.2');
  });

  it("ignores what RetroBat draws once for the whole list", async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    const mario = env(game('./Mario World.sfc'));
    applyChanges(p, [gameExtrasChange(p.entry!, screensWithoutGameExtras(resolveTheme(p, mario)))!]);
    const res0 = resolveTheme(p, mario);
    const staticOne = [...res0.views.get('detailed')!.elements.values()].find((e) => !e.name.startsWith('md_') && !e.complex.length)!;
    const file = p.addFile(`games/${FALLBACK_SYSTEMS[0].name}/Mario World.xml`, `<theme><view name="detailed"><${staticOne.type} name="${staticOne.name}"><opacity>0.1</opacity></${staticOne.type}></view></theme>`);
    const res = resolveTheme(p, mario);
    expect(res.perGame.get('detailed')!.file).toBe(file);
    expect(res.perGameIgnored).toContainEqual({ view: 'detailed', name: staticOne.name });
    expect(res.views.get('detailed')!.elements.get(staticOne.name)!.props.get('opacity')?.value).not.toBe('0.1');
  });
});

describe('paths the way RetroBat reads them', () => {
  it('anchors only ./ paths to the theme file', async () => {
    const { resolvePath } = await import('./resolver');
    const e = env();
    expect(resolvePath('./../_inc/x.png', 'C:\\t\\games\\snes\\Mario', 'C:\\t', e)).toBe('C:\\t\\games\\snes\\_inc\\x.png');
    // A bare ../x (or x/y) is left to emulationstation.exe's folder (here C:\es's parent), so it
    // isn't the theme's file.
    expect(resolvePath('../_inc/x.png', 'C:\\t\\games\\snes\\Mario', 'C:\\t', e)).toBe('C:\\_inc\\x.png');
  });
});
