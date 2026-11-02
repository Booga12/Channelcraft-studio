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
    return readdirSync(dir);
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
