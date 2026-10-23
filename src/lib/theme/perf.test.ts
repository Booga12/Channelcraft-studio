// Timings on the installed themes (read-only), to keep editing responsive on big themes.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { parse } from '../xml/cst';
import type { Environment } from './context';

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
