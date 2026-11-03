import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ThemeProject } from './project';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { checkEsde, esdeFolder, toEsde } from './esde';
import type { Environment } from './context';

const listDir = async (dir: string) => {
  try {
    return readdirSync(dir, { withFileTypes: true }).map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
  } catch {
    return [];
  }
};

function envFor(esHome: string): Environment {
  return {
    esHome,
    resourcesDir: join(esHome, '..', 'resources'),
    settings: { system: FALLBACK_SYSTEMS.find((s) => s.name === 'snes')!, subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
  };
}

const THEME = `<theme>
  <formatVersion>7</formatVersion>
  <view name="system">
    <image name="logo"><path>./art/logos/\${system.theme}.png</path></image>
    <text name="logoText"><fontPath>./fonts/a.ttf</fontPath><color>FFFFFF</color><forceUppercase>true</forceUppercase></text>
    <carousel name="systemcarousel"><type>horizontal_wheel</type><pos>0 0.4</pos><size>1 0.2</size><logoSize>0.2 0.1</logoSize><maxLogoCount>3</maxLogoCount><color>00000080</color></carousel>
    <text name="title" extra="true"><text>My consoles</text><pos>0.1 0.05</pos><size>0.8 0.05</size><fontPath>./fonts/a.ttf</fontPath><forceUppercase>true</forceUppercase></text>
    <text name="sub" extra="true"><text>\${system.sortedBy}</text><pos>0 0</pos></text>
    <text name="count" extra="true"><text>\${system.fullName}</text><pos>0 0.9</pos></text>
    <screenshader name="blur" extra="true"><path>:/shaders/blur.glsl</path></screenshader>
  </view>
  <view name="detailed">
    <textlist name="gamelist"><pos>0.05 0.2</pos><size>0.45 0.7</size><selectorColor>4060a0</selectorColor><primaryColor>C0C0C0</primaryColor><forceUppercase>1</forceUppercase><alignment>left</alignment><selectorOffsetY>0.01</selectorOffsetY></textlist>
    <image name="md_image"><pos>0.75 0.4</pos><maxSize>0.4 0.4</maxSize><origin>0.5 0.5</origin></image>
    <text name="md_description"><pos>0.55 0.7</pos><size>0.4 0.2</size><color>DDDDDD</color></text>
    <text name="md_lbl_developer"><pos>0.55 0.6</pos></text>
    <datetime name="md_releasedate"><pos>0.55 0.65</pos><format>%Y</format></datetime>
    <image name="md_favorite"><pos>0.9 0.9</pos><path>./art/fav.png</path></image>
    <image name="bg" extra="true"><path>./art/bg.png</path><pos>0 0</pos><size>1 1</size><zIndex>1</zIndex></image>
    <image name="gone" extra="true"><path>./art/bg.png</path><visible>false</visible></image>
    <text name="byline" extra="true"><text>{game:developer}</text><pos>0.1 0.1</pos></text>
  </view>
  <view name="video">
    <video name="md_video"><pos>0.7 0.4</pos><maxSize>0.4 0.4</maxSize><delay>1</delay><showSnapshotNoVideo>true</showSnapshotNoVideo></video>
  </view>
</theme>`;

function makeTheme(): { root: string; dir: string } {
  const root = mkdtempSync(join(tmpdir(), 'ccs-esde-'));
  const dir = join(root, 'themes', 'My Theme');
  const files: Record<string, string> = {
    'theme.xml': THEME,
    'art/logos/snes.png': 'png',
    'art/logos/nes.png': 'png',
    'art/logos/readme.txt': 'not a logo',
    'art/bg.png': 'png',
    'art/fav.png': 'png',
    'fonts/a.ttf': 'ttf',
  };
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return { root, dir };
}

describe('Export for ES-DE', () => {
  it('names the folder the way ES-DE themes are named', () => {
    expect(esdeFolder('My Theme')).toBe('my-theme-es-de');
    expect(esdeFolder('cool-es-de')).toBe('cool-es-de');
    expect(esdeFolder('  ')).toBe('theme-es-de');
  });

  it('converts screens, parts and files', async () => {
    const { root, dir } = makeTheme();
    try {
      const p = await ThemeProject.load(dir, nodeFs);
      const out = await toEsde(p, envFor(join(root)), listDir);
      const theme = out.files.find((f) => f.dest.endsWith('/theme.xml'))!.text!;
      const caps = out.files.find((f) => f.dest.endsWith('/capabilities.xml'))!.text!;
      const copied = out.files.filter((f) => f.src).map((f) => f.dest).sort();

      expect(out.folder).toBe('my-theme-es-de');
      expect(out.variants.map((v) => v.name)).toEqual(['detailed', 'video']);
      expect(caps).toContain('<themeName>My Theme</themeName>');
      expect(caps).toContain('<variant name="detailed">');
      expect(checkEsde(theme)).toEqual([]);

      // Console list: logos per console, the carousel's text from logoText.
      expect(theme).toContain('<staticImage>./art/logos/${system.theme}.png</staticImage>');
      expect(theme).toContain('<type>horizontalWheel</type>');
      expect(theme).toContain('<itemSize>0.2 0.1</itemSize>');
      expect(theme).toContain('<systemdata>fullname</systemdata>');
      expect(theme).not.toContain('sortedBy');
      expect(copied).toEqual(['my-theme-es-de/art/bg.png', 'my-theme-es-de/art/logos/nes.png', 'my-theme-es-de/art/logos/snes.png', 'my-theme-es-de/fonts/a.ttf']);

      // Game list: details, art and labels.
      expect(theme).toContain('<variant name="detailed">');
      expect(theme).toContain('<metadata>description</metadata>');
      expect(theme).toContain('<metadata>developer</metadata>');
      expect(theme).toContain('<imageType>miximage, screenshot</imageType>');
      expect(theme).toContain('<text>Developer:</text>');
      expect(theme).toContain('<datetime name="md_releasedate">');
      expect(theme).toContain('<selectorVerticalOffset>0.01</selectorVerticalOffset>');
      expect(theme).toContain('<letterCase>uppercase</letterCase>');
      expect(theme).toContain('<selectorColor>4060A0</selectorColor>');
      expect(theme).not.toContain('name="gone"');
      expect(theme).not.toContain('md_favorite');
      expect(theme).toContain('<video name="md_video">');

      // What couldn't come along is said.
      expect(out.notes.join('\n')).toMatch(/status icons/);
      expect(out.notes.join('\n')).toMatch(/1 blur or screen effect\b/);
      const readme = out.files.find((f) => f.dest.endsWith('CONVERSION-NOTES.txt'))!.text!;
      expect(readme).toContain('Detailed, Video');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // #56: logos as RetroBat finds them: an .svg, else a .png; the previewed console may have neither.
  function logoTheme(files: string[], paths = ['./logos/${system.theme}.svg', './logos/${system.theme}.png']): { root: string; dir: string } {
    const root = mkdtempSync(join(tmpdir(), 'ccs-esde-logos-'));
    const dir = join(root, 'themes', 'Logos');
    const xml = `<theme><formatVersion>7</formatVersion><view name="system">
      <image name="logo">${paths.map((x) => `<path>${x}</path>`).join('')}</image>
      <carousel name="systemcarousel"><type>horizontal</type></carousel></view></theme>`;
    mkdirSync(join(dir, 'logos'), { recursive: true });
    writeFileSync(join(dir, 'theme.xml'), xml);
    for (const f of files) {
      const at = f.includes('/') ? join(dir, f) : join(dir, 'logos', f);
      mkdirSync(dirname(at), { recursive: true });
      if (!f.endsWith('/')) writeFileSync(at, 'x');
    }
    return { root, dir };
  }
  const staticImage = (out: { files: { dest: string; text?: string }[] }) => out.files.find((f) => f.dest.endsWith('/theme.xml'))!.text!.match(/<staticImage>([^<]*)</)?.[1];
  const dests = (out: { files: { dest: string; src?: string; data?: string }[] }) => out.files.filter((f) => f.src || f.data).map((f) => f.dest.split('/').slice(1).join('/')).sort();

  it('still exports an older theme’s screen <clock> as one ES-DE clock, and leaves out a hidden text clock (#58)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ccs-esde-clock-'));
    const dir = join(root, 'themes', 'Clock');
    mkdirSync(dir, { recursive: true });
    const write = (screen: string) => writeFileSync(join(dir, 'theme.xml'), `<theme><formatVersion>7</formatVersion><view name="screen">${screen}</view><view name="system"><carousel name="systemcarousel"><type>horizontal</type></carousel></view></theme>`);
    const themeOf = async () => (await toEsde(await ThemeProject.load(dir, nodeFs), envFor(root), listDir)).files.find((f) => f.dest.endsWith('/theme.xml'))!.text!;
    try {
      write('<clock name="clock"><pos>0.9 0.05</pos></clock>');
      expect((await themeOf()).match(/<clock name="clock">/g)?.length).toBeGreaterThan(0);
      write('<text name="clock"><pos>0.9 0.05</pos><visible>false</visible></text>');
      expect(await themeOf()).not.toMatch(/<(clock|text) name="clock">/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps every console logo when the previewed console has none', async () => {
    const { root, dir } = logoTheme(['nes.svg', 'nds.svg', 'n64.svg']); // no snes, the previewed one
    try {
      const out = await toEsde(await ThemeProject.load(dir, nodeFs), envFor(root), listDir);
      expect(staticImage(out)).toBe('./logos/${system.theme}.svg');
      expect(dests(out)).toEqual(['logos/n64.svg', 'logos/nds.svg', 'logos/nes.svg']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('turns SVG logos into PNGs when a theme mixes the two', async () => {
    const { root, dir } = logoTheme(['nes.svg', 'nds.svg', 'snes.png', 'n64.png', 'gb.png', 'gba.svg', 'psx.png']);
    try {
      const p = await ThemeProject.load(dir, nodeFs);
      const drawn: string[] = [];
      const out = await toEsde(p, envFor(root), listDir, 'Logos', { svgToPng: async (abs) => (drawn.push(abs.split(/[\\/]/).pop()!), 'UE5H') });
      expect(staticImage(out)).toBe('./logos/${system.theme}.png');
      expect(dests(out)).toEqual(['logos/gb.png', 'logos/gba.png', 'logos/n64.png', 'logos/nds.png', 'logos/nes.png', 'logos/psx.png', 'logos/snes.png']);
      expect(drawn.sort()).toEqual(['gba.svg', 'nds.svg', 'nes.svg']);
      expect(out.files.find((f) => f.dest.endsWith('logos/nes.png'))!.data).toBe('UE5H');

      // Without a way to draw SVGs, the type most logos use wins and the rest are said.
      const plain = await toEsde(p, envFor(root), listDir);
      expect(dests(plain)).toEqual(['logos/gb.png', 'logos/n64.png', 'logos/psx.png', 'logos/snes.png']);
      expect(plain.notes.join('\n')).toMatch(/3 console pictures are a different file type/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps the type most logos use when no SVGs are involved', async () => {
    const { root, dir } = logoTheme(['nes.jpg', 'nds.jpg', 'gba.jpg', 'snes.png'], ['./logos/${system.theme}.jpg', './logos/${system.theme}.png']);
    try {
      const out = await toEsde(await ThemeProject.load(dir, nodeFs), envFor(root), listDir, 'Logos', { svgToPng: async () => 'UE5H' });
      expect(staticImage(out)).toBe('./logos/${system.theme}.jpg');
      expect(dests(out)).toEqual(['logos/gba.jpg', 'logos/nds.jpg', 'logos/nes.jpg']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('finds the logos from a path written in the wrong folder, as RetroBat does', async () => {
    const { root, dir } = logoTheme(['art/logos/snes.svg', 'art/logos/nes.svg'], ['./../art/logos/${system.theme}.svg']);
    try {
      const out = await toEsde(await ThemeProject.load(dir, nodeFs), envFor(root), listDir);
      expect(staticImage(out)).toBe('./art/logos/${system.theme}.svg');
      expect(dests(out)).toEqual(['art/logos/nes.svg', 'art/logos/snes.svg']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('copies logos kept in a folder per console, and never copies a folder', async () => {
    const { root, dir } = logoTheme(['art/snes/logo.svg', 'art/nes/logo.svg', 'art/logo.svg/'], ['./art/${system.theme}/logo.svg']);
    try {
      const out = await toEsde(await ThemeProject.load(dir, nodeFs), envFor(root), listDir);
      expect(staticImage(out)).toBe('./art/${system.theme}/logo.svg');
      expect(dests(out)).toEqual(['art/nes/logo.svg', 'art/snes/logo.svg']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('says so when an SVG logo can’t be turned into a PNG', async () => {
    const { root, dir } = logoTheme(['nes.png', 'snes.png', 'gba.svg']);
    try {
      const out = await toEsde(await ThemeProject.load(dir, nodeFs), envFor(root), listDir, 'Logos', { svgToPng: async () => null });
      expect(dests(out)).toEqual(['logos/nes.png', 'logos/snes.png']);
      expect(out.notes.join('\n')).toMatch(/1 console picture couldn’t be turned into PNG/);
      expect(out.files.find((f) => f.dest.endsWith('CONVERSION-NOTES.txt'))!.text).toMatch(/couldn’t be turned into PNG/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('carries the console name, count, maker and year, and bands over to the console screen', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ccs-esde-sys-'));
    const dir = join(root, 'themes', 'Sys');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'theme.xml'),
      `<theme><formatVersion>7</formatVersion><view name="system">
        <carousel name="systemcarousel"><type>horizontal</type></carousel>
        <ninepatch name="band" extra="true"><path>./panel.svg</path><pos>0 0.6</pos><size>1 0.09</size><color>30303080</color></ninepatch>
        <text name="sysname" extra="true"><text>{system:fullName}</text><pos>0.1 0.72</pos><size>0.8 0.07</size></text>
        <text name="maker" extra="true"><text>{system:manufacturer} + "  ·  " + {system:releaseYear}</text><pos>0.1 0.79</pos><size>0.8 0.04</size></text>
        <text name="count" extra="true"><text>'' + {system:total} + ' games'</text><pos>0.1 0.835</pos><size>0.8 0.04</size></text>
        <text name="plural" extra="true"><text>{system:total} == 1 ? 'game' : 'games'</text><pos>0 0</pos></text>
      </view></theme>`,
    );
    try {
      const systems = [
        { name: 'snes', theme: 'snes', fullName: 'Super Nintendo', manufacturer: 'Nintendo', releaseYear: '1990', hardwareType: 'console' },
        { name: 'nds', theme: 'nds', fullName: 'Nintendo DS', manufacturer: 'Nintendo', releaseYear: '2004', hardwareType: 'portable' },
      ];
      const out = await toEsde(await ThemeProject.load(dir, nodeFs), envFor(root), listDir, 'Sys', { systems });
      const theme = out.files.find((f) => f.dest.endsWith('/theme.xml'))!.text!;
      expect(checkEsde(theme)).toEqual([]);
      expect(theme).toMatch(/<text name="sysname">[\s\S]*?<systemdata>fullname<\/systemdata>/);
      expect(theme).toMatch(/<text name="count">[\s\S]*?<systemdata>gamecountGames<\/systemdata>/);
      expect(theme).toContain('<text>${ccsSystemMaker}  ·  ${ccsSystemYear}</text>');
      expect(theme).toContain('<include>./_esde/systems/${system.theme}.xml</include>');
      expect(theme).not.toContain('name="plural"');
      const nds = out.files.find((f) => f.dest.endsWith('_esde/systems/nds.xml'))!.text!;
      expect(nds).toContain('<ccsSystemMaker>Nintendo</ccsSystemMaker>');
      expect(nds).toContain('<ccsSystemYear>2004</ccsSystemYear>');
      // The band: a plain panel in its color.
      expect(theme).toMatch(/<image name="band">[\s\S]*?<size>1 0.09<\/size>[\s\S]*?<path>\.\/_esde\/solid\.png<\/path>[\s\S]*?<color>30303080<\/color>/);
      expect(out.files.find((f) => f.dest.endsWith('_esde/solid.png'))!.data).toMatch(/^iVBORw0KGgo/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses ES-DE’s names for consoles it calls something else (3ds is n3ds)', async () => {
    const { root, dir } = logoTheme(['3ds.svg', 'nds.svg', 'n3ds.svg', 'amiga500.svg']);
    try {
      const systems = [
        { name: '3ds', theme: '3ds', fullName: 'Nintendo 3DS', manufacturer: 'Nintendo', releaseYear: '2011', hardwareType: 'portable' },
        { name: 'nds', theme: 'nds', fullName: 'Nintendo DS', manufacturer: 'Nintendo', releaseYear: '2004', hardwareType: 'portable' },
      ];
      const p = await ThemeProject.load(dir, nodeFs);
      const out = await toEsde(p, envFor(root), listDir, 'Logos', { systems });
      // n3ds.svg was already there under ES-DE's name, so it wins over the renamed 3ds.svg.
      expect(dests(out)).toEqual(['logos/amiga.svg', 'logos/n3ds.svg', 'logos/nds.svg']);
      expect(out.files.find((f) => f.dest.endsWith('logos/n3ds.svg'))!.src).toMatch(/n3ds\.svg$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('only carries over console texts it can show the same way', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ccs-esde-txt-'));
    const dir = join(root, 'themes', 'Txt');
    mkdirSync(dir, { recursive: true });
    const t = (name: string, text: string) => `<text name="${name}" extra="true"><text>${text}</text><pos>0 0</pos><size>1 0.05</size></text>`;
    writeFileSync(
      join(dir, 'theme.xml'),
      `<theme><formatVersion>7</formatVersion><view name="system">
        ${t('inline', '{system:fullName} - {system:releaseYear}')}
        ${t('upper', 'upper({system:fullName})')}
        ${t('bare', '{system:total}')}
        ${t('mixed', "{system:fullName} + ' · ' + {system:total} + ' games'")}
        ${t('words', 'Made by {system:manufacturer}')}
        <ninepatch name="frame" extra="true"><path>./frame.png</path><pos>0 0</pos><size>0.5 0.5</size></ninepatch>
      </view></theme>`,
    );
    writeFileSync(join(dir, 'frame.png'), 'x');
    try {
      const systems = [{ name: '3ds', theme: '3ds', fullName: 'Nintendo 3DS', manufacturer: 'Nintendo', releaseYear: '2011', hardwareType: 'portable' }];
      const out = await toEsde(await ThemeProject.load(dir, nodeFs), envFor(root), listDir, 'Txt', { systems });
      const theme = out.files.find((f) => f.dest.endsWith('/theme.xml'))!.text!;
      expect(checkEsde(theme)).toEqual([]);
      expect(theme).toContain('<text>${system.fullName} - ${ccsSystemYear}</text>');
      expect(theme).toContain('<text>Made by ${ccsSystemMaker}</text>');
      expect(theme).toMatch(/<text name="bare">[\s\S]*?<systemdata>gamecountGamesNoText<\/systemdata>/);
      expect(theme).not.toContain('name="upper"');
      expect(theme).not.toContain('name="mixed"');
      expect(theme).toMatch(/<image name="frame">[\s\S]*?<path>\.\/frame\.png<\/path>/);
      expect(out.files.some((f) => f.dest.endsWith('_esde/systems/n3ds.xml'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // Found by running the export in ES-DE 3.5 (2026-11-02).
  it('matches what RetroBat shows, as checked in ES-DE', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ccs-esde-run-'));
    const dir = join(root, 'themes', 'Run');
    mkdirSync(join(dir, 'logos', 'us'), { recursive: true });
    for (const f of ['logos/snes-w.svg', 'logos/nds-w.svg', 'logos/us/snes.svg', 'click.wav']) writeFileSync(join(dir, f), 'x');
    writeFileSync(
      join(dir, 'theme.xml'),
      `<theme><formatVersion>7</formatVersion>
      <view name="screen"><text name="clock"><pos>0.97 0.035</pos><origin>1 0</origin><size>0.3 0.05</size><alignment>right</alignment></text></view>
      <view name="system">
        <carousel name="systemcarousel"><type>horizontal</type><scrollSound>./click.wav</scrollSound></carousel>
        <image name="logo"><path>./logos/\${system.theme}-w.svg</path></image>
        <image name="logo" region="us"><path>./logos/us/\${system.theme}.svg</path></image>
        <text name="year" extra="true"><text>{system:releaseYear}</text><pos>0 0</pos></text>
      </view>
      <view name="basic, detailed">
        <textlist name="gamelist"><pos>0.6 0.1</pos><size>0.3 0.8</size></textlist>
        <helpsystem name="help"><pos>0.02 0.955</pos></helpsystem>
        <text name="md_description"><pos>0.05 0.5</pos><size>0.4 0.2</size><opacity>0.5</opacity></text>
        <text name="fav" extra="true"><text>★ Favorite</text><visible>{game:favorite}</visible><pos>0.27 0.45</pos><size>0.18 0.03</size><alignment>right</alignment></text>
        <text name="kid" extra="true"><text>Kid game</text><visible>{game:kidgame}</visible><pos>0 0</pos></text>
        <image name="box" extra="true"><path>firstfile({game:boxart}, {game:thumbnail}, {game:image})</path><pos>0.3 0.7</pos><maxSize>0.1 0.2</maxSize></image>
        <image name="deco" extra="true"><path>./click.wav</path><pos>0 0</pos><size>1 1</size></image>
      </view>
      <view name="detailed">
        <control name="md_image"><pos>0.74 0.39</pos><maxSize>0.39 0.4</maxSize></control>
        <video name="md_video"><pos>0.74 0.39</pos><maxSize>0.39 0.4</maxSize><origin>0.5 0.5</origin></video>
      </view>
      </theme>`,
    );
    try {
      const systems = [{ name: 'arcade', theme: 'arcade', fullName: 'Arcade', manufacturer: 'Arcade', releaseYear: '', hardwareType: 'arcade' }];
      const out = await toEsde(await ThemeProject.load(dir, nodeFs), envFor(root), listDir, 'Run', { systems });
      const theme = out.files.find((f) => f.dest.endsWith('/theme.xml'))!.text!;
      const variant = (v: string) => theme.match(new RegExp(`<variant name="${v}">([\\s\\S]*?)</variant>`))![1];
      expect(checkEsde(theme)).toEqual([]);
      // Logos: the region's file where it has one, the normal one for the rest.
      expect(dests(out)).toEqual(expect.arrayContaining(['logos/snes-w.svg', 'logos/nds-w.svg']));
      expect(out.files.find((f) => f.dest.endsWith('logos/snes-w.svg'))!.src).toMatch(/us[\\/]snes\.svg$/);
      // RetroBat's own clock (a text on the every-screen view), with its alignment, as ES-DE's clock on the console list and game lists (#58).
      expect(theme.match(/<clock name="clock">/g)!.length).toBe(3);
      expect(theme).not.toMatch(/<text name="clock">/);
      expect(theme).toContain('<horizontalAlignment>right</horizontalAlignment>');
      // Draw order: RetroBat's defaults, written out (ES-DE's differ).
      expect(variant('detailed')).toMatch(/<textlist name="gamelist">[\s\S]*?<zIndex>20<\/zIndex>/);
      // Details never empty: defaults first, the console's own file after.
      expect(theme.indexOf('<variables>')).toBeLessThan(theme.indexOf('<include>'));
      expect(out.files.find((f) => f.dest.endsWith('_esde/systems/arcade.xml'))!.text).toContain('<ccsSystemYear> </ccsSystemYear>');
      // Shown for favorites only: ES-DE's favorite badge in the same box; other per-game parts left out.
      expect(variant('detailed')).toMatch(/<badges name="fav">[\s\S]*?<size>0.18 0.03<\/size>[\s\S]*?<horizontalAlignment>right<\/horizontalAlignment>[\s\S]*?<slots>favorite<\/slots>/);
      expect(theme).not.toContain('name="kid"');
      // firstfile(): ES-DE's picture types in the same order.
      expect(variant('detailed')).toContain('<imageType>cover, miximage, screenshot</imageType>');
      // The simple list shows no game details; text keeps its see-through.
      expect(variant('simple')).not.toContain('md_description');
      expect(variant('detailed')).toMatch(/<text name="md_description">[\s\S]*?<opacity>0.5<\/opacity>/);
      // One screenshot: the video's still picture; no black bars beside videos.
      expect(variant('detailed')).not.toContain('name="md_image"');
      expect(variant('detailed')).toContain('<pillarboxes>false</pillarboxes>');
      // Game lists: the help bar keeps its main buttons so it fits.
      expect(variant('detailed')).toContain('<entries>start a b x y</entries>');
      // The console list's scroll sound.
      expect(theme).toMatch(/<sound name="systembrowse">\s*<path>\.\/click\.wav<\/path>/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  const DEMO = 'G:/projects/channelcraft/guides-demo/RetroBat/emulationstation/.emulationstation';
  it.skipIf(!existsSync(`${DEMO}/themes/es-theme-carbon`))('converts a full RetroBat theme into valid ES-DE', async () => {
    const p = await ThemeProject.load(`${DEMO}/themes/es-theme-carbon`, nodeFs);
    const out = await toEsde(p, envFor(DEMO), listDir);
    const theme = out.files.find((f) => f.dest.endsWith('/theme.xml'))!.text!;
    expect(checkEsde(theme)).toEqual([]);
    expect(out.variants.map((v) => v.name)).toEqual(expect.arrayContaining(['detailed', 'grid', 'carousel']));
    expect(theme).toMatch(/<staticImage>[^<]*\$\{system\.theme\}[^<]*<\/staticImage>/);
    for (const f of out.files.filter((x) => x.src)) expect(existsSync(f.src!), f.src).toBe(true);
    expect(out.files.filter((f) => f.src).length).toBeGreaterThan(10);
  });
});
