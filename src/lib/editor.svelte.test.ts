// The editor's operations on the bundled starter theme, in memory (nothing is written to disk).
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The editor talks to Tauri for files and dialogs; these tests never need it.
vi.mock('@tauri-apps/plugin-store', () => ({ load: async () => ({ get: async () => null, set: async () => {} }) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: async () => true, save: async () => null, open: async () => null }));
const calls: { cmd: string; args: Record<string, unknown> }[] = [];
let respond: (cmd: string, args: Record<string, unknown>) => unknown = () => null;
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    calls.push({ cmd, args });
    return respond(cmd, args);
  },
  convertFileSrc: (p: string) => p,
}));

const { ed } = await import('./editor.svelte');
const { ThemeProject } = await import('./theme/project');
const { nodeFs } = await import('./theme/nodefs');
const { ANIMATIONS } = await import('./theme/animations');

async function open() {
  const p = await ThemeProject.load('src-tauri/resources/starter-theme', nodeFs);
  ed.project = p;
  ed.screenFile = 'theme.xml';
  ed.view = 'detailed';
  ed.selection = [];
  ed.clearHistory();
  ed.rev++;
  return p;
}

const pos = (name: string) => ed.currentView!.elements.get(name)!.props.get('pos')!.value;

describe('editor operations (starter theme, in memory)', () => {
  let original = '';
  beforeEach(async () => {
    const p = await open();
    original = p.entry!.src;
  });

  it('merges quick repeated edits into one undo step, and undoes to the exact bytes', () => {
    ed.setProps('md_image', { pos: '0.3 0.4' }, 'drag.x');
    ed.setProps('md_image', { pos: '0.31 0.41' }, 'drag.x');
    ed.setProps('md_image', { pos: '0.32 0.42' }, 'drag.x');
    expect(pos('md_image')).toBe('0.32 0.42');
    expect(ed.history.done.length).toBe(1);
    ed.undo(true);
    expect(ed.project!.entry!.src).toBe(original);
  });

  it('moves several elements as one step', () => {
    ed.selection = ['md_image', 'md_rating'];
    ed.moveSelection({ md_image: [0.26, 0.38], md_rating: [0.05, 0.66] }, 0.1, -0.05, 'drag.both');
    expect(pos('md_image')).toBe('0.36 0.33');
    expect(pos('md_rating')).toBe('0.15 0.61');
    expect(ed.history.done.length).toBe(1);
    ed.undo(true);
    expect(ed.project!.entry!.src).toBe(original);
  });

  it('sets position and size together, adding the missing property', () => {
    ed.setProps('md_rating', { pos: '0.1 0.7', size: '0.2 0.04' });
    const el = ed.currentView!.elements.get('md_rating')!;
    expect(el.props.get('size')!.value).toBe('0.2 0.04');
    expect(el.props.get('pos')!.value).toBe('0.1 0.7');
  });

  it('copies RetroBat’s own picture as a regular element that still shows the game’s data', () => {
    ed.selection = ['md_image'];
    ed.copy();
    ed.paste();
    const pasted = ed.selection[0];
    const el = ed.currentView!.elements.get(pasted)!;
    expect(pasted).not.toBe('md_image');
    expect(el.extra).toBe('true');
    expect(el.props.get('path')!.value).toContain('{game:image}');
    expect(el.props.get('pos')!.value).toBe('0.28 0.4');
  });

  it('turns game artwork pasted onto the console screen into a random game’s', () => {
    ed.view = 'video';
    ed.selection = ['md_video'];
    ed.copy();
    ed.view = 'system';
    ed.paste();
    const pasted = ed.currentView!.elements.get(ed.selection[0])!;
    expect(pasted.type).toBe('video');
    expect(pasted.props.get('path')!.value).toBe('{random}');
  });

  it('duplicates, renames and deletes an element, and undoes it all', () => {
    ed.selection = ['md_image'];
    ed.duplicate();
    const copy = ed.selection[0];
    ed.rename(copy, 'second-art');
    expect(ed.currentView!.elements.has('second-art')).toBe(true);
    expect(ed.currentView!.elements.has(copy)).toBe(false);
    ed.selection = ['second-art'];
    ed.deleteSelection();
    expect(ed.currentView!.elements.has('second-art')).toBe(false);
    ed.jumpTo(0);
    expect(ed.project!.entry!.src).toBe(original);
    ed.jumpTo(3);
    expect(ed.currentView!.elements.has('second-art')).toBe(false);
    expect(ed.history.done.length).toBe(3);
  });

  it('keeps RetroBat’s own element names', () => {
    ed.rename('md_image', 'whatever');
    expect(ed.currentView!.elements.has('md_image')).toBe(true);
  });

  it('replaces an animation instead of stacking them, and removes it', () => {
    const storyboards = () => ed.currentView!.elements.get('md_image')!.complex.filter((c) => c.name === 'storyboard').length;
    ed.setAnimation('md_image', 'pulse');
    expect(storyboards()).toBe(1);
    ed.setAnimation('md_image', 'spin');
    expect(storyboards()).toBe(1);
    const sb = ed.currentView!.elements.get('md_image')!.complex.find((c) => c.name === 'storyboard')!;
    expect(ed.project!.entry!.src.slice(sb.node.start, sb.node.end)).toContain('property="rotation"');
    ed.setAnimation('md_image', null);
    expect(storyboards()).toBe(0);
    expect(ANIMATIONS.length).toBeGreaterThan(5);
  });

  it('changes how much and how fast an animation moves, in place, and keeps videos still', async () => {
    const { tuningOf } = await import('./theme/animations');
    const el = () => ed.currentView!.elements.get('md_image')!;
    const sbText = () => {
      const sb = el().complex.find((c) => c.name === 'storyboard')!;
      return ed.project!.entry!.src.slice(sb.node.start, sb.node.end);
    };
    ed.setAnimation('md_image', 'float');
    expect(tuningOf(el())).toMatchObject({ amount: 1, speed: 1, duration: 3000 });
    // Twice the travel, half the speed: from/to/duration change, nothing else.
    ed.tuneAnimation('md_image', 2, 0.5, { coalesce: 'tune' });
    ed.tuneAnimation('md_image', 2, 0.5, { coalesce: 'tune' });
    expect(sbText()).toContain('from="0.38" to="0.364" duration="6000"');
    expect(tuningOf(el())).toMatchObject({ preset: { id: 'float' }, amount: 2, duration: 6000 });
    // A theme's own bob written by hand (lower-case autoreverse, a begin delay) is recognised and keeps its extras.
    ed.setAnimation('md_image', null);
    const target = el().defs[el().defs.length - 1];
    const { patchInsertChild } = await import('./xml/cst');
    ed.commit('hand-written', [{ file: target.file, patch: patchInsertChild(target.file.doc, target.node, '<storyboard>\n  <animation property="y" from="0.38" to="0.372" begin="350" duration="2400" mode="easeInOut" autoreverse="true" repeat="forever"/>\n</storyboard>') }]);
    expect(tuningOf(el())).toMatchObject({ preset: { id: 'float' }, amount: 1, duration: 2400 });
    ed.tuneAnimation('md_image', 0.5, 1);
    expect(sbText()).toContain('to="0.376" begin="350" duration="3000"');
    expect(sbText()).toContain('autoreverse="true"');
    // Videos get entrances but never loops.
    ed.view = 'video';
    ed.setAnimation('md_video', 'float');
    expect(ed.currentView!.elements.get('md_video')!.complex.some((c) => c.name === 'storyboard')).toBe(false);
  });

  it('adds, changes and removes RetroBat’s drop shadow on a picture', async () => {
    const { shaderOf } = await import('./theme/shadow');
    const before = ed.project!.entry!.src;
    ed.setShadow('md_image', 4);
    let sh = shaderOf(ed.currentView!.elements.get('md_image')!)!;
    expect(sh).toMatchObject({ shadow: true, offset: 4 });
    expect(ed.project!.entry!.src).toMatch(/<shader>\s*<path>:\/shaders\/shadow\.glsl<\/path>\s*<shadowOffset>4<\/shadowOffset>\s*<\/shader>/);
    ed.setShadow('md_image', 9);
    sh = shaderOf(ed.currentView!.elements.get('md_image')!)!;
    expect(sh.offset).toBe(9);
    ed.setShadow('md_image', null);
    expect(shaderOf(ed.currentView!.elements.get('md_image')!)).toBeNull();
    expect(ed.project!.entry!.src).toBe(before);
  });

  it('aligns and spaces elements using their measured boxes', () => {
    ed.rects = {
      md_image: { x: 0.1, y: 0.2, w: 0.2, h: 0.2 },
      md_rating: { x: 0.3, y: 0.5, w: 0.1, h: 0.04 },
      md_releasedate: { x: 0.6, y: 0.6, w: 0.1, h: 0.03 },
    };
    ed.selection = ['md_image', 'md_rating', 'md_releasedate'];
    ed.align('left');
    // Its left edge (0.3) moves to the leftmost edge (0.1).
    expect(pos('md_rating')).toBe('-0.15 0.66');
    ed.undo(true);
    ed.distribute('h');
    // Gaps become equal: 0.1 between each box, so the middle box's left edge goes from 0.3 to 0.4.
    expect(pos('md_rating')).toBe('0.15 0.66');
    expect(pos('md_releasedate')).toBe('0.2 0.66');
  });

  it('ignores edits meant for a theme that was closed', async () => {
    const old = ed.project!;
    const staleNode = ed.currentView!.elements.get('md_image')!.props.get('pos')!;
    await open();
    ed.commit('stale', [{ file: old.entry!, patch: { start: staleNode.node.start, end: staleNode.node.end, text: 'x' } }]);
    expect(ed.history.done.length).toBe(0);
  });

  it('saves every changed file in one call and asks before overwriting files changed elsewhere', async () => {
    ed.setProps('md_image', { pos: '0.3 0.4' });
    const expected = ed.project!.entry!.src;
    calls.length = 0;
    let first = true;
    respond = (cmd) => {
      if (cmd === 'save_files' && first) {
        first = false;
        throw 'CHANGED_OUTSIDE:["theme.xml"]';
      }
      return null;
    };
    await ed.save();
    respond = () => null;
    const saves = calls.filter((c) => c.cmd === 'save_files');
    // Refused once because theme.xml changed elsewhere; the user agreed (mocked), so it was forced.
    expect(saves.map((c) => c.args.force)).toEqual([false, true]);
    expect(saves[1].args.files).toEqual([{ rel: 'theme.xml', text: expected, bom: false, remove: false }]);
    // The first save of the session makes a backup first.
    expect(calls.findIndex((c) => c.cmd === 'backup_theme')).toBeLessThan(calls.findIndex((c) => c.cmd === 'save_files'));
    expect(ed.dirtyCount).toBe(0);
  });

  it('sets and clears the theme screen transition on theme.xml, undoably', () => {
    expect(ed.themeTransition).toBe('');
    ed.setThemeTransition('slide');
    expect(ed.project!.entry!.src).toMatch(/<theme[^>]*defaultTransition="slide"/);
    expect(ed.themeTransition).toBe('slide');
    ed.setThemeTransition('');
    expect(ed.project!.entry!.src).toBe(original);
    ed.setThemeTransition('fade');
    ed.undo(true);
    expect(ed.project!.entry!.src).toBe(original);
  });

  it('edits the loading screen in splash.xml, leaving theme.xml alone', () => {
    const p = ed.project!;
    const splash = p.addFile('splash.xml', `<theme>
  <formatVersion>7</formatVersion>
  <view name="splash">
    <text name="label">
      <pos>0.5 0.8</pos>
    </text>
  </view>
</theme>
`);
    ed.rev++;
    expect(ed.screens.map((t) => t.id)).toContain('@splash.xml');
    ed.showScreen({ view: 'splash', file: 'splash.xml' });
    expect(ed.currentView!.elements.has('label')).toBe(true);
    ed.setProps('label', { pos: '0.5 0.7' });
    expect(splash.src).toContain('<pos>0.5 0.7</pos>');
    expect(p.fileAt('theme.xml')!.src).toBe(original);
    // Back on a theme.xml screen, edits go to theme.xml again.
    ed.showScreen({ view: 'detailed', file: 'theme.xml' });
    expect(ed.currentView!.elements.has('md_image')).toBe(true);
    expect(p.entry!.rel).toBe('theme.xml');
  });

  it('features one real game per console: its video and cover together, per-console blocks, one undo step', async () => {
    const game = (path: string, media: Record<string, string>) => ({ path, name: path.slice(2), description: '', rating: 0, releasedate: '', developer: '', publisher: '', genre: '', players: '', playcount: '', lastplayed: '', gametime: '', favorite: false, media });
    ed.games = {
      snes: [game('./NoVideo.sfc', { boxart: 'R:/snes/a.png' }), game('./Mario.sfc', { video: 'R:/snes/mario.mp4', image: 'R:/snes/mario.png' })],
    };
    respond = (cmd, args) => {
      if (cmd === 'existing_files') return (args.paths as string[]).map(() => true);
      if (cmd === 'copy_media_into_theme') return `_inc/ccs/featured/${String(args.src).split('/').pop()}`;
      if (cmd === 'list_theme_files') return [];
      return null;
    };
    const problems = await ed.applyFeatured({ snes: 'auto', nes: 'none' });
    respond = () => null;
    expect(problems).toEqual([]);
    const p = ed.project!;
    const featured = p.fileAt('_inc/ccs/featured.xml')!.src;
    // The first game with both files, not the first game.
    expect(featured).toContain(`if="\${system.theme} == 'snes'"`);
    expect(featured).toContain('<path>./featured/mario.mp4</path>');
    expect(featured).toContain('<path>./featured/mario.png</path>');
    expect(ed.featured.pairs.snes).toMatchObject({ game: './Mario.sfc', theme: 'snes' });
    // theme.xml: the two elements, hidden by default, then the include that shows them per console.
    const theme = p.fileAt('theme.xml')!.src;
    expect(theme.indexOf('ccs_featured_video')).toBeGreaterThan(0);
    expect(theme.indexOf('<include>./_inc/ccs/featured.xml</include>')).toBeGreaterThan(theme.indexOf('ccs_featured_cover'));
    ed.view = 'system';
    ed.settings.system = { ...ed.settings.system, name: 'snes', theme: 'snes' };
    ed.rev++;
    const v = ed.currentView!.elements.get('ccs_featured_video')!;
    expect(v.props.get('visible')!.value).toBe('true');
    expect(v.props.get('path')!.value).toBe('./featured/mario.mp4');
    // Tweaks made for every console go to the shared cover, not to the SNES-only block.
    const featuredBefore = p.fileAt('_inc/ccs/featured.xml')!.src;
    ed.setProps('ccs_featured_cover', { pos: '0.7 0.8' });
    ed.setAnimation('ccs_featured_cover', 'float');
    expect(p.fileAt('_inc/ccs/featured.xml')!.src).toBe(featuredBefore);
    ed.settings.system = { ...ed.settings.system, name: 'nes', theme: 'nes' };
    ed.rev++;
    const cover = ed.currentView!.elements.get('ccs_featured_cover')!;
    expect(cover.props.get('visible')!.value).toBe('false');
    expect(cover.props.get('pos')!.value).toBe('0.7 0.8');
    expect(cover.complex.some((c) => c.name === 'storyboard')).toBe(true);
    ed.undo(true);
    ed.undo(true);
    // A chosen game without both files is reported, and its saved pair is kept.
    respond = (cmd, args) => (cmd === 'existing_files' ? (args.paths as string[]).map(() => false) : cmd === 'list_theme_files' ? [] : null);
    expect((await ed.applyFeatured({ snes: './Mario.sfc' }))[0]).toContain('needs both a video and a cover');
    respond = () => null;
    expect(ed.featured.pairs.snes.game).toBe('./Mario.sfc');
    // One undo step per apply takes theme.xml back to how it was.
    ed.undo(true);
    ed.undo(true);
    expect(p.fileAt('theme.xml')!.src).toBe(original);
  });

  it('gives one console its own colour and position, the way RetroBat reads them', async () => {
    const p = await open();
    const colors = p.fileAt('_inc/colors/dark.xml')!;
    const before = { theme: p.entry!.src, colors: colors.src };
    const show = (theme: string) => {
      ed.settings.system = { ...ed.settings.system, name: theme, theme, fullName: theme.toUpperCase() };
      ed.rev++;
    };
    const accent = () => ed.res!.vars.get('accentColor')!.value;
    try {
      show('snes');
      ed.consoleOnly = true;
      ed.setVar('accentColor', 'E2382EFF');
      expect(colors.src).toContain(`<accentColor>4C8DFFFF</accentColor>\n    <accentColor if="\${system.theme} == 'snes'">E2382EFF</accentColor>`.replace(/\n/g, colors.src.includes('\r\n') ? '\r\n' : '\n'));
      ed.setProps('md_image', { pos: '0.5 0.5' });
      expect(accent()).toBe('E2382EFF');
      expect(pos('md_image')).toBe('0.5 0.5');
      expect(ed.consoleValues.map((v) => v.name).sort()).toEqual(['accentColor', 'pos']);
      show('nes');
      expect(accent()).toBe('4C8DFFFF');
      expect(pos('md_image')).toBe('0.26 0.38');
      // Shared edits made while SNES is shown go to the shared value; SNES keeps its own.
      show('snes');
      ed.consoleOnly = false;
      ed.setVar('accentColor', '00AA00FF');
      expect(accent()).toBe('E2382EFF');
      show('nes');
      expect(accent()).toBe('00AA00FF');
      show('snes');
      ed.clearConsoleValues(ed.consoleValues);
      expect(accent()).toBe('00AA00FF');
      expect(pos('md_image')).toBe('0.26 0.38');
      ed.jumpTo(0);
      expect(colors.src).toBe(before.colors);
      expect(p.entry!.src).toBe(before.theme);
    } finally {
      ed.consoleOnly = false;
    }
  });
});

describe('sound and music (starter theme, in memory)', () => {
  beforeEach(async () => {
    await open();
    respond = (cmd, args) => (cmd === 'copy_sound_into_theme' ? `${args.destRelDir}/My Song.ogg` : cmd === 'download_font' ? `_inc/fonts/${args.fileName}` : null);
  });

  it('sets the menu music, changes it, and takes it away again, each as one undo step', async () => {
    const before = ed.project!.entry!.src;
    await ed.setMusic({ preset: 'lofi' });
    expect(calls.some((c) => c.cmd === 'write_binary' && String(c.args.path).endsWith('lofi.wav'))).toBe(true);
    expect(ed.themeMusic()?.preset).toBe('lofi');
    expect(ed.project!.entry!.src).toContain('<sound name="bgsound">');
    await ed.setMusic({ file: 'C:\\Music\\My Song.ogg' });
    expect(ed.themeMusic()?.path).toBe('./_inc/ccs/music/My Song.ogg');
    expect(ed.themeMusic()?.preset).toBeNull();
    await ed.setMusic(null);
    expect(ed.themeMusic()).toBeNull();
    ed.undo(true);
    ed.undo(true);
    ed.undo(true);
    expect(ed.project!.entry!.src).toBe(before);
  });

  it('uses the app’s own sounds picked from Assets (by their made-up path) like the presets', async () => {
    const { appSound, APP_SOUNDS } = await import('./theme/appSounds');
    expect(appSound('ccs-sound:music/nope.wav')).toBeNull();
    expect(appSound('C:\\Music\\lofi.wav')).toBeNull();
    expect(APP_SOUNDS.some((s) => s.group === 'music') && APP_SOUNDS.some((s) => s.group === 'scroll')).toBe(true);
    const from = calls.length;
    await ed.setMusic({ file: 'ccs-sound:music/lofi.wav' });
    expect(ed.themeMusic()?.preset).toBe('lofi');
    expect(calls.slice(from).some((c) => c.cmd === 'copy_sound_into_theme')).toBe(false);
    await ed.setScrollSound({ file: 'ccs-sound:scroll/blip.wav' });
    expect(ed.themeScrollSound()?.preset).toBe('blip');
    // On an element (a drop, or a file field in Properties) it is written into the theme too.
    const abs = await ed.importAsset('ccs-sound:scroll/blip.wav', 'sound');
    expect(abs?.replace(/\\/g, '/').endsWith('_inc/ccs/sounds/blip.wav')).toBe(true);
  });

  it('gives the console carousel and the game lists one scroll sound', async () => {
    await ed.setScrollSound({ preset: 'blip' });
    expect(ed.themeScrollSound()?.preset).toBe('blip');
    const res = ed.themeRes ?? ed.res;
    for (const [view, name] of [['system', 'systemcarousel'], ['detailed', 'gamelist'], ['basic', 'gamelist']]) {
      expect(res!.views.get(view)?.elements.get(name)?.props.get('scrollSound')?.value, `${view} ${name}`).toBe('./_inc/ccs/sounds/blip.wav');
    }
    expect(ed.history.done.length).toBe(1);
    await ed.setScrollSound(null);
    expect(ed.themeScrollSound()).toBeNull();
  });

  it('puts a moving background on every screen, keeps it through a depth change, and takes it off', async () => {
    const { DESIGNS } = await import('./theme/designs');
    const { movingFileName, MOVING_DIR } = await import('./theme/movingBg');
    await ed.applyDesign(DESIGNS[0]);
    // Making the video needs the app's window; here the file is taken to be made already.
    const rel = `${MOVING_DIR}/${movingFileName('bokeh', ed.designColours()!)}`;
    ed.project!.setAssets([...ed.project!.assets, { rel, kind: 'video', size: 0 }]);
    await ed.setMovingBg('bokeh');
    const { movingBgName } = await import('./theme/designs');
    const bg = (view: string) => (ed.themeRes ?? ed.res)!.views.get(view)?.elements.get(movingBgName(view))?.props.get('path')?.value;
    expect(ed.movingBg()).toBe('bokeh');
    expect(bg('system')).toBe(`./${rel}`);
    expect(bg('detailed')).toBe(`./${rel}`);
    await ed.setDepth('strong');
    expect(bg('detailed')).toBe(`./${rel}`);
    await ed.setMovingBg(null);
    expect(ed.movingBg()).toBeNull();
    expect(bg('system')).toBeUndefined();
  });

  it('places RetroBat’s own clock for every screen instead of adding a second one', async () => {
    const { DESIGNS } = await import('./theme/designs');
    await ed.applyDesign(DESIGNS[0]);
    const res = (ed.themeRes ?? ed.res)!;
    const clock = res.views.get('screen')?.elements.get('clock');
    expect(clock?.type).toBe('clock');
    expect(clock?.extra).toBeFalsy();
    expect(clock?.props.get('pos')?.value).toBe('0.97 0.035');
    for (const view of ['system', 'detailed']) expect(res.views.get(view)?.elements.has('ccs_clock'), view).toBe(false);
    // Applying another design moves the same clock, it doesn't add one.
    await ed.applyDesign(DESIGNS[3]);
    expect(ed.project!.entry!.src.match(/<clock name="clock">/g)).toHaveLength(1);
  });

  it('finds your own full-screen pictures covering the moving background, and hides them in one step', async () => {
    const { DESIGNS } = await import('./theme/designs');
    const { movingFileName, MOVING_DIR } = await import('./theme/movingBg');
    await ed.applyDesign(DESIGNS[0]);
    const rel = `${MOVING_DIR}/${movingFileName('stars', ed.designColours()!)}`;
    ed.project!.setAssets([...ed.project!.assets, { rel, kind: 'video', size: 0 }]);
    await ed.setMovingBg('stars');
    ed.view = 'system';
    ed.addElement('image');
    const sky = ed.selected!;
    ed.setProps(sky, { pos: '0 0', size: '1 1', path: './_inc/images/sky.png', zIndex: '1' });
    ed.addElement('image');
    const small = ed.selected!;
    ed.setProps(small, { pos: '0.7 0.2', size: '0.2 0.2', path: './_inc/images/sticker.png', zIndex: '1' });
    expect(ed.movingBgCovers()).toEqual([{ view: 'system', names: [sky] }]);
    const before = ed.history.done.length;
    ed.hideMovingBgCovers();
    expect(ed.history.done.length).toBe(before + 1);
    expect(ed.movingBgCovers()).toEqual([]);
    const el = (n: string) => (ed.themeRes ?? ed.res)!.views.get('system')?.elements.get(n);
    expect(el(sky)?.props.get('visible')?.value).toBe('false');
    expect(el(small)?.props.get('visible')).toBeUndefined();
    ed.undo(true);
    expect(ed.movingBgCovers()).toEqual([{ view: 'system', names: [sky] }]);
  });

  it('keeps the music and scroll sound when another design is applied', async () => {
    const { DESIGNS } = await import('./theme/designs');
    await ed.applyDesign(DESIGNS[0]);
    await ed.setMusic({ preset: 'chiptune' });
    await ed.setScrollSound({ preset: 'coin' });
    await ed.applyDesign(DESIGNS[3]);
    expect(ed.themeMusic()?.preset).toBe('chiptune');
    const res = ed.themeRes ?? ed.res;
    expect(res!.views.get('system')?.elements.get('systemcarousel')?.props.get('scrollSound')?.value).toBe('./_inc/ccs/sounds/coin.wav');
    expect(res!.views.get('detailed')?.elements.get('gamelist')?.props.get('scrollSound')?.value).toBe('./_inc/ccs/sounds/coin.wav');
  });
});