// Animation presets written as RetroBat storyboards, and a CSS approximation of storyboards for
// the preview. Storyboard syntax follows what installed themes use:
//   <storyboard event="activate"><animation property="opacity" from="0" to="1" duration="600" mode="easeOut"/></storyboard>

import { attr, elements, type XElement } from '../xml/cst';
import type { ResolvedElement } from './resolver';
import { parsePair } from './schema';

export interface AnimPreset {
  id: string;
  label: string;
  help: string;
  /** Plays when the screen appears (activate) or loops forever (''). */
  kind: 'entrance' | 'loop';
  build: (pos: [number, number]) => { event: string; animations: Record<string, string>[] };
}

const r = (n: number) => String(Math.round(n * 10000) / 10000);

export const ANIMATIONS: AnimPreset[] = [
  {
    id: 'fade-in',
    label: 'Fade in',
    help: 'Gently appears when the screen opens.',
    kind: 'entrance',
    build: () => ({ event: 'activate', animations: [{ property: 'opacity', from: '0', to: '1', duration: '600', mode: 'easeOut' }] }),
  },
  {
    id: 'slide-left',
    label: 'Slide in from the left',
    help: 'Slides in from the left while fading in.',
    kind: 'entrance',
    build: ([x]) => ({
      event: 'activate',
      animations: [
        { property: 'x', from: r(x - 0.08), to: r(x), duration: '600', mode: 'easeOut' },
        { property: 'opacity', from: '0', to: '1', duration: '600', mode: 'easeOut' },
      ],
    }),
  },
  {
    id: 'slide-right',
    label: 'Slide in from the right',
    help: 'Slides in from the right while fading in.',
    kind: 'entrance',
    build: ([x]) => ({
      event: 'activate',
      animations: [
        { property: 'x', from: r(x + 0.08), to: r(x), duration: '600', mode: 'easeOut' },
        { property: 'opacity', from: '0', to: '1', duration: '600', mode: 'easeOut' },
      ],
    }),
  },
  {
    id: 'rise',
    label: 'Rise up',
    help: 'Moves up into place while fading in.',
    kind: 'entrance',
    build: ([, y]) => ({
      event: 'activate',
      animations: [
        { property: 'y', from: r(y + 0.05), to: r(y), duration: '700', mode: 'easeOut' },
        { property: 'opacity', from: '0', to: '1', duration: '700', mode: 'easeOut' },
      ],
    }),
  },
  {
    id: 'pop',
    label: 'Pop in',
    help: 'Grows from small to full size.',
    kind: 'entrance',
    build: () => ({
      event: 'activate',
      animations: [
        { property: 'scale', from: '0.6', to: '1', duration: '450', mode: 'easeOut' },
        { property: 'opacity', from: '0', to: '1', duration: '300', mode: 'easeOut' },
      ],
    }),
  },
  {
    id: 'float',
    label: 'Float',
    help: 'Bobs gently up and down, all the time.',
    kind: 'loop',
    build: ([, y]) => ({ event: '', animations: [{ property: 'y', from: r(y), to: r(y - 0.008), duration: '3000', mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' }] }),
  },
  {
    id: 'pulse',
    label: 'Pulse',
    help: 'Grows and shrinks slightly, like a heartbeat.',
    kind: 'loop',
    build: () => ({ event: '', animations: [{ property: 'scale', from: '1', to: '1.05', duration: '1200', mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' }] }),
  },
  {
    id: 'breathe',
    label: 'Glow breathe',
    help: 'Fades a little in and out, like a soft glow.',
    kind: 'loop',
    build: () => ({ event: '', animations: [{ property: 'opacity', from: '0.55', to: '1', duration: '1800', mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' }] }),
  },
  {
    id: 'swing',
    label: 'Swing',
    help: 'Tilts gently from side to side.',
    kind: 'loop',
    build: () => ({ event: '', animations: [{ property: 'rotation', from: '-3', to: '3', duration: '2400', mode: 'easeInOut', autoReverse: 'true', repeat: 'forever' }] }),
  },
  {
    id: 'spin',
    label: 'Spin',
    help: 'Turns round and round slowly. Good for discs and logos.',
    kind: 'loop',
    build: () => ({ event: '', animations: [{ property: 'rotation', from: '0', to: '360', duration: '6000', mode: 'linear', repeat: 'forever' }] }),
  },
];

/** Storyboard markup for a preset, two-space indented. */
export function storyboardXml(preset: AnimPreset, pos: [number, number]): string {
  const { event, animations } = preset.build(pos);
  const lines = [`<storyboard${event ? ` event="${event}"` : ''}>`];
  for (const a of animations) lines.push(`  <animation ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')} />`);
  lines.push('</storyboard>');
  return lines.join('\n');
}

/** Which preset an element's storyboard came from (by comparing shapes), for the UI. */
export function presetOf(el: ResolvedElement): string | null {
  const sb = el.complex.find((c) => c.name === 'storyboard');
  if (!sb) return null;
  const anims = elements(sb.node).filter((n) => n.name === 'animation');
  const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
  for (const p of ANIMATIONS) {
    const want = p.build(pos).animations;
    if (want.length === anims.length && want.every((w, i) => attr(anims[i], 'property') === w.property && attr(anims[i], 'to') === w.to)) return p.id;
  }
  return 'custom';
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

const EASE: Record<string, string> = {
  linear: 'linear',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
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
  const reverse = anims.some((a) => attr(a, 'autoReverse') === 'true');
  const forever = anims.some((a) => attr(a, 'repeat') === 'forever') || attr(sb.node, 'repeat') === 'forever';
  const ease = EASE[attr(first, 'mode') ?? 'linear'] ?? 'ease';
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
