// Every file a theme names must be found the way RetroBat looks it up (FileSystemUtil::
// resolveRelativePath): ./x from the file it is in, ${themePath}/x, ~/x, :/x or absolute. Checks the
// themes ChannelCraft made on this PC (read-only; skipped when they're not there).
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ThemeProject } from './project';
import { resolveTheme, resolvePath } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { dirname } from '../path';
import type { Environment } from './context';
import type { GameInfo } from './games';

const THEMES = 'M:\\Retrobat\\emulationstation\\.emulationstation\\themes';
const MADE_HERE = ['test claude', 'claude theme test v1', 'claude theme test v2'];
const FOUND = MADE_HERE.filter((t) => existsSync(`${THEMES}\\${t}\\theme.xml`));
const ES_HOME = 'M:\\Retrobat\\emulationstation\\.emulationstation';

const game = (path: string): GameInfo => ({ path, name: path, description: '', rating: 0, releasedate: '', developer: '', publisher: '', genre: '', players: '', playcount: '', lastplayed: '', gametime: '', favorite: false, media: {} });
const env = (g?: GameInfo, subsets: Record<string, string> = {}): Environment => ({
  esHome: ES_HOME,
  resourcesDir: 'M:\\Retrobat\\emulationstation\\resources',
  settings: { system: FALLBACK_SYSTEMS[0], subsets, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
  game: g,
});

/** Path-like property values ChannelCraft writes (not data bindings, expressions or variables). */
const PATH_PROPS = /^(path|default|fontPath|filledPath|unfilledPath|selectorImagePath|scrollSound|backgroundImage|gameImage|folderImage)$/;

describe.each(MADE_HERE.filter((t) => existsSync(`${THEMES}\\${t}\\theme.xml`)))('%s: every file it names is found by RetroBat', (name) => {
  it('on every screen, with and without a game of its own', async () => {
    const p = await ThemeProject.load(`${THEMES}\\${name}`, nodeFs);
    const problems: string[] = [];
    let checked = 0;
    // Every theme option choice (RetroBat menu options load different files), with and without games.
    const choices: Record<string, string>[] = [{}];
    for (const sub of resolveTheme(p, env()).subsets) for (const o of sub.options) choices.push({ [sub.name]: o.name });
    const runs = choices.flatMap((c) => [undefined, game('./Super Mario Kart (USA).zip'), game('./Mario Is Missing! (USA).zip')].map((g) => env(g, c)));
    for (const e of runs) {
      const res = resolveTheme(p, e);
      for (const inc of res.includes) if (!inc.to) problems.push(`include ${inc.path} in ${inc.from.rel}`);
      for (const [view, v] of res.views)
        for (const el of v.elements.values())
          for (const [prop, h] of el.history) {
            if (!PATH_PROPS.test(prop)) continue;
            // RetroBat uses the first existing <path> among siblings in one definition.
            const groups = new Map<unknown, typeof h>();
            for (const d of h) groups.set(d.node.parent, [...(groups.get(d.node.parent) ?? []), d]);
            for (const group of groups.values()) {
              const tried: string[] = [];
              let found = false;
              for (const d of group) {
                const raw = d.raw.trim();
                // Data bindings and expressions aren't single files; ${variables} are filled in.
                if (!raw || /\{[^}]*:|\(/.test(raw.replace(/\$\{[^}]*\}/g, '')) || raw.startsWith(':/')) { found = true; continue; }
                if (/^\.\.[\/]/.test(raw)) problems.push(`${view}.${el.name} ${prop}: "${raw}" starts with ../ (${d.file.rel})`);
                checked++;
                const abs = resolvePath(d.value.trim(), dirname(d.file.abs), p.dir, e);
                if (!p.isInside(abs) || p.hasFile(abs) || p.file(abs)) found = true;
                else tried.push(d.value.trim());
              }
              if (!found) problems.push(`${JSON.stringify(e.settings.subsets)} ${view}.${el.name} ${prop}: none found of ${tried.join(', ')} (${group[0].file.rel})`);
            }
          }
    }
    expect(checked).toBeGreaterThan(20);
    expect([...new Set(problems)]).toEqual([]);
  }, 120_000);
});
