import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { applyChanges, inverse } from './edits';
import { alsoOn, alsoOnChanges } from './alsoOn';
import type { Environment } from './context';

const env: Environment = {
  esHome: 'C:\\RetroBat\\emulationstation\\.emulationstation',
  resourcesDir: 'C:\\RetroBat\\emulationstation\\resources',
  settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
};

const THEME = `<theme>
  <formatVersion>7</formatVersion>
  <view name="detailed">
    <text name="md_name"><pos>0 0</pos></text>
  </view>
  <view name="video">
    <text name="md_name"><pos>0 0</pos></text>
  </view>
  <view name="basic">
    <text name="taken"><pos>0 0</pos></text>
  </view>
  <view name="detailed">
    <text name="play" extra="true">
      <pos>0.1 0.2</pos>
      <text>PLAY</text>
    </text>
    <text name="taken" extra="true"><pos>0 0</pos></text>
  </view>
  <customView name="mine" inherits="detailed">
    <text name="own"><pos>0 0</pos></text>
  </customView>
</theme>
`;

async function load(xml = THEME) {
  const dir = mkdtempSync(join(tmpdir(), 'ccs-alsoon-'));
  writeFileSync(join(dir, 'theme.xml'), xml);
  const p = await ThemeProject.load(dir, nodeFs);
  return { p, dir, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const has = (p: ThemeProject, view: string, name: string) => !!resolveTheme(p, env).views.get(view)?.elements.get(name);

describe('also show on other game lists (#30)', () => {
  it('lists the other game lists and where the part is', async () => {
    const { p, done } = await load();
    try {
      const a = alsoOn(p, resolveTheme(p, env), 'detailed', 'play');
      expect(a.why).toBeUndefined();
      expect(a.screens).toEqual([
        { view: 'video', state: 'off' },
        { view: 'basic', state: 'off' },
        { view: 'mine', state: 'with', from: 'detailed' },
      ]);
      // A name already used there can't be shared to it.
      expect(alsoOn(p, resolveTheme(p, env), 'detailed', 'taken').screens.find((s) => s.view === 'basic')?.state).toBe('taken');
      // Not on game lists: nothing to offer.
      expect(alsoOn(p, resolveTheme(p, env), 'system', 'play').screens).toEqual([]);
    } finally {
      done();
    }
  });

  it('shares a part to another game list as one part, and takes it off again', async () => {
    const { p, done } = await load();
    try {
      applyChanges(p, alsoOnChanges(p, resolveTheme(p, env), 'detailed', 'play', 'video', true)!);
      expect(p.entry!.src).toContain('<view name="detailed, video">');
      expect(has(p, 'video', 'play')).toBe(true);
      expect(has(p, 'detailed', 'play')).toBe(true);
      // The block it left still has "taken", so it stays.
      expect(has(p, 'detailed', 'taken')).toBe(true);
      // One part: its text is the same on both, from one place.
      const r = resolveTheme(p, env);
      expect(r.views.get('video')!.elements.get('play')!.defs[0].node).toBe(r.views.get('detailed')!.elements.get('play')!.defs[0].node);
      expect(alsoOn(p, r, 'video', 'play').screens.find((s) => s.view === 'detailed')?.state).toBe('on');

      // A third screen: it moves to a block naming all three.
      applyChanges(p, alsoOnChanges(p, resolveTheme(p, env), 'detailed', 'play', 'basic', true)!);
      expect(p.entry!.src).toContain('<view name="detailed, video, basic">');
      expect(p.entry!.src).not.toContain('<view name="detailed, video">');
      expect(has(p, 'basic', 'play')).toBe(true);

      // Off again: back to the screens it's still on.
      applyChanges(p, alsoOnChanges(p, resolveTheme(p, env), 'detailed', 'play', 'video', false)!);
      expect(has(p, 'video', 'play')).toBe(false);
      expect(has(p, 'detailed', 'play')).toBe(true);
      expect(has(p, 'basic', 'play')).toBe(true);
      expect(p.entry!.src).toContain('<view name="detailed, basic">');
      expect(resolveTheme(p, env).views.get('detailed')!.elements.get('play')!.props.get('text')!.value).toBe('PLAY');
    } finally {
      done();
    }
  });

  it('undoes to the exact original text', async () => {
    const { p, done } = await load();
    try {
      const original = p.entry!.src;
      const applied = applyChanges(p, alsoOnChanges(p, resolveTheme(p, env), 'detailed', 'play', 'video', true)!);
      applyChanges(p, inverse(p, applied));
      expect(p.entry!.src).toBe(original);
    } finally {
      done();
    }
  });

  it('removes a block it leaves empty, and reuses a block with the same screens', async () => {
    const xml = `<theme>
  <view name="detailed">
    <text name="play" extra="true"><pos>0 0</pos></text>
  </view>
  <view name="video, detailed">
    <text name="other" extra="true"><pos>0 0</pos></text>
  </view>
</theme>
`;
    const { p, done } = await load(xml);
    try {
      applyChanges(p, alsoOnChanges(p, resolveTheme(p, env), 'detailed', 'play', 'video', true)!);
      expect(p.entry!.src).not.toMatch(/<view name="detailed">/);
      expect(p.entry!.src.match(/<view /g)).toHaveLength(1);
      expect(has(p, 'video', 'play')).toBe(true);
      expect(has(p, 'video', 'other')).toBe(true);
    } finally {
      done();
    }
  });

  it("explains why a part defined in more than one place can't be shared", async () => {
    const xml = `<theme>
  <view name="detailed, video">
    <text name="md_name"><pos>0 0</pos></text>
  </view>
  <view name="detailed">
    <text name="md_name"><color>FFFFFF</color></text>
  </view>
</theme>
`;
    const { p, done } = await load(xml);
    try {
      const a = alsoOn(p, resolveTheme(p, env), 'detailed', 'md_name');
      expect(a.why).toMatch(/more than one place/);
      expect(alsoOnChanges(p, resolveTheme(p, env), 'detailed', 'md_name', 'basic', true)).toBeNull();
    } finally {
      done();
    }
  });
});
