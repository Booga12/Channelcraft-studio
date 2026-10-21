import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs, readTextFile } from './nodefs';
import { FALLBACK_SYSTEMS, parseEsSystems } from './systems';
import type { Environment, PreviewSettings } from './context';

const ROOT = 'M:\\Retrobat';
const ES_HOME = `${ROOT}\\emulationstation\\.emulationstation`;
const THEMES = `${ES_HOME}\\themes`;

function env(over: Partial<PreviewSettings> = {}): Environment {
  return {
    esHome: ES_HOME,
    resourcesDir: `${ROOT}\\emulationstation\\resources`,
    settings: {
      system: FALLBACK_SYSTEMS[0],
      subsets: {},
      lang: 'en',
      region: 'us',
      ratio: '16/9',
      tinyScreen: false,
      verticalScreen: false,
      helpPrompts: true,
      cheevos: false,
      ...over,
    },
  };
}

describe.skipIf(!existsSync(THEMES))('resolver on installed themes (read-only)', () => {
  it('summarizes every theme', async () => {
    for (const name of ['Booga\'s WiiTheme v5', 'es-theme-carbon', 'Alekfull-ARTFLIX', 'BatWiiCera-theme', 'es-theme-RELOAD-']) {
      const p = await ThemeProject.load(`${THEMES}\\${name}`, nodeFs);
      const r = resolveTheme(p, env());
      const views = [...r.views.values()].map((v) => `${v.name}(${v.elements.size})`).join(' ');
      console.log(`${name}: files=${p.files.size} used=${r.usedFiles.size} vars=${r.vars.size} subsets=${r.subsets.map((s) => `${s.name}=${s.selected}[${s.options.length}]`).join(' ')} unknown=${r.unknownConditions} missing=${r.missing.length}\n  views: ${views}`);
      expect(r.views.size).toBeGreaterThan(0);
    }
  }, 30_000);

  const V5 = `${THEMES}\\Booga's WiiTheme v5`;

  it('merges v5 elements across views and applies subset-conditional properties', async () => {
    const p = await ThemeProject.load(V5, nodeFs);
    const classic = resolveTheme(p, env());
    expect(classic.unknownConditions).toBe(0);
    const sysBar = classic.views.get('system')!.elements.get('bottom-bar')!;
    // Shared view sets 0 0.722, then the system view overrides it.
    expect(sysBar.history.get('pos')!.map((d) => d.value)).toEqual(['0 0.722', '0 0.65']);
    expect(sysBar.props.get('pos')!.value).toBe('0 0.65');
    expect(sysBar.props.get('pos')!.file.rel).toBe('theme.xml');
    const detBar = classic.views.get('detailed')!.elements.get('bottom-bar')!;
    expect(detBar.props.get('pos')!.value).toBe('0 0.78');
    expect(detBar.defs.length).toBe(2);
    expect(detBar.props.get('path')!.value).toBe('./_inc/images/bottom-bar-flat.svg');

    const dark = resolveTheme(p, env({ subsets: { colorset: 'dark' } }));
    expect(dark.views.get('detailed')!.elements.get('bottom-bar')!.props.get('path')!.value).toBe('./_inc/images/bottom-bar-flat-dark.svg');
    const tp = dark.vars.get('textPrimary')!;
    expect(tp.value).toBe('E6E6E6FF');
    expect(tp.file.rel).toBe('_inc/colors/dark.xml');
    const help = dark.views.get('system')!.elements.get('help')!;
    expect(help.props.get('textColor')!.raw).toBe('${textSecondary}');
    expect(help.props.get('textColor')!.value).toBe('B8B8B8FF');
  });

  it('evaluates per-system conditional variables', async () => {
    const p = await ThemeProject.load(V5, nodeFs);
    const sony = FALLBACK_SYSTEMS.find((x) => x.name === 'psx')!;
    expect(resolveTheme(p, env()).vars.get('consoleAccent')!.value).toBe('B50D1BFF');
    expect(resolveTheme(p, env({ system: sony })).vars.get('consoleAccent')!.value).toBe('064E92FF');
  });

  it('reads es_systems.cfg', () => {
    const systems = parseEsSystems(readTextFile(`${ES_HOME}\\es_systems.cfg`).text);
    const snes = systems.find((s) => s.name === 'snes');
    console.log(`${systems.length} systems; snes=`, snes);
    expect(systems.length).toBeGreaterThan(50);
  });
});

describe('control blocks', () => {
  it('change shared settings without changing the element type, as RetroBat does', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'ccs-control-'));
    writeFileSync(
      join(dir, 'theme.xml'),
      '<theme><formatVersion>7</formatVersion><view name="detailed"><image name="art" extra="true"><path>a.png</path></image><text name="t" extra="true"><text>x</text></text><control name="art, t, newone"><pos>0.1 0.2</pos></control></view></theme>',
    );
    const p = await ThemeProject.load(dir, nodeFs);
    const v = resolveTheme(p, env()).views.get('detailed')!;
    expect(v.elements.get('art')!.type).toBe('image');
    expect(v.elements.get('t')!.type).toBe('text');
    expect(v.elements.get('art')!.props.get('pos')!.value).toBe('0.1 0.2');
    expect(v.elements.get('newone')!.type).toBe('control');
  });
});
