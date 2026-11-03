import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ThemeProject } from './project';
import { hasActivateStoryboard, resolveTheme } from './resolver';
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

const TEXTS = `<theme>
  <formatVersion>7</formatVersion>
  <variables><designAccent>6A2A80FF</designAccent><designAccentText>E0A0F0FF</designAccentText></variables>
  <view name="detailed">
    <text name="play" extra="true"><pos>0.1 0.1</pos><size>0.3 0.05</size><text>PLAY ▶ ★ {game:name}</text><fontPath>./a.ttf</fontPath></text>
    <video name="md_video"><pos>0.1 0.5</pos><size>0.3 0.3</size></video>
    <text name="under" extra="true"><pos>0.15 0.55</pos><size>0.2 0.05</size><text>Hi</text><zIndex>10</zIndex></text>
    <ninepatch name="ccs_panel" extra="true"><pos>0.5 0.1</pos><size>0.4 0.3</size><path>./panel.svg</path><color>3A1060FF</color><zIndex>5</zIndex></ninepatch>
    <text name="pink" extra="true"><pos>0.55 0.15</pos><size>0.3 0.05</size><text>Hi</text><color>6A2A90</color><zIndex>20</zIndex></text>
    <text name="accent" extra="true"><pos>0.55 0.25</pos><size>0.3 0.05</size><text>Hi</text><color>\${designAccent}</color><zIndex>20</zIndex></text>
    <text name="white" extra="true"><pos>0.55 0.32</pos><size>0.3 0.05</size><text>Hi</text><color>FFFFFF</color><zIndex>20</zIndex></text>
  </view>
</theme>`;

describe('checks on what texts show (#26)', () => {
  async function loadTexts() {
    const home = mkdtempSync(join(tmpdir(), 'ccs-health-'));
    const dir = join(home, 'themes', 'test');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'theme.xml'), TEXTS);
    writeFileSync(join(dir, 'a.ttf'), 'x');
    writeFileSync(join(dir, 'panel.svg'), '<svg/>');
    const p = await ThemeProject.load(dir, nodeFs);
    return { p, e: env(home) };
  }
  // The theme font has plain letters only; one of RetroBat's own fonts has ★, none has ▶.
  const chars = (abs: string) => (abs.endsWith('a.ttf') ? (cp: number) => cp < 128 : abs.includes('Pyeojin') ? (cp: number) => cp === 0x2605 : () => false);

  it("finds letters neither the font nor RetroBat's fonts have, game art over text, and colours too alike", async () => {
    const { p, e } = await loadTexts();
    const got = checkTheme(p, resolveTheme(p, e), e, chars).map((i) => `${i.kind}:${i.element}`).sort();
    expect(got).toEqual(['covered:under', 'hard-to-read:accent', 'hard-to-read:pink', 'missing-character:play']);
    const play = checkTheme(p, resolveTheme(p, e), e, chars).find((i) => i.element === 'play')!;
    expect(play.text).toContain('“▶”');
    expect(play.text).not.toContain('★');
  });

  it("says nothing about letters until RetroBat's fonts have been read", async () => {
    const { p, e } = await loadTexts();
    const loading = (abs: string) => (abs.endsWith('a.ttf') ? chars(abs) : undefined);
    expect(checkTheme(p, resolveTheme(p, e), e, loading).some((i) => i.kind === 'missing-character')).toBe(false);
    expect(checkTheme(p, resolveTheme(p, e), { ...e, resourcesDir: '' }, chars).some((i) => i.kind === 'missing-character')).toBe(false);
  });

  it("moves accent-coloured text to the accent's readable shade (#45)", async () => {
    const { p, e } = await loadTexts();
    const accent = checkTheme(p, resolveTheme(p, e), e, chars).find((i) => i.element === 'accent')!;
    expect(accent.fix?.label).toBe('Use the readable accent');
    applyChanges(p, accent.fix!.changes);
    expect(checkTheme(p, resolveTheme(p, e), e, chars).some((i) => i.element === 'accent')).toBe(false);
  });

  it('makes a hard-to-read colour readable', async () => {
    const { p, e } = await loadTexts();
    const pink = checkTheme(p, resolveTheme(p, e), e, chars).find((i) => i.element === 'pink')!;
    expect(pink.fix?.label).toBe('Make it readable');
    applyChanges(p, pink.fix!.changes);
    expect(p.entry!.src).toContain('<color>FFFFFF</color><zIndex>20</zIndex></text>\n    <text name="accent"');
    expect(checkTheme(p, resolveTheme(p, e), e, chars).some((i) => i.element === 'pink')).toBe(false);
  });
});

describe('video list game data (#59)', () => {
  const VIDEO = `<theme>
  <formatVersion>7</formatVersion>
  <view name="detailed,video">
    <image name="box" extra="true"><pos>0.5 0.5</pos><size>0.2 0.2</size><path>firstfile({game:boxart}, {game:thumbnail})</path></image>
    <image name="hover" extra="true"><pos>0.2 0.5</pos><size>0.2 0.2</size><path>{game:image}</path><storyboard><animation property="scale" from="1" to="1.02" duration="3200" mode="easeInOut" autoReverse="true" repeat="forever" /></storyboard></image>
    <image name="fades" extra="true"><pos>0.8 0.5</pos><size>0.2 0.2</size><path>{game:fanart}</path><storyboard event="activate"><animation property="opacity" from="0" to="1" duration="600" /></storyboard></image>
    <image name="plain" extra="true"><pos>0.8 0.2</pos><size>0.2 0.2</size><path>./art/bg.png</path></image>
  </view>
  <customView name="myvideo" inherits="video">
    <text name="fav" extra="true"><pos>0.1 0.1</pos><size>0.2 0.05</size><text>Favorite</text><visible>{game:favorite}</visible></text>
  </customView>
</theme>`;

  it('flags extras in the video list that show game data without an activate storyboard', async () => {
    const { p, e } = await load(VIDEO);
    const issues = checkTheme(p, resolveTheme(p, e), e).filter((i) => i.kind === 'not-updated');
    expect(issues.map((i) => `${i.element}:${i.views.join(',')}`).sort()).toEqual(['box:video,myvideo', 'fav:myvideo', 'hover:video,myvideo']);
  });

  it('fixes them so they update for each game, keeping a loop looping', async () => {
    const { p, e } = await load(VIDEO);
    applyChanges(p, checkTheme(p, resolveTheme(p, e), e).filter((i) => i.kind === 'not-updated').flatMap((i) => i.fix!.changes));
    const r = resolveTheme(p, e);
    expect(checkTheme(p, r, e).filter((i) => i.kind === 'not-updated')).toEqual([]);
    expect(p.entry!.src).toContain('<storyboard event="activate"><animation property="scale"');
    expect(p.entry!.src).toContain('<animation property="opacity" from="1" to="1" duration="1" />');
    for (const n of ['box', 'hover']) expect(hasActivateStoryboard(r.views.get('video')!.elements.get(n)!)).toBe(true);
  });
});
