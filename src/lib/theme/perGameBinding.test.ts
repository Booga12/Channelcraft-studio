// A theme that picks each game's file with an expression (one4all4one / Hyperbat style):
// <gameextras><path>firstfile("…/" + stem({game:rom}) + "/theme.xml", "…/_default/theme.xml")</path>.
// Uses a real installed theme when present (read-only), and an in-memory copy of the idea always.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ThemeProject } from './project';
import { isOwnGamePath, resolveAsset, resolveTheme } from './resolver';
import { copyOfShared, ownFileGuards } from './perGame';
import { dirname } from '../path';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import type { Environment } from './context';
import type { GameInfo } from './games';
import { join } from '../path';

const game = (path: string): GameInfo => ({ path, name: path, description: '', rating: 0, releasedate: '', developer: '', publisher: '', genre: '', players: '', playcount: '', lastplayed: '', gametime: '', favorite: false, media: {} });
const snes = FALLBACK_SYSTEMS.find((s) => s.name === 'snes')!;
const env = (g: GameInfo): Environment => ({
  esHome: 'C:\\es',
  resourcesDir: 'C:\\es\\resources',
  settings: { system: snes, subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
  game: g,
});

const BOOGA = "M:\\Retrobat\\emulationstation\\.emulationstation\\themes\\Booga's ultimate theme";

describe('per-game files chosen by an expression', () => {
  it('tells a game’s own path from a shared one', () => {
    expect(isOwnGamePath('C:\\t\\_gametheme\\snes\\hyperbat\\Mario (USA)\\theme.xml', 'Mario (USA)')).toBe(true);
    expect(isOwnGamePath('C:\\t\\games\\snes\\Mario (USA).xml', 'Mario (USA)')).toBe(true);
    expect(isOwnGamePath('C:\\t\\_gametheme\\snes\\hyperbat\\_default\\theme.xml', 'Mario (USA)')).toBe(false);
  });

  it.skipIf(!existsSync(BOOGA))('follows the installed theme’s firstfile path: shared default, then the game’s own file', async () => {
    const p = await ThemeProject.load(BOOGA, nodeFs);
    const mario = env(game('./Mario Is Missing! (USA).zip'));
    const res = resolveTheme(p, mario);
    const info = [...res.perGame.values()].find((i) => i.binding);
    expect(info, 'a screen with an expression gameextras path').toBeTruthy();
    expect(info!.file?.rel).toMatch(/_gametheme\/snes\/hyperbat\/_default\/theme(-\d+)?\.xml$/);
    const own = info!.candidates.find((c) => isOwnGamePath(c, 'Mario Is Missing! (USA)') && /[\\/]theme\.xml$/i.test(c));
    expect(own).toBe(join(p.dir, '_gametheme', 'snes', 'hyperbat', 'Mario Is Missing! (USA)', 'theme.xml'));

    // Once the game has its own file, RetroBat uses that instead (firstfile picks it first).
    const rel = own!.slice(p.dir.length + 1).replace(/\\/g, '/');
    p.addFile(rel, `<theme><customView name="${info!.view}"><image name="ccs_test" extra="true"><pos>0.1 0.1</pos></image></customView></theme>`);
    const res2 = resolveTheme(p, mario);
    const info2 = res2.perGame.get(info!.view)!;
    expect(info2.file?.rel).toBe(rel);
    expect(res2.views.get(info!.view)!.elements.has('ccs_test')).toBe(true);
    // Another game still gets the console default.
    const other = resolveTheme(p, env(game('./Super Mario Kart (USA).zip'))).perGame.get(info!.view)!;
    expect(other.file?.rel).toMatch(/_default\/theme(-\d+)?\.xml$/);
  }, 120_000);

  it('copies a shared look for one game: paths rewritten, own-file guards kept visible', () => {
    const src = `<theme>\n  <customView name="hyperbat">\n    <image name="bg" extra="true">\n      <visible>\${noOwn}</visible>\n      <path>./Background.png</path>\n      <path>\${themePath}/x.png</path>\n    </image>\n    <video name="v" extra="true"><path>firstfile("./a.mp4", {game:video})</path></video>\n  </customView>\n</theme>\n`;
    const out = copyOfShared(src, 'C:\\t\\g\\snes\\_default', 'C:\\t\\g\\snes\\Mario', ['noOwn']);
    expect(out).toContain('<visible>true</visible>');
    expect(out).toContain('<path>../_default/Background.png</path>');
    expect(out).toContain('<path>${themePath}/x.png</path>');
    expect(out).toContain('firstfile("../_default/a.mp4", {game:video})');
    expect(out).toMatch(/<!-- This game's own look/);
  });

  it.skipIf(!existsSync(BOOGA))('a copied default looks the same for that game in the installed theme', async () => {
    const p = await ThemeProject.load(BOOGA, nodeFs);
    const mario = env(game('./Mario Is Missing! (USA).zip'));
    const res = resolveTheme(p, mario);
    const info = [...res.perGame.values()].find((i) => i.binding)!;
    const shared = info.file!;
    const visible = (r: typeof res) =>
      [...r.views.get(info.view)!.elements.values()]
        .filter((e) => !['false', '0'].includes((e.props.get('visible')?.value ?? '').trim()))
        .map((e) => e.name)
        .sort();
    const before = visible(res);
    const own = info.candidates.find((c) => isOwnGamePath(c, 'Mario Is Missing! (USA)') && /[\\/]theme\.xml$/i.test(c))!;
    const guards = ownFileGuards(res);
    expect(guards).toContain('IfnoextGamethemeexist');
    p.addFile(own.slice(p.dir.length + 1).replace(/\\/g, '/'), copyOfShared(shared.src, dirname(shared.abs), dirname(own), guards));
    const res2 = resolveTheme(p, mario);
    expect(res2.perGame.get(info.view)!.file!.abs).toBe(own);
    // The same parts show (only the default theme's author credit hides itself, as the theme intends).
    expect(visible(res2).filter((n) => n !== 'defaultthemeauthor')).toEqual(before.filter((n) => n !== 'defaultthemeauthor'));
    // Pictures the default used are still found from the new folder.
    const bezel = res2.views.get(info.view)!.elements.get('VideobezelDef')!;
    expect(bezel.props.get('path')!.raw).toBe('../_default/video.png');
    expect(resolveAsset(bezel.props.get('path'), res2, p, mario)).toBe(join(dirname(shared.abs), 'video.png'));
  }, 120_000);
});
