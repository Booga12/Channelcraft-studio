// Animation presets written as RetroBat storyboards, and a preview that plays storyboards the way
// RetroBat does. Storyboard syntax follows what RetroBat's ThemeStoryboard.cpp reads:
//   <storyboard event="activate"><animation property="opacity" from="0" to="1" duration="600" mode="easeOut"/></storyboard>
// `duration` and `begin` are read as plain numbers there (no ${variables}), so speed is written on
// every animation rather than through a shared variable.
//
// When RetroBat plays which storyboard (batocera-emulationstation):
// - Game lists (DetailedContainer::handleStoryBoard): moving to another game plays `activateNext`
//   (down) or `activatePrev` (up) when the element has one, else `activate`. Opening the list plays
//   `open`, else the storyboard without an event, else `activate`. Leaving a game plays
//   `deactivate` / `deactivateNext` / `deactivatePrev`.
// - The console screen (SystemView::activateExtras): each console's extras are shown again with
//   onShow(), which restarts the storyboard without an event. Event storyboards never play there.
// - Each animation has its own `begin` and `repeat`, so one storyboard can hold an entrance
//   followed by an endless loop (one storyboard per event is all an element can have).

import { attr, elements, type XElement } from '../xml/cst';
import type { ResolvedElement } from './resolver';
import { parsePair } from './schema';

/** The console screen replays event-less storyboards; game lists replay `activate`. */
export type Screen = 'console' | 'list';
export const screenOf = (view: string): Screen => (view === 'system' ? 'console' : 'list');

export interface Board {
  event: string;
  animations: Record<string, string>[];
}

export interface AnimPreset {
  id: string;
  label: string;
  help: string;
  /** Plays as the element appears, loops forever, or both (an entrance, then a loop). */
  kind: 'entrance' | 'loop' | 'combo';
  /** The motion can be made bigger or smaller (the first animation's travel, tilt or growth). */
  amount: boolean;
  /** On game lists it comes from the side you scroll from. */
  follow?: boolean;
  /**
   * The storyboards at the element's position. `amount` scales how far the first animation goes
   * (1 = the preset's own), `speed` divides every duration (2 = twice as fast).
   */
  build: (pos: [number, number], amount: number, speed: number, screen: Screen) => Board[];
}

const r = (n: number) => String(Math.round(n * 10000) / 10000);
const ms = (n: number, speed: number) => String(Math.max(50, Math.round(n / speed)));
type A = Record<string, string>;
/** An entrance: replayed on every game (lists) or every console (console screen). */
const appear = (screen: Screen, animations: A[]): Board[] => [{ event: screen === 'console' ? '' : 'activate', animations }];
const loop = (animations: A[]): Board[] => [{ event: '', animations }];
const fade = (d: number, sp: number, mode = 'easeOut'): A => ({ property: 'opacity', from: '0', to: '1', duration: ms(d, sp), mode });

export const ANIMATIONS: AnimPreset[] = [
  {
    id: 'fade-in',
    label: 'Fade in',
    help: 'Gently appears, again on every game or console you move to.',
    kind: 'entrance',
    amount: false,
    build: (_p, _a, sp, s) => appear(s, [fade(600, sp)]),
  },
  {
    id: 'follow',
    label: 'Slide with the list',
    help: 'Slides in from the side you scroll from, like the list is pushing it along.',
    kind: 'entrance',
    amount: true,
    follow: true,
    build: ([x], a, sp, s) => {
      const from = (dir: number): A[] => [
        { property: 'x', from: r(x + dir * 0.06 * a), to: r(x), duration: ms(450, sp), mode: 'easeOutCubic' },
        fade(300, sp),
      ];
      if (s === 'console') return [{ event: '', animations: from(1) }];
      return [
        { event: 'activateNext', animations: from(1) },
        { event: 'activatePrev', animations: from(-1) },
        { event: 'activate', animations: from(1) },
      ];
    },
  },
  {
    id: 'slide-left',
    label: 'Slide in from the left',
    help: 'Slides in from the left while fading in.',
    kind: 'entrance',
    amount: true,
    build: ([x], a, sp, s) => appear(s, [{ property: 'x', from: r(x - 0.08 * a), to: r(x), duration: ms(600, sp), mode: 'easeOut' }, fade(600, sp)]),
  },
  {
    id: 'slide-right',
    label: 'Slide in from the right',
    help: 'Slides in from the right while fading in.',
    kind: 'entrance',
    amount: true,
    build: ([x], a, sp, s) => appear(s, [{ property: 'x', from: r(x + 0.08 * a), to: r(x), duration: ms(600, sp), mode: 'easeOut' }, fade(600, sp)]),
  },
  {
    id: 'rise',
    label: 'Rise up',
    help: 'Moves up into place while fading in.',
    kind: 'entrance',
    amount: true,
    build: ([, y], a, sp, s) => appear(s, [{ property: 'y', from: r(y + 0.05 * a), to: r(y), duration: ms(700, sp), mode: 'easeOut' }, fade(700, sp)]),
  },
  {
    id: 'pop',
    label: 'Pop in',
    help: 'Grows from small to full size.',
    kind: 'entrance',
    amount: true,
    build: (_p, a, sp, s) => appear(s, [{ property: 'scale', from: r(Math.max(0.05, 1 - 0.4 * a)), to: '1', duration: ms(450, sp), mode: 'easeOut' }, fade(300, sp)]),
  },
  {
    id: 'drop-bounce',
    label: 'Drop and bounce',
    help: 'Falls into place from above and bounces once.',
    kind: 'entrance',
    amount: true,
    build: ([, y], a, sp, s) => appear(s, [{ property: 'y', from: r(y - 0.1 * a), to: r(y), duration: ms(750, sp), mode: 'bump' }, fade(250, sp, 'linear')]),
  },
  {
    id: 'zoom-bounce',
    label: 'Pop and bounce',
    help: 'Pops up from small, overshoots a little and settles. Lively for box art and logos.',
    kind: 'entrance',
    amount: true,
    build: (_p, a, sp, s) => appear(s, [{ property: 'scale', from: r(Math.max(0.05, 1 - 0.7 * a)), to: '1', duration: ms(650, sp), mode: 'bump' }, fade(200, sp, 'linear')]),
  },
  {
    id: 'swing-in',
    label: 'Swing in',
    help: 'Swings into place like a hanging sign, then settles.',
    kind: 'entrance',
    amount: true,
    build: (_p, a, sp, s) => appear(s, [{ property: 'rotation', from: r(-14 * a), to: '0', duration: ms(800, sp), mode: 'bump' }, fade(300, sp)]),
  },
  {
    id: 'zoom-in',
    label: 'Zoom down',
    help: 'Starts large and close, then lands in place.',
    kind: 'entrance',
    amount: true,
    build: (_p, a, sp, s) => appear(s, [{ property: 'scale', from: r(1 + 0.6 * a), to: '1', duration: ms(500, sp), mode: 'easeOutCubic' }, fade(400, sp)]),
  },
  {
    id: 'glide-up',
    label: 'Glide up',
    help: 'Glides up into place and slows down gently at the end. Smooth and calm.',
    kind: 'entrance',
    amount: true,
    build: ([, y], a, sp, s) => appear(s, [{ property: 'y', from: r(y + 0.035 * a), to: r(y), duration: ms(900, sp), mode: 'easeOutQuint' }, fade(700, sp)]),
  },
  {
    id: 'soft-zoom',
    label: 'Soft zoom',
    help: 'Grows the last little bit into place while fading in, like coming into focus.',
    kind: 'entrance',
    amount: true,
    build: (_p, a, sp, s) => appear(s, [{ property: 'scale', from: r(Math.max(0.05, 1 - 0.08 * a)), to: '1', duration: ms(800, sp), mode: 'easeOutQuint' }, fade(600, sp)]),
  },
  {
    id: 'drift-in',
    label: 'Drift in',
    help: 'Drifts in slowly from the left and settles. Good for big artwork.',
    kind: 'entrance',
    amount: true,
    build: ([x], a, sp, s) => appear(s, [{ property: 'x', from: r(x - 0.035 * a), to: r(x), duration: ms(1100, sp), mode: 'easeOutQuint' }, fade(800, sp)]),
  },
  {
    id: 'tilt-in',
    label: 'Tilt in',
    help: 'Turns upright while growing into place, as if tipping towards you.',
    kind: 'entrance',
    amount: true,
    build: (_p, a, sp, s) =>
      appear(s, [
        { property: 'rotation', from: r(-6 * a), to: '0', duration: ms(750, sp), mode: 'easeOutCubic' },
        { property: 'scale', from: '0.94', to: '1', duration: ms(750, sp), mode: 'easeOutCubic' },
        fade(450, sp),
      ]),
  },
  {
    id: 'rise-float',
    label: 'Rise, then float',
    help: 'Rises into place, then keeps bobbing gently.',
    kind: 'combo',
    amount: true,
    build: ([, y], a, sp, s) =>
      appear(s, [
        { property: 'y', from: r(y + 0.05 * a), to: r(y), duration: ms(700, sp), mode: 'easeOut' },
        fade(700, sp),
        { property: 'y', from: r(y), to: r(y - 0.008), begin: ms(800, sp), duration: ms(3000, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' },
      ]),
  },
  {
    id: 'pop-pulse',
    label: 'Pop, then pulse',
    help: 'Pops in, then keeps pulsing softly like a heartbeat.',
    kind: 'combo',
    amount: true,
    build: (_p, a, sp, s) =>
      appear(s, [
        { property: 'scale', from: r(Math.max(0.05, 1 - 0.4 * a)), to: '1', duration: ms(450, sp), mode: 'bump' },
        fade(300, sp),
        { property: 'scale', from: '1', to: '1.04', begin: ms(600, sp), duration: ms(1200, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' },
      ]),
  },
  {
    id: 'float',
    label: 'Float',
    help: 'Bobs gently up and down, all the time.',
    kind: 'loop',
    amount: true,
    build: ([, y], a, sp) => loop([{ property: 'y', from: r(y), to: r(y - 0.008 * a), duration: ms(3000, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' }]),
  },
  {
    id: 'hover',
    label: 'Hover',
    help: 'Floats up and comes a little closer, then back, like it is hovering. Adds depth.',
    kind: 'loop',
    amount: true,
    build: ([, y], a, sp) =>
      loop([
        { property: 'y', from: r(y), to: r(y - 0.007 * a), duration: ms(3200, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' },
        { property: 'scale', from: '1', to: r(1 + 0.018 * a), duration: ms(3200, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' },
      ]),
  },
  {
    id: 'sway',
    label: 'Gentle sway',
    help: 'Rocks very slightly and bobs, like it is floating on water.',
    kind: 'loop',
    amount: true,
    build: ([, y], a, sp) =>
      loop([
        { property: 'rotation', from: r(-1.5 * a), to: r(1.5 * a), duration: ms(4200, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' },
        { property: 'y', from: r(y), to: r(y - 0.005 * a), duration: ms(2700, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' },
      ]),
  },
  {
    id: 'drift',
    label: 'Drift',
    help: 'Drifts slowly sideways and back, so a layer seems to move at its own distance.',
    kind: 'loop',
    amount: true,
    build: ([x, y], a, sp) =>
      loop([
        { property: 'x', from: r(x), to: r(x + 0.008 * a), duration: ms(9000, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' },
        { property: 'y', from: r(y), to: r(y - 0.004 * a), duration: ms(6000, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' },
      ]),
  },
  {
    id: 'slow-zoom',
    label: 'Slow zoom',
    help: 'Zooms in very slowly and back out, so a background seems to move behind the rest.',
    kind: 'loop',
    amount: true,
    // Starts a little above full size, which also tells it apart from Pulse when read back.
    build: (_p, a, sp) => loop([{ property: 'scale', from: '1.03', to: r(1.03 + 0.06 * a), duration: ms(16000, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' }]),
  },
  {
    id: 'pulse',
    label: 'Pulse',
    help: 'Grows and shrinks slightly, like a heartbeat.',
    kind: 'loop',
    amount: true,
    build: (_p, a, sp) => loop([{ property: 'scale', from: '1', to: r(1 + 0.05 * a), duration: ms(1200, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' }]),
  },
  {
    id: 'breathe',
    label: 'Glow breathe',
    help: 'Fades a little in and out, like a soft glow.',
    kind: 'loop',
    amount: true,
    build: (_p, a, sp) => loop([{ property: 'opacity', from: r(Math.max(0, 1 - 0.45 * a)), to: '1', duration: ms(1800, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' }]),
  },
  {
    id: 'swing',
    label: 'Swing',
    help: 'Tilts gently from side to side.',
    kind: 'loop',
    amount: true,
    build: (_p, a, sp) => loop([{ property: 'rotation', from: r(-3 * a), to: r(3 * a), duration: ms(2400, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' }]),
  },
  {
    id: 'spin',
    label: 'Spin',
    help: 'Turns round and round slowly. Good for discs and logos.',
    kind: 'loop',
    amount: false,
    build: (_p, _a, sp) => loop([{ property: 'rotation', from: '0', to: '360', duration: ms(6000, sp), mode: 'linear', repeat: 'forever' }]),
  },
];

/** Element types that never get looping motion: moving video stutters and pulls the eye. */
export const STILL_TYPES = new Set(['video']);

// ---- exits (game lists only) ----------------------------------------------------------------

export const EXIT_EVENTS = new Set(['deactivate', 'deactivateNext', 'deactivatePrev']);

export interface ExitPreset {
  id: string;
  label: string;
  help: string;
  build: (pos: [number, number], speed: number) => Board[];
}

export const EXITS: ExitPreset[] = [
  {
    id: 'fade-out',
    label: 'Fade out',
    help: 'Fades away quickly as you move on.',
    build: (_p, sp) => [{ event: 'deactivate', animations: [{ property: 'opacity', to: '0', duration: ms(200, sp), mode: 'easeIn' }] }],
  },
  {
    id: 'shrink',
    label: 'Shrink away',
    help: 'Shrinks and fades as you move on.',
    build: (_p, sp) => [
      {
        event: 'deactivate',
        animations: [
          { property: 'scale', to: '0.85', duration: ms(220, sp), mode: 'easeIn' },
          { property: 'opacity', to: '0', duration: ms(220, sp), mode: 'easeIn' },
        ],
      },
    ],
  },
  {
    id: 'slide-away',
    label: 'Slide away with the list',
    help: 'Slides out towards the side you scroll to.',
    build: ([x], sp) => {
      const to = (dir: number): A[] => [
        { property: 'x', to: r(x - dir * 0.05), duration: ms(220, sp), mode: 'easeIn' },
        { property: 'opacity', to: '0', duration: ms(220, sp), mode: 'easeIn' },
      ];
      return [
        { event: 'deactivateNext', animations: to(1) },
        { event: 'deactivatePrev', animations: to(-1) },
        { event: 'deactivate', animations: [{ property: 'opacity', to: '0', duration: ms(200, sp), mode: 'easeIn' }] },
      ];
    },
  },
];

// ---- markup ---------------------------------------------------------------------------------

function boardXml(b: Board): string {
  const lines = [`<storyboard${b.event ? ` event="${b.event}"` : ''}>`];
  for (const a of b.animations) lines.push(`  <animation ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')} />`);
  lines.push('</storyboard>');
  return lines.join('\n');
}

/** Storyboard markup for boards, two-space indented. */
export function boardsXml(boards: Board[]): string {
  return boards.map(boardXml).join('\n');
}

/** Storyboard markup for a preset on a screen, two-space indented. */
export function storyboardXml(preset: AnimPreset, pos: [number, number], amount = 1, speed = 1, screen: Screen = 'list'): string {
  return boardsXml(preset.build(pos, amount, speed, screen));
}

/** The events a preset writes on a screen. */
export function presetEvents(preset: AnimPreset, screen: Screen): string[] {
  return preset.build([0, 0], 1, 1, screen).map((b) => b.event);
}

// ---- reading storyboards back -----------------------------------------------------------------

export interface AnimTuning {
  preset: AnimPreset;
  /** 1 = the preset's own size. */
  amount: number;
  /** 1 = the preset's own speed; 2 = twice as fast. */
  speed: number;
  /** Duration of the first animation, in milliseconds. */
  duration: number;
  /** The storyboards that make up the preset, in the preset's order. */
  storyboards: XElement[];
  /** Their animations. */
  animations: XElement[][];
}

const num = (s: string | undefined) => (s === undefined ? NaN : parseFloat(s));
const near = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const loops = (v: string | undefined) => v === 'forever' || v === 'infinite';

interface SB {
  node: XElement;
  event: string;
  anims: XElement[];
}

function storyboardsOf(el: ResolvedElement): SB[] {
  return el.complex
    .filter((c) => c.name === 'storyboard')
    .map((c) => ({ node: c.node, event: attr(c.node, 'event') ?? '', anims: elements(c.node).filter((n) => n.name === 'animation') }))
    .filter((s) => s.anims.length);
}

/** The element's storyboards for its main motion (not the exit ones). */
const mainBoards = (el: ResolvedElement) => storyboardsOf(el).filter((s) => !EXIT_EVENTS.has(s.event));

function sameShape(have: SB[], want: Board[]): boolean {
  if (have.length !== want.length) return false;
  const mode = (n: XElement) => (attr(n, 'mode') ?? attr(n, 'easingMode') ?? 'linear').toLowerCase();
  return want.every(
    (w, i) =>
      w.animations.length === have[i].anims.length &&
      w.animations.every((a, j) => attr(have[i].anims[j], 'property') === a.property && loops(attr(have[i].anims[j], 'repeat')) === loops(a.repeat) && mode(have[i].anims[j]) === (a.mode ?? 'linear').toLowerCase()),
  );
}

function sameValues(have: SB[], want: Board[]): boolean {
  return want.every((w, i) =>
    w.animations.every((a, j) => {
      const n = have[i].anims[j];
      return (['from', 'to'] as const).every((k) => a[k] === undefined || near(num(attr(n, k)), num(a[k])));
    }),
  );
}

/**
 * Which preset an element's storyboards match, and how big and fast it is. Hand-written
 * storyboards of the same shape count too (for example a theme's own gentle bob). Events are not
 * compared, so an entrance written for the wrong screen is still recognised (see `misplayed`).
 */
export function tuningOf(el: ResolvedElement, screen: Screen = 'list'): AnimTuning | null {
  const have = mainBoards(el);
  if (!have.length) return null;
  const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
  // This screen's own way of writing first, then the other screen's (written in the wrong place).
  for (const s of [screen, screen === 'list' ? 'console' : 'list'] as Screen[]) {
    for (const p of ANIMATIONS) {
      const want = p.build(pos, 1, 1, s);
      if (!sameShape(have, want)) continue;
      const w0 = want[0].animations[0];
      const d0 = num(w0.to) - num(w0.from);
      const d = num(attr(have[0].anims[0], 'to')) - num(attr(have[0].anims[0], 'from'));
      if (!Number.isFinite(d)) continue;
      const amount = d0 === 0 ? 1 : d / d0;
      if (!(amount > 0) || (!p.amount && !near(amount, 1))) continue;
      // Everything else must be the preset's own at that size.
      if (!sameValues(have, p.build(pos, p.amount ? amount : 1, 1, s))) continue;
      const duration = num(attr(have[0].anims[0], 'duration'));
      const speed = Number.isFinite(duration) && duration > 0 ? num(w0.duration) / duration : 1;
      return { preset: p, amount: Math.round(amount * 100) / 100, speed, duration: Number.isFinite(duration) ? duration : num(w0.duration), storyboards: have.map((h) => h.node), animations: have.map((h) => h.anims) };
    }
  }
  return null;
}

/** Which preset an element's storyboards came from, for the UI. */
export function presetOf(el: ResolvedElement, screen: Screen = 'list'): string | null {
  if (!mainBoards(el).length) return null;
  return tuningOf(el, screen)?.preset.id ?? 'custom';
}

/** Which exit an element has: an id, 'custom', or null. */
export function exitOf(el: ResolvedElement): string | null {
  const have = storyboardsOf(el).filter((s) => EXIT_EVENTS.has(s.event));
  if (!have.length) return null;
  const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
  for (const x of EXITS) {
    const want = x.build(pos, 1);
    if (sameShape(have, want) && want.every((w, i) => w.event === have[i].event)) return x.id;
  }
  return 'custom';
}

/** The element's exit storyboards. */
export function exitBoards(el: ResolvedElement): XElement[] {
  return storyboardsOf(el)
    .filter((s) => EXIT_EVENTS.has(s.event))
    .map((s) => s.node);
}

/** RetroBat never plays these storyboards on this screen (event storyboards on the console screen). */
export function misplayed(el: ResolvedElement, screen: Screen): boolean {
  return screen === 'console' && storyboardsOf(el).some((s) => s.event !== '');
}

/** Attribute values that give the storyboards a new amount and speed (other attributes stay). */
export function retune(t: AnimTuning, pos: [number, number], amount: number, speed: number, screen: Screen = 'list'): { node: XElement; name: string; value: string }[] {
  const want = t.preset.build(pos, t.preset.amount ? amount : 1, speed, screen);
  const out: { node: XElement; name: string; value: string }[] = [];
  want.forEach((b, i) =>
    b.animations.forEach((w, j) => {
      const node = t.animations[i]?.[j];
      if (!node) return;
      for (const k of ['from', 'to', 'duration', 'begin'] as const) if (w[k] !== undefined && attr(node, k) !== w[k]) out.push({ node, name: k, value: w[k] });
    }),
  );
  return out;
}

// ---- preview: RetroBat's timing, sampled into CSS keyframes ----------------------------------

const injected = new Set<string>();

function inject(name: string, css: string) {
  if (injected.has(name) || typeof document === 'undefined') return;
  injected.add(name);
  const s = document.createElement('style');
  s.dataset.ccsAnim = name;
  s.textContent = css;
  document.head.appendChild(s);
}

/** RetroBat's easing curves (StoryboardAnimator.h); the mode is lower-cased there. */
export function ease(mode: string, t: number): number {
  switch (mode.toLowerCase()) {
    case 'easein':
      return t * t;
    case 'easeincubic':
      return t * t * t;
    case 'easeinquint':
      return t ** 5;
    case 'easeout':
      return -t * (t - 2);
    case 'easeoutcubic':
      return (t - 1) ** 3 + 1;
    case 'easeoutquint':
      return (t - 1) ** 5 + 1;
    case 'easeinout': {
      const u = t * 2;
      return u < 1 ? (u * u) / 2 : -0.5 * ((u - 1) * (u - 3) - 1);
    }
    case 'bump':
      return Math.sin((Math.PI / 2) * t) + Math.sin(Math.PI * t) / 2;
    default:
      return t;
  }
}

interface Track {
  prop: string;
  from?: number;
  to?: number;
  begin: number;
  duration: number;
  mode: string;
  reverse: boolean;
  /** 0 = forever. */
  repeat: number;
}

function track(n: XElement): Track | null {
  const prop = attr(n, 'property');
  if (!prop) return null;
  const rep = attr(n, 'repeat');
  const f = num(attr(n, 'from'));
  const t = num(attr(n, 'to'));
  return {
    prop,
    from: Number.isFinite(f) ? f : undefined,
    to: Number.isFinite(t) ? t : undefined,
    begin: Math.max(0, num(attr(n, 'begin')) || 0),
    duration: Math.max(0, num(attr(n, 'duration')) || 0),
    mode: attr(n, 'mode') ?? attr(n, 'easingMode') ?? 'linear',
    reverse: ['true', '1'].includes(attr(n, 'autoReverse') ?? attr(n, 'autoreverse') ?? ''),
    repeat: loops(rep) ? 0 : Math.max(1, parseInt(rep ?? '1', 10) || 1),
  };
}

const cycle = (k: Track) => k.duration * (k.reverse ? 2 : 1);

/** A track's value at time `t`, or undefined before it starts. `base` is the element's own value. */
function valueAt(k: Track, t: number, base: number): number | undefined {
  const local = t - k.begin;
  if (local < 0) return undefined;
  const from = k.from ?? base;
  const to = k.to ?? base;
  const c = cycle(k);
  if (c <= 0 || (k.repeat > 0 && local >= c * k.repeat)) return k.reverse ? from : to;
  const phase = local % c;
  const p = phase <= k.duration ? phase / k.duration : (c - phase) / k.duration;
  return from + (to - from) * ease(k.mode, Math.min(1, Math.max(0, p)));
}

export interface PlayOptions {
  screen: Screen;
  /** Changes when the shown game or console changes, so the motion plays again. */
  token?: string;
  /** +1 after moving down the list, -1 after moving up. */
  dir?: number;
  /** Preview only: movement, turning and growth times this, to make small motion easy to see. */
  boost?: number;
}

/** The storyboard RetroBat plays on this screen (see the notes at the top). */
export function playedBoard(el: ResolvedElement, o: PlayOptions): XElement[] | null {
  const all = storyboardsOf(el);
  const by = (e: string) => all.find((s) => s.event === e);
  const pick = o.screen === 'console' ? by('') : ((o.dir ?? 0) > 0 && by('activateNext')) || ((o.dir ?? 0) < 0 && by('activatePrev')) || ((o.dir ?? 0) !== 0 && by('activate')) || by('open') || by('') || by('activate');
  return pick ? pick.anims : null;
}

/**
 * A CSS `animation` value playing the element's storyboard as RetroBat would on this screen.
 * `base` is the element's normal transform, which the keyframes keep while adding scale,
 * rotation and movement.
 */
export function animationCss(el: ResolvedElement, W: number, H: number, base: string, o: PlayOptions = { screen: 'list' }): string | null {
  const anims = playedBoard(el, o);
  if (!anims) return null;
  const tracks = anims.map(track).filter((k): k is Track => !!k && k.prop !== 'sound');
  if (!tracks.length) return null;
  const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
  const baseOf: Record<string, number> = { opacity: 1, scale: 1, rotation: 0, x: pos[0], y: pos[1], offsetX: 0, offsetY: 0 };
  const frame = (t: number) => {
    const v: Record<string, number> = {};
    for (const k of tracks) {
      const x = valueAt(k, t, baseOf[k.prop] ?? 0);
      if (x !== undefined) v[k.prop] = x;
    }
    const opacity = v.opacity === undefined ? null : v.opacity > 1 ? v.opacity / 255 : v.opacity;
    // Movement in screen fractions, times the screen size the element carries in --ccs-w / --ccs-h,
    // so zooming the preview doesn't make new keyframes (which would restart the motion).
    const k = o.boost ?? 1;
    const dx = ((v.x !== undefined ? v.x - pos[0] : 0) + (v.offsetX ?? 0)) * k;
    const dy = ((v.y !== undefined ? v.y - pos[1] : 0) + (v.offsetY ?? 0)) * k;
    if (v.rotation !== undefined) v.rotation *= k;
    if (v.scale !== undefined) v.scale = 1 + (v.scale - 1) * k;
    const f = (n: number) => Math.round(n * 1000) / 1000;
    const g = (n: number) => Math.round(n * 1e6) / 1e6;
    const move = dx || dy ? ` translate(calc(var(--ccs-w, ${W}px) * ${g(dx)}), calc(var(--ccs-h, ${H}px) * ${g(dy)}))` : '';
    return `transform:${base}${move} rotate(${f(v.rotation ?? 0)}deg) scale(${f(v.scale ?? 1)});${opacity !== null ? `opacity:${f(Math.max(0, Math.min(1, opacity)))};` : ''}`;
  };
  const keyframes = (name: string, from: number, to: number) => {
    const span = Math.max(1, to - from);
    const steps = Math.min(60, Math.max(8, Math.round(span / 25)));
    const out: string[] = [];
    for (let i = 0; i <= steps; i++) out.push(`${r((i / steps) * 100)}% { ${frame(from + (span * i) / steps)} }`);
    inject(name, `@keyframes ${name} { ${out.join(' ')} }`);
  };
  const id = hash(`${el.name}|${src(anims)}|${base}|${o.token ?? ''}|${o.dir ?? 0}|${o.boost ?? 1}`);
  const forever = tracks.filter((k) => k.repeat === 0 && cycle(k) > 0);
  if (!forever.length) {
    const end = Math.max(50, ...tracks.map((k) => k.begin + cycle(k) * k.repeat));
    keyframes(`ccs-a-${id}`, 0, end);
    return `ccs-a-${id} ${Math.round(end)}ms linear 1 normal both`;
  }
  // An entrance (until the first endless track starts), then the endless part over one period.
  const start = Math.min(...forever.map((k) => k.begin));
  const period = Math.max(...forever.map(cycle));
  keyframes(`ccs-l-${id}`, start, start + period);
  if (start <= 0) return `ccs-l-${id} ${Math.round(period)}ms linear infinite normal both`;
  keyframes(`ccs-a-${id}`, 0, start);
  return `ccs-a-${id} ${Math.round(start)}ms linear 1 normal both, ccs-l-${id} ${Math.round(period)}ms linear ${Math.round(start)}ms infinite normal none`;
}

function src(anims: XElement[]) {
  return anims.map((a) => a.attrs.map((x) => `${x.name}=${x.value}`).join(',')).join(';');
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
