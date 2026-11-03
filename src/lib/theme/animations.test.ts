import { describe, expect, it } from 'vitest';
import { parse, elements } from '../xml/cst';
import { ANIMATIONS, animationCss, ease, exitOf, EXITS, misplayed, onlyRefresh, playedBoard, presetEvents, presetOf, refreshXml, retune, storyboardXml, tuningOf, type Screen } from './animations';
import type { ResolvedElement } from './resolver';

/** A resolved element with the given storyboards, enough for these helpers. */
function element(xml: string, pos = '0.4 0.5'): ResolvedElement {
  const doc = parse(`<image name="x"><pos>${pos}</pos>${xml}</image>`);
  const root = doc.root!;
  const complex = elements(root)
    .filter((n) => n.name === 'storyboard')
    .map((node) => ({ name: 'storyboard', node, file: null as never, raw: doc.src.slice(node.start, node.end) }));
  return { type: 'image', name: 'x', props: new Map([['pos', { value: pos, raw: pos } as never]]), complex, defs: [], extra: 'true' } as unknown as ResolvedElement;
}

const pos: [number, number] = [0.4, 0.5];
const events = (xml: string) => [...xml.matchAll(/<storyboard(?: event="([^"]*)")?>/g)].map((m) => m[1] ?? '');

describe('motion presets per screen', () => {
  it('console screen entrances have no event, so RetroBat replays them on every console', () => {
    for (const p of ANIMATIONS) expect(events(storyboardXml(p, pos, 1, 1, 'console')), p.id).toEqual(['']);
  });

  it('game list animations use activate (replayed on every game), loops too', () => {
    // RetroBat's video list only updates game data on extras with an activate storyboard (#59).
    for (const p of ANIMATIONS.filter((a) => !a.follow)) expect(events(storyboardXml(p, pos, 1, 1, 'list')), p.id).toEqual(['activate']);
  });

  it('game list loops keep looping on activate, are read back, and play when the list opens', () => {
    const p = ANIMATIONS.find((a) => a.id === 'hover')!;
    const xml = storyboardXml(p, pos, 1, 1, 'list');
    expect(xml).toContain('<storyboard event="activate">');
    expect([...xml.matchAll(/repeat="forever"/g)].length).toBe(2);
    expect(events(storyboardXml(p, pos, 1, 1, 'console'))).toEqual(['']);
    const el = element(xml);
    expect(presetOf(el, 'list')).toBe('hover');
    expect(misplayed(el, 'list')).toBe(false);
    expect(playedBoard(el, { screen: 'list' })).not.toBeNull();
    // Written the old way (no event), it is still a hover.
    expect(presetOf(element(storyboardXml(p, pos, 1, 1, 'console')), 'list')).toBe('hover');
    // Motion off clears both ways of writing it.
    expect(presetEvents(p, 'list')).toEqual(['activate', '']);
    expect(presetEvents(p, 'console')).toEqual(['']);
  });

  it('the refresh storyboard is not an animation', () => {
    const el = element(refreshXml());
    // RetroBat drops empty storyboards, so it holds an animation that changes nothing.
    expect(refreshXml()).toBe('<storyboard event="activate">\n  <animation property="opacity" from="1" to="1" duration="1" />\n</storyboard>');
    expect(presetOf(el, 'list')).toBeNull();
    expect(onlyRefresh(el)).toBe(true);
    expect(onlyRefresh(element(storyboardXml(ANIMATIONS[0], pos)))).toBe(false);
  });

  it('"Slide with the list" comes from the side you scroll from', () => {
    const p = ANIMATIONS.find((a) => a.id === 'follow')!;
    expect(presetEvents(p, 'list')).toEqual(['activateNext', 'activatePrev', 'activate']);
    const [next, prev] = p.build(pos, 1, 1, 'list');
    expect(Number(next.animations[0].from)).toBeGreaterThan(pos[0]);
    expect(Number(prev.animations[0].from)).toBeLessThan(pos[0]);
  });

  it('reads every preset back on both screens, with its size and speed', () => {
    for (const screen of ['list', 'console'] as Screen[])
      for (const p of ANIMATIONS) {
        const el = element(storyboardXml(p, pos, p.amount ? 1.2 : 1, 2, screen));
        const t = tuningOf(el, screen);
        expect(t?.preset.id, `${screen} ${p.id}`).toBe(p.id);
        expect(t!.amount).toBe(p.amount ? 1.2 : 1);
        expect(t!.speed).toBeCloseTo(2, 1);
      }
  });

  it('retuning a combo also moves when its loop starts', () => {
    const p = ANIMATIONS.find((a) => a.id === 'rise-float')!;
    const el = element(storyboardXml(p, pos));
    const t = tuningOf(el)!;
    const edits = retune(t, pos, 1, 2);
    expect(edits.some((e) => e.name === 'begin' && e.value === '400')).toBe(true);
  });

  it('spots entrances written for game lists on the console screen', () => {
    const el = element(storyboardXml(ANIMATIONS[0], pos, 1, 1, 'list'));
    expect(misplayed(el, 'console')).toBe(true);
    expect(misplayed(el, 'list')).toBe(false);
    expect(tuningOf(el, 'console')?.preset.id).toBe('fade-in');
    expect(misplayed(element(storyboardXml(ANIMATIONS[0], pos, 1, 1, 'console')), 'console')).toBe(false);
  });

  it('exits are recognised and kept apart from the main motion', () => {
    const slide = EXITS.find((x) => x.id === 'slide-away')!;
    const xml = storyboardXml(ANIMATIONS.find((a) => a.id === 'pop')!, pos) + slide.build(pos, 1).map((b) => `<storyboard event="${b.event}">${b.animations.map((a) => `<animation ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')}</storyboard>`).join('');
    const el = element(xml);
    expect(exitOf(el)).toBe('slide-away');
    expect(tuningOf(el)?.preset.id).toBe('pop');
  });
});

describe('preview plays what RetroBat plays', () => {
  it('uses RetroBat’s easing curves, bump overshooting before it settles', () => {
    expect(ease('easeOut', 0.5)).toBeCloseTo(0.75);
    expect(ease('bump', 0.6)).toBeGreaterThan(1.2);
    expect(ease('bump', 1)).toBeCloseTo(1);
  });

  it('picks the storyboard for the direction moved in a game list, and none for list-only boards on consoles', () => {
    const el = element(storyboardXml(ANIMATIONS.find((a) => a.id === 'follow')!, pos));
    const from = (o: Parameters<typeof playedBoard>[1]) => playedBoard(el, o)?.[0].attrs.find((a) => a.name === 'from')?.value;
    expect(Number(from({ screen: 'list', dir: 1 }))).toBeGreaterThan(pos[0]);
    expect(Number(from({ screen: 'list', dir: -1 }))).toBeLessThan(pos[0]);
    expect(playedBoard(element(storyboardXml(ANIMATIONS[0], pos)), { screen: 'console' })).toBeNull();
  });

  it('a combo plays its entrance once, then its loop forever', () => {
    const el = element(storyboardXml(ANIMATIONS.find((a) => a.id === 'rise-float')!, pos));
    const css = animationCss(el, 1920, 1080, 'translate(0, 0)', { screen: 'list' })!;
    expect(css).toMatch(/^ccs-a-\w+ 800ms linear 1 normal both, ccs-l-\w+ 6000ms linear 800ms infinite normal none$/);
  });

  it('a new game or console gives a new animation name, so it plays again', () => {
    const el = element(storyboardXml(ANIMATIONS[0], pos));
    const a = animationCss(el, 100, 100, '', { screen: 'list', token: 'snes|1' });
    const b = animationCss(el, 100, 100, '', { screen: 'list', token: 'snes|2' });
    expect(a).not.toBe(b);
  });
});
