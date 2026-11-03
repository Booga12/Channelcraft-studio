import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { retrobatClock } from './clock';
import type { Environment } from './context';

async function resolve(xml: string) {
  const home = mkdtempSync(join(tmpdir(), 'ccs-clock-'));
  const dir = join(home, 'themes', 'test');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'theme.xml'), xml);
  const env: Environment = {
    esHome: home,
    resourcesDir: join(home, 'resources'),
    settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
  };
  return resolveTheme(await ThemeProject.load(dir, nodeFs), env);
}

const theme = (screen: string, help = '') => `<theme><formatVersion>7</formatVersion><view name="screen">${screen}</view><view name="system">${help}</view></theme>`;
const val = (c: ReturnType<typeof retrobatClock>, k: string) => c?.el.props.get(k)?.value;

describe("RetroBat's own clock in the preview (#58)", () => {
  it('is placed by a text named clock on the Screen overlay', async () => {
    const c = retrobatClock(await resolve(theme('<text name="clock"><pos>0.97 0.035</pos><origin>1 0</origin><color>AABBCCFF</color></text>')));
    expect(c?.themed).toBe(true);
    expect(c?.el.type).toBe('clock');
    expect(val(c, 'pos')).toBe('0.97 0.035');
    expect(val(c, 'color')).toBe('AABBCCFF');
  });

  it('is hidden by a hidden text clock', async () => {
    expect(retrobatClock(await resolve(theme('<text name="clock"><visible>false</visible></text>')))).toBeNull();
  });

  it('stays at the bottom right when the overlay has a <clock> instead, as RetroBat draws it', async () => {
    const c = retrobatClock(await resolve(theme('<clock name="clock"><pos>0.97 0.035</pos></clock>')));
    expect(c?.themed).toBe(false);
    expect(val(c, 'pos')).toBe('0.94 0.944');
    expect(val(c, 'size')).toBe('0.05 0');
    expect(val(c, 'alignment')).toBe('right');
    expect(val(c, 'fontSize')).toBe('0.035');
    expect(val(c, 'color')).toBe('777777FF');
    expect(c?.el.props.has('fontPath')).toBe(false);
  });

  it("takes the console screen's button hints' colour and font, at RetroBat's medium size", async () => {
    const c = retrobatClock(await resolve(theme('', '<helpsystem name="help"><textColor>112233FF</textColor><fontPath>./a.ttf</fontPath></helpsystem>')));
    expect(c?.themed).toBe(false);
    expect(val(c, 'color')).toBe('112233FF');
    expect(val(c, 'fontPath')).toBe('./a.ttf');
    expect(c?.el.history.get('fontPath')?.[0].node.name).toBe('fontPath');
    expect(val(c, 'fontSize')).toBe('0.045');
    expect(val(c, 'pos')).toBe('0.94 0.929');
    const sized = retrobatClock(await resolve(theme('', '<helpsystem name="help"><fontSize>0.02</fontSize></helpsystem>')));
    expect(val(sized, 'fontSize')).toBe('0.02');
  });
});
