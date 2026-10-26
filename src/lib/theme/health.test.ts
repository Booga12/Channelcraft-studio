import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { applyChanges } from './edits';
import { checkTheme } from './health';
import type { Environment } from './context';

const env = (home: string): Environment => ({
  esHome: home,
  resourcesDir: join(home, 'resources'),
  settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
});

const THEME = `<theme>
  <formatVersion>7</formatVersion>
  <view name="system">
    <image name="bg" extra="true"><pos>0 0</pos><size>1 1</size><path>./art/bg.png</path></image>
    <image name="logo" extra="true"><pos>0.1 0.1</pos><size>0.2 0.1</size><path>./pics/logo.png</path></image>
    <image name="cover" extra="true"><pos>0.5 0.5</pos><size>0.2 0.2</size><path>{game:image}</path></image>
    <image name="lost" extra="true"><pos>1.2 0.5</pos><size>0.1 0.1</size><path>./art/bg.png</path></image>
    <image name="flyin" extra="true"><pos>1.2 0.5</pos><size>0.1 0.1</size><path>./art/bg.png</path><storyboard event="activate"><animation property="x" from="1.2" to="0.5" duration="300" /></storyboard></image>
    <image name="hidden" extra="true"><pos>1.5 0.5</pos><size>0.1 0.1</size><visible>false</visible><path>./gone.png</path></image>
    <text name="title" extra="true"><pos>0.95 0.1</pos><size>0.2 0.05</size><text>Hi</text><fontPath>./fonts/none.ttf</fontPath></text>
  </view>
</theme>`;

async function load(xml: string) {
  const home = mkdtempSync(join(tmpdir(), 'ccs-health-'));
  const dir = join(home, 'themes', 'test');
  mkdirSync(join(dir, 'art'), { recursive: true });
  writeFileSync(join(dir, 'theme.xml'), xml);
  writeFileSync(join(dir, 'art', 'bg.png'), 'x');
  writeFileSync(join(dir, 'art', 'logo.png'), 'x');
  const p = await ThemeProject.load(dir, nodeFs);
  return { p, e: env(home) };
}

describe('theme health check', () => {
  it('finds missing files, fonts and parts off the screen, and nothing else', async () => {
    const { p, e } = await load(THEME);
    const issues = checkTheme(p, resolveTheme(p, e), e);
    const got = issues.map((i) => `${i.kind}:${i.element}`).sort();
    expect(got).toEqual(['cut-off:title', 'missing-file:logo', 'missing-font:title', 'off-screen:lost']);
    const logo = issues.find((i) => i.element === 'logo')!;
    expect(logo.fix?.label).toBe('Use the copy in the theme');
  });

  it('fixes each one so the check comes back clean', async () => {
    const { p, e } = await load(THEME);
    // All at once (Fix all), as one change: each fix is worked out on the theme as it was.
    applyChanges(p, checkTheme(p, resolveTheme(p, e), e).flatMap((i) => i.fix?.changes ?? []));
    expect(checkTheme(p, resolveTheme(p, e), e)).toEqual([]);
    const src = p.entry!.src;
    expect(src).toContain('<path>./art/logo.png</path>');
    expect(src).toContain('<pos>0.9 0.5</pos>');
    expect(src).toContain('<pos>0.8 0.1</pos>');
    expect(src).not.toContain('none.ttf');
  });

  it('finds nothing wrong in the starter theme', async () => {
    const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
    const e = env('M:\\none');
    expect(checkTheme(p, resolveTheme(p, e), e).map((i) => `${i.kind} ${i.element} ${i.text}`)).toEqual([]);
  });
});
