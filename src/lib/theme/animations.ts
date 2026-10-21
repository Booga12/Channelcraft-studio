// Animation presets written as RetroBat storyboards, and a CSS approximation of storyboards for
// the preview. Storyboard syntax follows what installed themes use, and what RetroBat's
// ThemeStoryboard.cpp reads:
//   <storyboard event="activate"><animation property="opacity" from="0" to="1" duration="600" mode="easeOut"/></storyboard>
// `duration`, `begin` and `repeat` are read as plain numbers there (no ${variables}), so speed is
// written on every animation rather than through a shared variable.

import { attr, elements, type XElement } from '../xml/cst';
import type { ResolvedElement } from './resolver';
import { parsePair } from './schema';

export interface AnimPreset {
  id: string;
  label: string;
  help: string;
  /** Plays when the screen appears (activate) or loops forever (''). */
  kind: 'entrance' | 'loop';
  /** The motion can be made bigger or smaller (the first animation's travel, tilt or growth). */
  amount: boolean;
  /**
   * The storyboard at the element's position. `amount` scales how far the first animation goes
   * (1 = the preset's own), `speed` divides every duration (2 = twice as fast).
   */
  build: (pos: [number, number], amount?: number, speed?: number) => { event: string; animations: Record<string, string>[] };
}

const r = (n: number) => String(Math.round(n * 10000) / 10000);
const ms = (n: number, speed: number) => String(Math.max(50, Math.round(n / speed)));

export const ANIMATIONS: AnimPreset[] = [
  {
    id: 'fade-in',
    label: 'Fade in',
    help: 'Gently appears when the screen opens.',
    kind: 'entrance',
    amount: false,
    build: (_p, _a = 1, sp = 1) => ({ event: 'activate', animations: [{ property: 'opacity', from: '0', to: '1', duration: ms(600, sp), mode: 'easeOut' }] }),
  },
  {
    id: 'slide-left',
    label: 'Slide in from the left',
    help: 'Slides in from the left while fading in.',
    kind: 'entrance',
    amount: true,
    build: ([x], a = 1, sp = 1) => ({
      event: 'activate',
      animations: [
        { property: 'x', from: r(x - 0.08 * a), to: r(x), duration: ms(600, sp), mode: 'easeOut' },
        { property: 'opacity', from: '0', to: '1', duration: ms(600, sp), mode: 'easeOut' },
      ],
    }),
  },
  {
    id: 'slide-right',
    label: 'Slide in from the right',
    help: 'Slides in from the right while fading in.',
    kind: 'entrance',
    amount: true,
    build: ([x], a = 1, sp = 1) => ({
      event: 'activate',
      animations: [
        { property: 'x', from: r(x + 0.08 * a), to: r(x), duration: ms(600, sp), mode: 'easeOut' },
        { property: 'opacity', from: '0', to: '1', duration: ms(600, sp), mode: 'easeOut' },
      ],
    }),
  },
  {
    id: 'rise',
    label: 'Rise up',
    help: 'Moves up into place while fading in.',
    kind: 'entrance',
    amount: true,
    build: ([, y], a = 1, sp = 1) => ({
      event: 'activate',
      animations: [
        { property: 'y', from: r(y + 0.05 * a), to: r(y), duration: ms(700, sp), mode: 'easeOut' },
        { property: 'opacity', from: '0', to: '1', duration: ms(700, sp), mode: 'easeOut' },
      ],
    }),
  },
  {
    id: 'pop',
    label: 'Pop in',
    help: 'Grows from small to full size.',
    kind: 'entrance',
    amount: true,
    build: (_p, a = 1, sp = 1) => ({
      event: 'activate',
      animations: [
        { property: 'scale', from: r(Math.max(0.05, 1 - 0.4 * a)), to: '1', duration: ms(450, sp), mode: 'easeOut' },
        { property: 'opacity', from: '0', to: '1', duration: ms(300, sp), mode: 'easeOut' },
      ],
    }),
  },
  {
    id: 'float',
    label: 'Float',
    help: 'Bobs gently up and down, all the time.',
    kind: 'loop',
    amount: true,
    build: ([, y], a = 1, sp = 1) => ({ event: '', animations: [{ property: 'y', from: r(y), to: r(y - 0.008 * a), duration: ms(3000, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' }] }),
  },
  {
    id: 'pulse',
    label: 'Pulse',
    help: 'Grows and shrinks slightly, like a heartbeat.',
    kind: 'loop',
    amount: true,
    build: (_p, a = 1, sp = 1) => ({ event: '', animations: [{ property: 'scale', from: '1', to: r(1 + 0.05 * a), duration: ms(1200, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' }] }),
  },
  {
    id: 'breathe',
    label: 'Glow breathe',
    help: 'Fades a little in and out, like a soft glow.',
    kind: 'loop',
    amount: true,
    build: (_p, a = 1, sp = 1) => ({ event: '', animations: [{ property: 'opacity', from: r(Math.max(0, 1 - 0.45 * a)), to: '1', duration: ms(1800, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' }] }),
  },
  {
    id: 'swing',
    label: 'Swing',
    help: 'Tilts gently from side to side.',
    kind: 'loop',
    amount: true,
    build: (_p, a = 1, sp = 1) => ({ event: '', animations: [{ property: 'rotation', from: r(-3 * a), to: r(3 * a), duration: ms(2400, sp), mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' }] }),
  },
  {
    id: 'spin',
    label: 'Spin',
    help: 'Turns round and round slowly. Good for discs and logos.',
    kind: 'loop',
    amount: false,
    build: (_p, _a = 1, sp = 1) => ({ event: '', animations: [{ property: 'rotation', from: '0', to: '360', duration: ms(6000, sp), mode: 'linear', repeat: 'forever' }] }),
  },
];

/** Element types that never get looping motion: moving video stutters and pulls the eye. */
export const STILL_TYPES = new Set(['video']);

/** Storyboard markup for a preset, two-space indented. */
export function storyboardXml(preset: AnimPreset, pos: [number, number], amount = 1, speed = 1): string {
  const { event, animations } = preset.build(pos, amount, speed);
  const lines = [`<storyboard${event ? ` event="${event}"` : ''}>`];
  for (const a of animations) lines.push(`  <animation ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')} />`);
  lines.push('</storyboard>');
  return lines.join('\n');
}

export interface AnimTuning {
  preset: AnimPreset;
  /** 1 = the preset's own size. */
  amount: number;
  /** 1 = the preset's own speed; 2 = twice as fast. */
  speed: number;
  /** Duration of the first animation, in milliseconds. */
  duration: number;
  storyboard: XElement;
  animations: XElement[];
}

const num = (s: string | undefined) => (s === undefined ? NaN : parseFloat(s));
const near = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const loops = (v: string | undefined) => v === 'forever' || v === 'infinite';

/**
 * Which preset an element's first storyboard matches, and how big and fast it is. Hand-written
 * storyboards of the same shape count too (for example a theme's own gentle bob).
 */
export function tuningOf(el: ResolvedElement): AnimTuning | null {
  const sb = el.complex.find((c) => c.name === 'storyboard');
  if (!sb) return null;
  const anims = elements(sb.node).filter((n) => n.name === 'animation');
  if (!anims.length) return null;
  const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
  for (const p of ANIMATIONS) {
    const want = p.build(pos).animations;
    if (want.length !== anims.length) continue;
    if (!want.every((w, i) => attr(anims[i], 'property') === w.property && loops(attr(anims[i], 'repeat')) === loops(w.repeat))) continue;
    const d0 = num(want[0].to) - num(want[0].from);
    const d = num(attr(anims[0], 'to')) - num(attr(anims[0], 'from'));
    if (!Number.isFinite(d)) continue;
    const amount = d0 === 0 ? 1 : d / d0;
    if (!(amount > 0) || (!p.amount && !near(amount, 1))) continue;
    // The other animations (the fade that goes with a slide) must be the preset's own.
    if (!want.slice(1).every((w, i) => near(num(attr(anims[i + 1], 'to')), num(w.to)) && near(num(attr(anims[i + 1], 'from')), num(w.from)))) continue;
    const duration = num(attr(anims[0], 'duration'));
    const speed = Number.isFinite(duration) && duration > 0 ? num(want[0].duration) / duration : 1;
    return { preset: p, amount: Math.round(amount * 100) / 100, speed, duration: Number.isFinite(duration) ? duration : num(want[0].duration), storyboard: sb.node, animations: anims };
  }
  return null;
}

/** Which preset an element's storyboard came from, for the UI. */
export function presetOf(el: ResolvedElement): string | null {
  if (!el.complex.some((c) => c.name === 'storyboard')) return null;
  return tuningOf(el)?.preset.id ?? 'custom';
}

/** Attribute values that give an existing storyboard a new amount and speed (other attributes stay). */
export function retune(t: AnimTuning, pos: [number, number], amount: number, speed: number): { node: XElement; name: string; value: string }[] {
  const want = t.preset.build(pos, t.preset.amount ? amount : 1, speed).animations;
  const out: { node: XElement; name: string; value: string }[] = [];
  want.forEach((w, i) => {
    const node = t.animations[i];
    for (const k of ['from', 'to', 'duration'] as const) if (attr(node, k) !== w[k]) out.push({ node, name: k, value: w[k] });
  });
  return out;
}

// ---- preview -------------------------------------------------------------------------------

const injected = new Set<string>();

function inject(name: string, css: string) {
  if (injected.has(name) || typeof document === 'undefined') return;
  injected.add(name);
  const s = document.createElement('style');
  s.dataset.ccsAnim = name;
  s.textContent = css;
  document.head.appendChild(s);
}

/** RetroBat lower-cases the mode (ThemeStoryboard.cpp); `bump` is close enough to ease-in-out. */
const EASE: Record<string, string> = {
  linear: 'linear',
  easein: 'ease-in',
  easeincubic: 'cubic-bezier(0.32, 0, 0.67, 0)',
  easeinquint: 'cubic-bezier(0.64, 0, 0.78, 0)',
  easeout: 'ease-out',
  easeoutcubic: 'cubic-bezier(0.33, 1, 0.68, 1)',
  easeoutquint: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeinout: 'ease-in-out',
  bump: 'ease-in-out',
};

/**
 * A CSS `animation` value approximating the element's first storyboard. `base` is the element's
 * normal transform, which the keyframes keep while adding scale, rotation and movement.
 */
export function animationCss(el: ResolvedElement, W: number, H: number, base: string): string | null {
  const sb = el.complex.find((c) => c.name === 'storyboard');
  if (!sb) return null;
  const anims = elements(sb.node).filter((n): n is XElement => n.name === 'animation');
  if (!anims.length) return null;
  const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
  const frame = (which: 'from' | 'to') => {
    let opacity: string | null = null;
    let scale = 1;
    let rot = 0;
    let dx = 0;
    let dy = 0;
    for (const a of anims) {
      const prop = attr(a, 'property');
      const raw = attr(a, which);
      if (raw === undefined) continue;
      const v = parseFloat(raw);
      if (!Number.isFinite(v)) continue;
      if (prop === 'opacity') opacity = String(v > 1 ? v / 255 : v);
      else if (prop === 'scale') scale = v;
      else if (prop === 'rotation') rot = v;
      else if (prop === 'x') dx = (v - pos[0]) * W;
      else if (prop === 'y') dy = (v - pos[1]) * H;
      else if (prop === 'offsetY') dy = v * H;
      else if (prop === 'offsetX') dx = v * W;
    }
    return `transform:${base} translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${scale});${opacity !== null ? `opacity:${opacity};` : ''}`;
  };
  const first = anims[0];
  const duration = Math.max(...anims.map((a) => Number(attr(a, 'duration') ?? 500) || 500));
  const reverse = anims.some((a) => ['true', '1'].includes(attr(a, 'autoReverse') ?? attr(a, 'autoreverse') ?? ''));
  const forever = anims.some((a) => loops(attr(a, 'repeat'))) || loops(attr(sb.node, 'repeat'));
  const ease = EASE[(attr(first, 'mode') ?? attr(first, 'easingMode') ?? 'linear').toLowerCase()] ?? 'ease';
  const name = `ccs-a-${hash(`${el.name}|${sb.raw}|${base}|${W}x${H}|${src(anims)}`)}`;
  inject(name, `@keyframes ${name} { from { ${frame('from')} } to { ${frame('to')} } }`);
  return `${name} ${duration}ms ${ease} ${forever ? 'infinite' : '1'} ${reverse ? 'alternate' : 'normal'} both`;
}

function src(anims: XElement[]) {
  return anims.map((a) => a.attrs.map((x) => `${x.name}=${x.value}`).join(',')).join(';');
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
