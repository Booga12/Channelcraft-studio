import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { varUse } from './simpleProps';
import type { Environment } from './context';

const env: Environment = {
  esHome: 'C:\RetroBat\emulationstation\.emulationstation',
  resourcesDir: 'C:\RetroBat\emulationstation\resources',
  settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
};

describe('which colours the theme uses (#28)', () => {
  it('counts colours used by parts, through other colours, and the ones the accent shade comes from', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ccs-varuse-'));
    writeFileSync(
      join(dir, 'theme.xml'),
      `<theme>
  <variables>
    <accentColor>3366FFFF</accentColor>
    <bgColor>000000FF</bgColor>
    <base>FF0000FF</base>
    <titleColor>\${base}</titleColor>
    <designAccent>6A2A80FF</designAccent>
    <designAccentText>E0A0F0FF</designAccentText>
    <designBackground>101010FF</designBackground>
  </variables>
  <view name="detailed">
    <text name="md_name"><color>\${titleColor}</color></text>
    <text name="md_description"><color>\${titleColor}</color></text>
    <rating name="md_rating"><color>\${designAccentText}</color></rating>
  </view>
  <view name="system">
    <image name="background"><color>\${bgColor}</color></image>
  </view>
</theme>
`,
    );
    try {
      const p = await ThemeProject.load(dir, nodeFs);
      const { used, users } = varUse(resolveTheme(p, env));
      expect([...used].sort()).toEqual(['base', 'bgColor', 'designAccent', 'designAccentText', 'designBackground', 'titleColor']);
      expect(used.has('accentColor')).toBe(false);
      expect([...(users.get('titleColor') ?? [])].sort()).toEqual(['md_description', 'md_name']);
      expect(users.has('base')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
