// How RetroBat draws its loading screens (es-core/src/Splash.cpp), so the preview matches:
//
// - A theme's splash.xml (gamesplash.xml for game launches) replaces RetroBat's own completely.
// - Only extras are drawn, plus three built-in parts: the "background" image, the "label" text
//   and the "progressbar" / "progressbar:active" bar. Other elements are ignored.
// - The built-in parts start from RetroBat's own placement, and the theme only changes what it
//   sets. The background is centred (origin 0.5 0.5), so `pos` without `origin` moves its centre.
// - Drawing order is fixed: extras with zIndex below 5, the background, extras 5–10, the
//   progress bar, the label, then extras 10 and up.

import type { PropDef, ResolvedElement, ResolvedView } from './resolver';
import type { ThemeFile } from './project';
import { isVisible } from '../render';

/** Element types RetroBat always treats as extras (ThemeData.cpp `_autoExtraTypes`). */
const AUTO_EXTRA = new Set(['stackpanel', 'container', 'screenshader', 'clock', 'networkIcon', 'webimage', 'batteryText', 'batteryIcon', 'rectangle']);
/** The parts RetroBat always draws on a loading screen (by name). */
export const BUILT_IN_SPLASH = new Set(['background', 'label', 'progressbar', 'progressbar:active', 'splash']);
const BUILT_IN = BUILT_IN_SPLASH;

export interface SplashBar {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Corner radius in screen fractions of the larger side. */
  round: number;
  color: string;
  colorEnd: string;
  activeColor: string;
  activeColorEnd: string;
}

export interface SplashScene {
  /** Screen colour behind everything (the `splash` element's backgroundColor). */
  backgroundColor: string;
  /** What to draw, already in RetroBat's order, with its built-in defaults filled in. */
  elements: ResolvedElement[];
  bar: SplashBar;
  /** Where the bar goes in the drawing order (index into `elements`). */
  barIndex: number;
  /** Elements in the file that RetroBat doesn't draw on a loading screen. */
  ignored: string[];
}

export function isSplashExtra(e: ResolvedElement): boolean {
  return (e.extra ?? '').toLowerCase() === 'true' || e.extra === 'static' || AUTO_EXTRA.has(e.type);
}

/** A display-only copy of `el` (or a new element) with `defaults` for properties it doesn't set. */
function withDefaults(el: ResolvedElement | undefined, name: string, type: string, file: ThemeFile, defaults: Record<string, string>): ResolvedElement {
  const fakeNode = { parent: { kind: 'built-in' } } as unknown as PropDef['node'];
  const props = new Map(el?.props ?? []);
  const history = new Map(el?.history ?? []);
  for (const [k, v] of Object.entries(defaults)) {
    if (props.has(k)) continue;
    const def: PropDef = { name: k, raw: v, value: v, node: fakeNode, file, conditional: false };
    props.set(k, def);
    history.set(k, [def]);
  }
  return { name, type, extra: el?.extra ?? null, defs: el?.defs ?? [], props, history, complex: el?.complex ?? [], conditional: el?.conditional ?? false, unknownConditions: el?.unknownConditions ?? 0, order: el?.order ?? -1 };
}

const pair = (v: string | undefined, d: [number, number]): [number, number] => {
  const p = (v ?? '').trim().split(/\s+/).map(Number);
  return p.length === 2 && p.every(Number.isFinite) ? [p[0], p[1]] : d;
};

/**
 * The loading screen RetroBat would draw for `view` (the `splash` view of splash.xml or
 * gamesplash.xml). `defaultImage` is RetroBat's own splash picture.
 */
export function splashScene(view: ResolvedView | null | undefined, file: ThemeFile, defaultImage: string): SplashScene {
  const els = view?.elements ?? new Map<string, ResolvedElement>();
  const bgEl = els.get('background');
  // Without a themed background, RetroBat's picture fills the screen; with one, it fits inside it.
  const background = withDefaults(bgEl, 'background', 'image', file, {
    pos: '0.5 0.5',
    origin: '0.5 0.5',
    path: defaultImage,
    ...(bgEl ? { maxSize: '1 1' } : { minSize: '1 1' }),
  });
  const label = withDefaults(els.get('label'), 'label', 'text', file, {
    text: 'Loading…',
    pos: '0 0.78',
    size: '1 0.045',
    fontSize: '0.045',
    alignment: 'center',
    color: 'FFFFFFFF',
    ...(els.get('label') ? {} : { glowColor: '00000020', glowSize: '2' }),
  });

  const inactive = els.get('progressbar');
  const active = els.get('progressbar:active');
  const val = (e: ResolvedElement | undefined, k: string) => e?.props.get(k)?.value;
  const [x, y] = pair(val(inactive, 'pos'), [0.25, 1 - 3 * 0.036]);
  const [w, h] = pair(val(inactive, 'size'), [0.5, 0.036]);
  const bar: SplashBar = {
    x,
    y,
    w,
    h,
    round: Number(val(inactive, 'roundCorners') ?? 0) || 0,
    color: val(inactive, 'color') ?? '6060607F',
    colorEnd: val(inactive, 'colorEnd') ?? val(inactive, 'color') ?? '9090907F',
    // RetroBat sets the filled part's red gradient after applying "progressbar", so only
    // "progressbar:active" changes it.
    activeColor: val(active, 'color') ?? 'DF1010FF',
    activeColorEnd: val(active, 'colorEnd') ?? val(active, 'color') ?? '4F0000FF',
  };

  const extras = [...els.values()].filter((e) => !BUILT_IN.has(e.name) && isSplashExtra(e));
  const z = (e: ResolvedElement) => {
    const n = parseFloat(e.props.get('zIndex')?.value ?? '');
    return Number.isFinite(n) ? n : 0;
  };
  const byZ = (a: ResolvedElement, b: ResolvedElement) => z(a) - z(b) || a.order - b.order;
  const below = extras.filter((e) => z(e) < 5).sort(byZ);
  const middle = extras.filter((e) => z(e) >= 5 && z(e) < 10).sort(byZ);
  const top = extras.filter((e) => z(e) >= 10).sort(byZ);
  const elements = [...below, ...(isVisible(background) ? [background] : []), ...middle];
  const barIndex = elements.length;
  elements.push(label, ...top);
  const ignored = [...els.values()].filter((e) => !BUILT_IN.has(e.name) && !isSplashExtra(e)).map((e) => e.name);
  const bgColor = els.get('splash')?.props.get('backgroundColor')?.value ?? '000000FF';
  return { backgroundColor: bgColor, elements, bar, barIndex, ignored };
}

/**
 * A new splash.xml or gamesplash.xml: RetroBat's own look, with its built-in parts written out
 * so they can be changed (the label's text is set by RetroBat while it loads).
 */
export function splashTemplate(game: boolean): string {
  const what = game ? 'while a game starts' : 'while RetroBat starts';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- What RetroBat shows ${what}. Only the background, the label, the progress bar and
     elements marked extra="true" are drawn here. Made with ChannelCraft Studio. -->
<theme>
  <formatVersion>7</formatVersion>
  <view name="splash">
    <splash name="splash">
      <backgroundColor>000000FF</backgroundColor>
    </splash>
    <image name="background">
      <pos>0.5 0.5</pos>
      <origin>0.5 0.5</origin>
      <maxSize>1 1</maxSize>
    </image>
    <text name="label">
      <pos>0 0.78</pos>
      <size>1 0.045</size>
      <fontSize>0.045</fontSize>
      <alignment>center</alignment>
      <color>FFFFFFFF</color>
    </text>
    <image name="progressbar">
      <pos>0.25 0.892</pos>
      <size>0.5 0.036</size>
      <color>6060607F</color>
      <colorEnd>9090907F</colorEnd>
    </image>
    <image name="progressbar:active">
      <color>DF1010FF</color>
      <colorEnd>4F0000FF</colorEnd>
    </image>
  </view>
</theme>
`;
}
