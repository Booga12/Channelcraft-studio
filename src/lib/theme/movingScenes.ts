// The scenes for moving backgrounds, in groups. Each scene draws one frame at `t` (0 to 1 over
// the loop) in the design's colours. Everything moves in whole cycles, so `t = 1` draws exactly
// what `t = 0` does and the video loops without a jump. Nothing here is random from frame to
// frame: `r` is a seeded source that gives the same numbers every frame.

import type { Palette6 } from './designs';

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Draw = (c: Ctx, p: Palette6, t: number, r: () => number) => void;

export const W = 1280;
export const H = 720;
const TAU = Math.PI * 2;

export type SceneGroup = 'shapes' | 'nature' | 'retro' | 'abstract' | 'space' | 'tech' | 'party' | 'spooky' | 'sea' | 'speed';

export const SCENE_GROUPS: { id: SceneGroup; label: string }[] = [
  { id: 'shapes', label: 'Hearts & shapes' },
  { id: 'nature', label: 'Cosy & nature' },
  { id: 'retro', label: 'Retro & arcade' },
  { id: 'abstract', label: 'Abstract & calm' },
  { id: 'space', label: 'Space' },
  { id: 'tech', label: 'Tech' },
  { id: 'party', label: 'Party' },
  { id: 'spooky', label: 'Spooky' },
  { id: 'sea', label: 'Under the sea' },
  { id: 'speed', label: 'Speed & action' },
];

export interface Scene {
  id: string;
  label: string;
  help: string;
  group: SceneGroup;
  draw: Draw;
}

// ---- colour and motion helpers ------------------------------------------------------------

function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) || 0;
  return [n(0), n(2), n(4)];
}

export function rgba(hex: string, a = 1): string {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`;
}

/** A colour part way from `a` to `b` (as hex, for rgba). */
export function mix(a: string, b: string, f: number): string {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return x.map((v, i) => Math.round(v + (y[i] - v) * f).toString(16).padStart(2, '0')).join('');
}

/** A seeded random source, so the same scene comes out each time. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** A number from 0 to 1 for a pair of whole numbers, the same each time. */
function hash(a: number, b = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const sin = (k: number, t: number, ph = 0) => Math.sin(TAU * (k * t + ph));
const cos = (k: number, t: number, ph = 0) => Math.cos(TAU * (k * t + ph));
/** 0 to 1 and back, k times a loop. */
const ping = (k: number, t: number, ph = 0) => 0.5 + 0.5 * sin(k, t, ph);
/** How far through its trip something is (0 to 1), going round k times a loop from `start`. */
const lap = (start: number, k: number, t: number) => (((start + k * t) % 1) + 1) % 1;
/** An angle turning k times a loop (kept between 0 and a full turn). */
const turn = (k: number, t: number, ph = 0) => lap(ph, k, t) * TAU;
/** Which of n steps the loop is on (for flicker), the last step joining the first. */
const step = (t: number, n: number) => Math.round(t * n) % n;
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

function backdrop(c: Ctx, p: Palette6) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgba(p.bg2));
  g.addColorStop(1, rgba(p.bg));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}

/** Darkens the backdrop (night scenes keep the theme's colours, just deeper). */
function dim(c: Ctx, a: number) {
  c.fillStyle = rgba('05040a', a);
  c.fillRect(0, 0, W, H);
}

function glow(c: Ctx, x: number, y: number, rad: number, col: string, a: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}

function dot(c: Ctx, x: number, y: number, rad: number) {
  c.beginPath();
  c.arc(x, y, Math.max(0.1, rad), 0, TAU);
  c.fill();
}

function heart(c: Ctx, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.45);
  c.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  c.closePath();
}

/** A star (or any spiky shape) as a path, turned by `rot`. */
function star(c: Ctx, x: number, y: number, rad: number, points: number, inner: number, rot = 0) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points - Math.PI / 2;
    const d = i % 2 ? rad * inner : rad;
    if (i) c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    else c.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  c.closePath();
}

function poly(c: Ctx, x: number, y: number, rad: number, n: number, rot = 0) {
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n - Math.PI / 2;
    if (i) c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    else c.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  c.closePath();
}

function line(c: Ctx, x1: number, y1: number, x2: number, y2: number) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

/** A fluffy cloud of overlapping circles. */
function cloud(c: Ctx, x: number, y: number, s: number) {
  c.beginPath();
  for (const [dx, dy, rr] of [
    [-1, 0.15, 0.55],
    [-0.45, -0.2, 0.7],
    [0.2, -0.35, 0.8],
    [0.85, -0.05, 0.6],
    [1.3, 0.2, 0.45],
  ]) {
    c.moveTo(x + dx * s + rr * s, y + dy * s);
    c.arc(x + dx * s, y + dy * s, rr * s, 0, TAU);
  }
  c.fill();
}

/** Rain: slanted streaks falling quickly. */
function rain(c: Ctx, p: Palette6, t: number, r: () => number, n: number) {
  c.lineWidth = 1.5;
  for (let i = 0; i < n; i++) {
    const x0 = r() * (W + 200) - 100;
    const s0 = r();
    const k = int(r, 3, 5);
    const len = 20 + r() * 26;
    const y = -60 + lap(s0, k, t) * (H + 120);
    const x = x0 + y * 0.12;
    c.strokeStyle = rgba(i % 3 ? p.dim : p.text, 0.25 + r() * 0.25);
    line(c, x, y, x - len * 0.12, y - len);
  }
}

// ---- the scenes -----------------------------------------------------------------------------

const S = (id: string, group: SceneGroup, label: string, help: string, draw: Draw): Scene => ({ id, group, label, help, draw });

export const SCENES: Scene[] = [
  // Hearts & shapes
  S('hearts', 'shapes', 'Floating hearts', 'Hearts of all sizes drifting up and swaying', (c, p, t, r) => {
    const cols = [p.accent, mix(p.accent, p.text, 0.45), p.text];
    for (let i = 0; i < 34; i++) {
      const x0 = r() * W;
      const s0 = r();
      const k = int(r, 1, 2);
      const ph = r();
      const size = 10 + r() * 34;
      const y = H + 60 - lap(s0, k, t) * (H + 120);
      const x = x0 + sin(1, t, ph) * 30;
      const a = 0.25 * sin(2, t, ph);
      c.fillStyle = rgba(cols[i % 3], 0.2 + 0.5 * (size / 44));
      c.save();
      c.translate(x, y);
      c.rotate(a);
      heart(c, 0, 0, size);
      c.fill();
      c.restore();
    }
  }),
  S('bubbles', 'shapes', 'Bubbles', 'Shiny soap bubbles floating up', (c, p, t, r) => {
    c.lineWidth = 1.5;
    for (let i = 0; i < 40; i++) {
      const x0 = r() * W;
      const s0 = r();
      const k = int(r, 1, 2);
      const ph = r();
      const rad = 6 + r() * 30;
      const y = H + 40 - lap(s0, k, t) * (H + 80);
      const x = x0 + sin(2, t, ph) * 12;
      c.fillStyle = rgba(p.accent, 0.08);
      c.strokeStyle = rgba(p.text, 0.35);
      c.beginPath();
      c.arc(x, y, rad, 0, TAU);
      c.fill();
      c.stroke();
      c.fillStyle = rgba(p.text, 0.4);
      dot(c, x - rad * 0.35, y - rad * 0.35, rad * 0.22);
    }
  }),
  S('confetti', 'shapes', 'Confetti', 'Paper confetti tumbling down', (c, p, t, r) => {
    const cols = [p.accent, p.text, p.dim, mix(p.accent, p.text, 0.5)];
    for (let i = 0; i < 90; i++) {
      const x0 = r() * W;
      const s0 = r();
      const k = int(r, 1, 2);
      const ph = r();
      const w = 6 + r() * 9;
      const kr = int(r, 1, 3) * (r() < 0.5 ? -1 : 1);
      const y = -30 + lap(s0, k, t) * (H + 60);
      const x = x0 + sin(1, t, ph) * 40;
      c.fillStyle = rgba(cols[i % 4], 0.85);
      c.save();
      c.translate(x, y);
      c.rotate(turn(kr, t, ph));
      c.scale(1, cos(int(r, 1, 3), t, ph));
      c.fillRect(-w / 2, -w * 0.3, w, w * 0.6);
      c.restore();
    }
  }),
  S('balloons', 'shapes', 'Balloons', 'Party balloons rising on their strings', (c, p, t, r) => {
    const cols = [p.accent, mix(p.accent, p.text, 0.4), p.dim, mix(p.accent, p.bg2, 0.3)];
    c.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const x0 = r() * W;
      const s0 = r();
      const ph = r();
      const s = 26 + r() * 26;
      const y = H + s * 3 - lap(s0, 1, t) * (H + s * 6);
      const x = x0 + sin(1, t, ph) * 25;
      c.strokeStyle = rgba(p.text, 0.35);
      c.beginPath();
      c.moveTo(x, y + s * 1.2);
      c.quadraticCurveTo(x + sin(2, t, ph) * 14, y + s * 2, x, y + s * 2.8);
      c.stroke();
      c.fillStyle = rgba(cols[i % 4], 0.8);
      c.beginPath();
      c.ellipse(x, y, s * 0.85, s * 1.1, 0, 0, TAU);
      c.fill();
      c.fillStyle = rgba(p.text, 0.3);
      c.beginPath();
      c.ellipse(x - s * 0.3, y - s * 0.4, s * 0.15, s * 0.3, -0.5, 0, TAU);
      c.fill();
    }
  }),
  S('sparkles', 'shapes', 'Sparkles', 'Little stars that sparkle on and off', (c, p, t, r) => {
    for (let i = 0; i < 60; i++) {
      const x = r() * W;
      const y = r() * H;
      const k = int(r, 1, 3);
      const ph = r();
      const s = 6 + r() * 18;
      const on = Math.pow(ping(k, t, ph), 3);
      glow(c, x, y, s * 2.5, p.accent, 0.25 * on);
      c.fillStyle = rgba(i % 3 ? p.text : p.accent, 0.2 + 0.8 * on);
      star(c, x, y, s * (0.3 + 0.7 * on), 4, 0.22);
      c.fill();
    }
  }),
  S('drift', 'shapes', 'Drifting shapes', 'Outlined triangles, squares and circles floating by', (c, p, t, r) => {
    c.lineWidth = 3;
    for (let i = 0; i < 26; i++) {
      const sx = r();
      const y0 = r() * H;
      const k = int(r, 1, 2);
      const ph = r();
      const s = 14 + r() * 30;
      const x = -80 + lap(sx, k, t) * (W + 160);
      const y = y0 + sin(1, t, ph) * 40;
      c.strokeStyle = rgba(i % 2 ? p.accent : p.text, 0.45);
      const rot = turn(r() < 0.5 ? 1 : -1, t, ph);
      const kind = i % 3;
      if (kind === 2) {
        c.beginPath();
        c.arc(x, y, s, 0, TAU);
      } else poly(c, x, y, s, kind === 0 ? 3 : 4, rot);
      c.stroke();
    }
  }),
  S('dots', 'shapes', 'Polka dots', 'A sliding field of dots that grow and shrink in a wave', (c, p, t) => {
    const g = 64;
    const off = lap(0, 1, t) * g;
    for (let i = -1; i < W / g + 2; i++) {
      for (let j = -1; j < H / g + 2; j++) {
        const rad = 4 + 9 * ping(1, t, (i + j) / 12);
        c.fillStyle = rgba((i + j) % 2 ? p.accent : p.text, 0.25);
        dot(c, i * g + off + (j % 2) * (g / 2), j * g + off, rad);
      }
    }
  }),
  S('rings', 'shapes', 'Rings', 'Soft rings spreading out from a few spots', (c, p, t, r) => {
    c.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const x = r() * W;
      const y = r() * H;
      const ph = r();
      for (let j = 0; j < 5; j++) {
        const f = lap(ph + j / 5, 1, t);
        c.strokeStyle = rgba(i % 2 ? p.accent : p.text, (1 - f) * 0.4);
        c.beginPath();
        c.arc(x, y, 10 + f * 420, 0, TAU);
        c.stroke();
      }
    }
  }),
  S('fallingstars', 'shapes', 'Falling stars', 'Five-pointed stars spinning gently down', (c, p, t, r) => {
    for (let i = 0; i < 30; i++) {
      const x0 = r() * W;
      const s0 = r();
      const ph = r();
      const s = 8 + r() * 22;
      const y = -40 + lap(s0, 1, t) * (H + 80);
      const x = x0 + sin(1, t, ph) * 30;
      c.fillStyle = rgba(i % 3 ? p.accent : p.text, 0.65);
      star(c, x, y, s, 5, 0.45, turn(r() < 0.5 ? 1 : -1, t, ph));
      c.fill();
    }
  }),
  S('ribbons', 'shapes', 'Ribbons', 'Wide ribbons of colour waving across the screen', (c, p, t, r) => {
    c.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const base = H * (0.15 + i * 0.18);
      const amp = 40 + r() * 60;
      const f = 0.8 + r() * 1.2;
      const ph = r();
      c.lineWidth = 22 + r() * 30;
      c.strokeStyle = rgba(i % 2 ? p.accent : mix(p.accent, p.text, 0.5), 0.16);
      c.beginPath();
      for (let x = -20; x <= W + 20; x += 16) {
        const y = base + Math.sin(TAU * ((x / W) * f + t + ph)) * amp;
        if (x === -20) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
  }),

  // Cosy & nature
  S('snow', 'nature', 'Snowfall', 'Snowflakes falling softly at different depths', (c, p, t, r) => {
    for (const [n, s, k, a] of [
      [90, 1.6, 1, 0.45],
      [60, 2.6, 1, 0.65],
      [30, 4.2, 2, 0.9],
    ]) {
      c.fillStyle = rgba(p.text, a);
      for (let i = 0; i < n; i++) {
        const x0 = r() * W;
        const s0 = r();
        const ph = r();
        const y = -10 + lap(s0, k, t) * (H + 20);
        dot(c, x0 + sin(1, t, ph) * 22, y, s * (0.7 + r() * 0.6));
      }
    }
  }),
  S('rain', 'nature', 'Rain', 'A steady shower of rain', (c, p, t, r) => {
    dim(c, 0.25);
    rain(c, p, t, r, 170);
  }),
  S('clouds', 'nature', 'Drifting clouds', 'Fluffy clouds floating to and fro', (c, p, t, r) => {
    for (let l = 0; l < 3; l++) {
      c.fillStyle = rgba(mix(p.text, p.bg2, 0.3 - l * 0.1), 0.12 + l * 0.08);
      for (let i = 0; i < 5; i++) {
        const x0 = r() * W;
        const y = H * (0.12 + r() * 0.6);
        const ph = r();
        const s = 50 + l * 25 + r() * 40;
        cloud(c, x0 + sin(1, t, ph) * (50 + l * 40), y + sin(2, t, ph) * 6, s);
      }
    }
  }),
  S('fireflies', 'nature', 'Fireflies', 'Glowing fireflies wandering and blinking', (c, p, t, r) => {
    dim(c, 0.3);
    const col = mix(p.accent, 'f4ff9a', 0.6);
    for (let i = 0; i < 40; i++) {
      const x0 = r() * W;
      const y0 = r() * H;
      const ph = r();
      const ph2 = r();
      const x = x0 + sin(1, t, ph) * 60 + sin(2, t, ph2) * 20;
      const y = y0 + cos(1, t, ph2) * 40 + cos(3, t, ph) * 10;
      const on = Math.pow(ping(int(r, 1, 3), t, ph), 4);
      glow(c, x, y, 26, col, 0.15 + 0.5 * on);
      c.fillStyle = rgba(col, 0.4 + 0.6 * on);
      dot(c, x, y, 2.5);
    }
  }),
  S('leaves', 'nature', 'Autumn leaves', 'Leaves twirling down on the breeze', (c, p, t, r) => {
    const cols = [p.accent, mix(p.accent, 'e0a030', 0.5), mix(p.accent, 'b04020', 0.5), mix(p.dim, 'c08040', 0.4)];
    for (let i = 0; i < 26; i++) {
      const x0 = r() * W;
      const s0 = r();
      const ph = r();
      const s = 12 + r() * 16;
      const y = -40 + lap(s0, 1, t) * (H + 80);
      const x = x0 + sin(1, t, ph) * 80;
      c.save();
      c.translate(x, y);
      c.rotate(0.9 * sin(2, t, ph) + ph * TAU);
      c.scale(cos(1, t, ph), 1);
      c.fillStyle = rgba(cols[i % 4], 0.85);
      c.beginPath();
      c.moveTo(0, -s);
      c.quadraticCurveTo(s * 0.8, 0, 0, s);
      c.quadraticCurveTo(-s * 0.8, 0, 0, -s);
      c.fill();
      c.strokeStyle = rgba(p.bg, 0.4);
      c.lineWidth = 1;
      line(c, 0, -s, 0, s);
      c.restore();
    }
  }),
  S('petals', 'nature', 'Blossom petals', 'Cherry blossom petals drifting on the wind', (c, p, t, r) => {
    const col = mix(p.accent, 'ffc0d8', 0.55);
    for (let i = 0; i < 50; i++) {
      const sx = r();
      const y0 = r();
      const ph = r();
      const s = 5 + r() * 7;
      const k = int(r, 1, 2);
      const x = -40 + lap(sx, k, t) * (W + 80);
      const y = -40 + lap(y0 + lap(sx, k, t) * 0.5, 0, t) * (H + 80);
      c.save();
      c.translate(x, y + sin(2, t, ph) * 12);
      c.rotate(turn(1, t, ph));
      c.scale(1, 0.4 + 0.6 * Math.abs(cos(1, t, ph)));
      c.fillStyle = rgba(i % 3 ? col : p.text, 0.75);
      c.beginPath();
      c.ellipse(0, 0, s, s * 0.6, 0, 0, TAU);
      c.fill();
      c.restore();
    }
  }),
  S('waves', 'nature', 'Gentle waves', 'Layers of colour rolling like the sea', (c, p, t) => {
    const layers = 5;
    for (let l = 0; l < layers; l++) {
      const f = l / (layers - 1);
      const base = H * (0.45 + f * 0.45);
      const amp = 18 + f * 26;
      c.beginPath();
      c.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        const u = x / W;
        const y = base + Math.sin(TAU * (u * (1.2 + l * 0.35) + t * (l % 2 ? 1 : -1) + l * 0.2)) * amp + Math.sin(TAU * (u * 3 - t * 2 + l)) * amp * 0.25;
        c.lineTo(x, y);
      }
      c.lineTo(W, H);
      c.closePath();
      c.fillStyle = rgba(l === layers - 1 ? p.bg : p.accent, l === layers - 1 ? 0.9 : 0.1 + f * 0.12);
      c.fill();
    }
  }),
  S('embers', 'nature', 'Campfire embers', 'Warm sparks rising from a glow below', (c, p, t, r) => {
    const warm = mix(p.accent, 'ff7a1a', 0.55);
    const g = c.createLinearGradient(0, H * 0.55, 0, H);
    g.addColorStop(0, rgba(warm, 0));
    g.addColorStop(1, rgba(warm, 0.35));
    c.fillStyle = g;
    c.fillRect(0, H * 0.55, W, H * 0.45);
    for (let i = 0; i < 70; i++) {
      const x0 = r() * W;
      const s0 = r();
      const ph = r();
      const u = lap(s0, int(r, 1, 2), t);
      const y = H + 10 - u * H * 0.95;
      const x = x0 + sin(2, t, ph) * 16 + u * 40;
      const a = (1 - u) * (0.5 + 0.5 * ping(6, t, ph));
      glow(c, x, y, 10, warm, a * 0.6);
      c.fillStyle = rgba(mix(warm, 'ffffff', 0.4), a);
      dot(c, x, y, 1.8);
    }
  }),
  S('seeds', 'nature', 'Dandelion seeds', 'Fluffy seeds floating up and away', (c, p, t, r) => {
    c.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      const sx = r();
      const y0 = r();
      const ph = r();
      const s = 8 + r() * 8;
      const u = lap(sx, 1, t);
      const x = -40 + u * (W + 80);
      const y = -40 + lap(y0 - u * 0.6, 0, t) * (H + 80) + sin(2, t, ph) * 10;
      c.strokeStyle = rgba(p.text, 0.55);
      line(c, x, y, x - s * 0.3, y + s * 1.6);
      for (let j = 0; j < 9; j++) {
        const a = -Math.PI / 2 + (j - 4) * 0.33 + sin(1, t, ph) * 0.1;
        line(c, x, y, x + Math.cos(a) * s, y + Math.sin(a) * s);
      }
    }
  }),
  S('fog', 'nature', 'Rolling fog', 'Soft fog drifting low across the screen', (c, p, t, r) => {
    for (let l = 0; l < 4; l++) {
      for (let i = 0; i < 7; i++) {
        const x0 = r() * W;
        const y = H * (0.45 + l * 0.15) + r() * 40;
        const ph = r();
        glow(c, x0 + sin(1, t, ph) * (90 + l * 30), y, 220 + r() * 120, p.text, 0.07 + l * 0.02);
      }
    }
  }),

  // Retro & arcade
  S('grid', 'retro', 'Retro grid', 'A glowing grid racing towards a sunset, synthwave style', (c, p, t) => {
    const horizon = H * 0.55;
    const sun = c.createLinearGradient(0, horizon - 260, 0, horizon);
    sun.addColorStop(0, rgba(p.accent, 0.95));
    sun.addColorStop(1, rgba(p.text, 0.55));
    c.fillStyle = sun;
    c.beginPath();
    c.arc(W / 2, horizon, 220, Math.PI, 0);
    c.fill();
    c.fillStyle = rgba(p.bg2);
    for (let i = 0; i < 6; i++) c.fillRect(W / 2 - 230, horizon - 20 - i * 26, 460, 4 + i * 1.2);
    c.fillStyle = rgba(p.bg);
    c.fillRect(0, horizon, W, H - horizon);
    c.strokeStyle = rgba(p.accent, 0.8);
    c.lineWidth = 2;
    c.shadowColor = rgba(p.accent, 0.8);
    c.shadowBlur = 10;
    // Lines across, moving towards you by exactly one gap per loop (the nearest wraps to the horizon).
    for (let i = 0; i < 14; i++) {
      const z = ((((i + 1 - t) % 14) + 14) % 14) / 14;
      line(c, 0, horizon + (H - horizon) * z * z, W, horizon + (H - horizon) * z * z);
    }
    for (let i = -12; i <= 12; i++) line(c, W / 2 + i * 18, horizon, W / 2 + i * 150, H);
    c.shadowBlur = 0;
  }),
  S('warp', 'retro', 'Pixel warp', 'Square pixels flying out towards you', (c, p, t, r) => {
    dim(c, 0.3);
    for (let i = 0; i < 220; i++) {
      const a = r() * TAU;
      const z = lap(r(), 1, t);
      const d = z * z * 900;
      const s = 1 + z * 7;
      c.fillStyle = rgba(i % 5 ? p.text : p.accent, z);
      c.fillRect(W / 2 + Math.cos(a) * d - s / 2, H / 2 + Math.sin(a) * d - s / 2, s, s);
    }
  }),
  S('vhs', 'retro', 'VHS tape', 'An old video tape: colour bands, noise and a rolling bar', (c, p, t, r) => {
    const cols = [p.accent, p.dim, p.text, p.bg2];
    for (let i = 0; i < 8; i++) {
      c.fillStyle = rgba(cols[i % 4], 0.06);
      c.fillRect(0, (i * H) / 8, W, H / 8);
    }
    c.fillStyle = rgba('000000', 0.08);
    for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1.5);
    const s = step(t, 48);
    for (let k = 0; k < 30; k++) {
      c.fillStyle = rgba(p.text, 0.05 + hash(k, s) * 0.15);
      c.fillRect(hash(k, s + 99) * W * 0.6, hash(k + 7, s) * H, 80 + hash(k, s + 3) * 500, 1 + hash(k, s + 5) * 2);
    }
    const y = -60 + lap(0, 1, t) * (H + 120);
    const g = c.createLinearGradient(0, y - 40, 0, y + 40);
    g.addColorStop(0, rgba(p.text, 0));
    g.addColorStop(0.5, rgba(p.text, 0.16));
    g.addColorStop(1, rgba(p.text, 0));
    c.fillStyle = g;
    c.fillRect(0, y - 40, W, 80);
    void r;
  }),
  S('static', 'retro', 'TV static', 'Old TV snow with a slow rolling bar', (c, p, t) => {
    const s = step(t, 120);
    const cell = 16;
    for (let i = 0; i < W / cell; i++) {
      for (let j = 0; j < H / cell; j++) {
        c.fillStyle = rgba(mix(p.bg, p.text, hash(i * 97 + j, s)), 0.35);
        c.fillRect(i * cell, j * cell, cell, cell);
      }
    }
    const y = lap(0, 1, t) * H;
    c.fillStyle = rgba(p.bg, 0.25);
    c.fillRect(0, y - 50, W, 100);
    c.fillRect(0, y - 50 + H, W, 100);
    c.fillRect(0, y - 50 - H, W, 100);
  }),
  S('checker', 'retro', 'Checkerboard', 'A tilted checkerboard scrolling forever', (c, p, t) => {
    const g = 90;
    const off = lap(0, 1, t) * g * 2;
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(-0.2);
    c.fillStyle = rgba(p.accent, 0.18);
    for (let i = -10; i < 10; i++) for (let j = -7; j < 7; j++) if ((((i + j) % 2) + 2) % 2 === 0) c.fillRect(i * g + off, j * g + off * 0.5, g, g);
    c.restore();
  }),
  S('lightlines', 'retro', 'Light trails', 'Neon light trails racing along a grid', (c, p, t, r) => {
    const g = 80;
    c.strokeStyle = rgba(p.accent, 0.08);
    c.lineWidth = 1;
    for (let x = 0; x <= W; x += g) line(c, x, 0, x, H);
    for (let y = 0; y <= H; y += g) line(c, 0, y, W, y);
    for (let i = 0; i < 14; i++) {
      const across = i % 2 === 0;
      const lane = across ? int(r, 1, 8) * g : int(r, 1, 15) * g;
      const k = int(r, 1, 2) * (r() < 0.5 ? -1 : 1);
      const span = across ? W + 400 : H + 400;
      const head = -200 + lap(r(), k, t) * span;
      const tail = head - Math.sign(k) * 180;
      const col = i % 3 ? p.accent : p.text;
      for (const [w, a] of [
        [8, 0.12],
        [2.5, 0.9],
      ]) {
        c.lineWidth = w;
        c.strokeStyle = rgba(col, a);
        if (across) line(c, tail, lane, head, lane);
        else line(c, lane, tail, lane, head);
      }
    }
  }),
  S('pixelrain', 'retro', 'Pixel rain', 'Chunky 8-bit blocks raining down', (c, p, t, r) => {
    const b = 16;
    for (let i = 0; i < 45; i++) {
      const x = int(r, 0, W / b - 1) * b;
      const head = -200 + lap(r(), int(r, 1, 2), t) * (H + 400);
      for (let j = 0; j < 10; j++) {
        c.fillStyle = rgba(j ? p.accent : p.text, (1 - j / 10) * 0.7);
        c.fillRect(x, Math.round((head - j * b) / b) * b, b - 2, b - 2);
      }
    }
  }),
  S('equalizer', 'retro', 'Equalizer', 'Music bars bouncing to a beat', (c, p, t, r) => {
    const n = 32;
    const bw = W / n;
    const base = H * 0.62;
    for (let i = 0; i < n; i++) {
      const v = 0.2 + 0.8 * Math.abs(sin(int(r, 1, 4), t, r()) * 0.6 + sin(int(r, 2, 6), t, r()) * 0.4);
      const blocks = Math.max(1, Math.round((v * H * 0.5) / 14));
      for (let j = 0; j < blocks; j++) {
        c.fillStyle = rgba(j > blocks - 3 ? p.text : p.accent, 0.7);
        c.fillRect(i * bw + 4, base - (j + 1) * 14, bw - 8, 10);
        c.fillStyle = rgba(p.accent, 0.12);
        c.fillRect(i * bw + 4, base + j * 14 + 4, bw - 8, 10);
      }
    }
  }),
  S('marquee', 'retro', 'Marquee lights', 'Light bulbs chasing round the edge like an arcade sign', (c, p, t) => {
    const pts: [number, number][] = [];
    const m = 30;
    for (let x = m; x <= W - m; x += 40) pts.push([x, m]);
    for (let y = m + 40; y <= H - m; y += 40) pts.push([W - m, y]);
    for (let x = W - m - 40; x >= m; x -= 40) pts.push([x, H - m]);
    for (let y = H - m - 40; y > m; y -= 40) pts.push([m, y]);
    glow(c, W / 2, H / 2, 600, p.accent, 0.12);
    pts.forEach(([x, y], i) => {
      const on = 0.5 + 0.5 * Math.cos(TAU * (i / 3 - t * 12));
      glow(c, x, y, 22, p.accent, 0.45 * on);
      c.fillStyle = rgba(mix(p.accent, 'ffffff', 0.5 * on), 0.35 + 0.65 * on);
      dot(c, x, y, 6);
    });
  }),
  S('tunnel', 'retro', 'Neon tunnel', 'Flying down a tunnel of neon frames', (c, p, t) => {
    for (let i = 0; i < 14; i++) {
      const z = lap(i / 14, 1, t);
      const s = 0.04 + z * z * 1.6;
      c.strokeStyle = rgba(i % 2 ? p.accent : p.text, Math.min(1, z * 3) * (1 - z) * 1.6);
      c.lineWidth = 2 + z * 6;
      c.strokeRect(W / 2 - (W * s) / 2, H / 2 - (H * s) / 2, W * s, H * s);
    }
  }),

  // Abstract & calm
  S('bokeh', 'abstract', 'Floating lights', 'Soft, blurry lights drifting slowly', (c, p, t, r) => {
    c.globalCompositeOperation = 'lighter';
    const colours = [p.accent, p.text, p.dim, p.accent];
    for (let i = 0; i < 26; i++) {
      const x0 = r() * W;
      const y0 = r() * H;
      const size = 40 + r() * 120;
      const k = 1 + Math.floor(r() * 2);
      const ph = r();
      const reach = 30 + r() * 70;
      const x = x0 + Math.cos(TAU * (k * t + ph)) * reach;
      const y = y0 + Math.sin(TAU * (k * t + ph)) * reach * 0.6;
      const a = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(TAU * (t + ph)));
      const g = c.createRadialGradient(x, y, 0, x, y, size);
      const col = colours[i % colours.length];
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(0.7, rgba(col, a * 0.6));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(x - size, y - size, size * 2, size * 2);
    }
  }),
  S('aurora', 'abstract', 'Aurora', 'Northern lights rippling across the sky', (c, p, t, r) => {
    dim(c, 0.2);
    c.globalCompositeOperation = 'lighter';
    const cols = [p.accent, mix(p.accent, p.text, 0.5), p.dim, mix(p.accent, '40ffb0', 0.4)];
    for (let i = 0; i < 4; i++) {
      const base = H * (0.25 + i * 0.1);
      const ph = r();
      const f = 0.6 + r() * 0.8;
      const g = c.createLinearGradient(0, base - 200, 0, base + 60);
      g.addColorStop(0, rgba(cols[i], 0));
      g.addColorStop(0.8, rgba(cols[i], 0.25));
      g.addColorStop(1, rgba(cols[i], 0));
      c.fillStyle = g;
      c.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const y = base + Math.sin(TAU * ((x / W) * f + t + ph)) * 50 + Math.sin(TAU * ((x / W) * 2.3 - t + ph)) * 20;
        if (x) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      for (let x = W; x >= 0; x -= 16) c.lineTo(x, base - 200 + Math.sin(TAU * ((x / W) * f + t + ph)) * 30);
      c.closePath();
      c.fill();
    }
  }),
  S('lava', 'abstract', 'Lava lamp', 'Big soft blobs floating around like a lava lamp', (c, p, t, r) => {
    const cols = [p.accent, p.dim, mix(p.accent, p.text, 0.4)];
    for (let i = 0; i < 9; i++) {
      const ph = r();
      const ph2 = r();
      const x = W / 2 + sin(1, t, ph) * W * 0.35;
      const y = H / 2 + sin(int(r, 1, 2), t, ph2) * H * 0.38;
      glow(c, x, y, 140 + r() * 120, cols[i % 3], 0.5);
    }
  }),
  S('colourdrift', 'abstract', 'Colour drift', 'Slow washes of colour moving round', (c, p, t, r) => {
    const cols = [p.accent, p.dim, p.text, p.bg2];
    for (let i = 0; i < 4; i++) {
      const ph = r();
      glow(c, W / 2 + cos(1, t, ph) * 420, H / 2 + sin(1, t, ph) * 220, 700, cols[i], 0.3);
    }
  }),
  S('sunburst', 'abstract', 'Sunburst', 'Rays turning slowly round a glowing centre', (c, p, t) => {
    const cx = W / 2;
    const cy = H * 0.55;
    const n = 12;
    const base = turn(1, t) / n;
    c.fillStyle = rgba(p.accent, 0.12);
    for (let i = 0; i < n; i++) {
      const a = base + (i * TAU) / n;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a - 0.12) * 1400, cy + Math.sin(a - 0.12) * 1400);
      c.lineTo(cx + Math.cos(a + 0.12) * 1400, cy + Math.sin(a + 0.12) * 1400);
      c.closePath();
      c.fill();
    }
    glow(c, cx, cy, 300, p.text, 0.25);
  }),
  S('plasma', 'abstract', 'Plasma', 'Swirling colours like an old demo effect', (c, p, t) => {
    const cell = 20;
    const nx = W / cell;
    const ny = H / cell;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const v = (Math.sin(i * 0.16 + TAU * t) + Math.sin(j * 0.22 - TAU * 2 * t) + Math.sin((i + j) * 0.1 + TAU * t) + Math.sin(Math.hypot(i - nx / 2, j - ny / 2) * 0.35 - TAU * t)) / 4;
        const f = (v + 1) / 2;
        c.fillStyle = rgba(f < 0.5 ? mix(p.bg2, p.accent, f * 2) : mix(p.accent, p.text, (f - 0.5) * 1.2), 0.55);
        c.fillRect(i * cell, j * cell, cell, cell);
      }
    }
  }),
  S('ripples', 'abstract', 'Ripples', 'Calm circles spreading like drops in water', (c, p, t, r) => {
    c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const x = r() * W;
      const y = r() * H;
      const ph = r();
      for (let j = 0; j < 6; j++) {
        const f = lap(ph + j / 6, 1, t);
        c.strokeStyle = rgba(p.text, (1 - f) * 0.3);
        c.beginPath();
        c.arc(x, y, f * 600, 0, TAU);
        c.stroke();
      }
    }
  }),
  S('flowlines', 'abstract', 'Flowing lines', 'Fine lines flowing like silk', (c, p, t) => {
    c.lineWidth = 1.5;
    for (let i = 0; i < 28; i++) {
      const base = (H * (i + 0.5)) / 28;
      c.strokeStyle = rgba(mix(p.accent, p.text, i / 28), 0.3);
      c.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const u = x / W;
        const y = base + Math.sin(TAU * (u * 1.5 + t + i * 0.04)) * 40 + Math.sin(TAU * (u * 0.7 - t + i * 0.02)) * 30;
        if (x) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.stroke();
    }
  }),
  S('kaleido', 'abstract', 'Kaleidoscope', 'Mirrored shapes turning like a kaleidoscope', (c, p, t, r) => {
    const shapes = Array.from({ length: 6 }, () => ({ d: 60 + r() * 300, a: r() * 0.35, s: 12 + r() * 30, ph: r(), n: int(r, 3, 6), col: r() < 0.5 ? p.accent : p.text }));
    const base = turn(1, t) / 4;
    for (let seg = 0; seg < 8; seg++) {
      const flip = seg % 2 ? -1 : 1;
      for (const sh of shapes) {
        const a = base + (seg * TAU) / 8 + flip * (sh.a + 0.1 * sin(1, t, sh.ph));
        const d = sh.d * (0.85 + 0.15 * ping(1, t, sh.ph));
        c.fillStyle = rgba(sh.col, 0.3);
        poly(c, W / 2 + Math.cos(a) * d, H / 2 + Math.sin(a) * d, sh.s, sh.n, a * flip);
        c.fill();
      }
    }
  }),
  S('breathe', 'abstract', 'Breathing circles', 'Circles slowly growing and shrinking, very calm', (c, p, t) => {
    c.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const rad = (60 + i * 55) * (1 + 0.12 * sin(1, t, -i * 0.06));
      c.strokeStyle = rgba(i % 2 ? p.accent : p.text, 0.3 - i * 0.03);
      c.beginPath();
      c.arc(W / 2, H / 2, rad, 0, TAU);
      c.stroke();
    }
    glow(c, W / 2, H / 2, 120 + 40 * ping(1, t), p.accent, 0.3);
  }),

  // Space
  S('stars', 'space', 'Twinkling stars', 'A night sky with stars that twinkle and the odd shooting star', (c, p, t, r) => {
    for (let i = 0; i < 260; i++) {
      const x = r() * W;
      const y = r() * H;
      const s = r() < 0.9 ? 1 + r() : 2 + r() * 1.5;
      const k = 1 + Math.floor(r() * 3);
      const ph = r();
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(TAU * (k * t + ph)));
      c.fillStyle = rgba(i % 7 ? p.text : p.accent, a);
      dot(c, x, y, s);
    }
    // Two shooting stars, each crossing once per loop.
    for (const [start, y0] of [
      [0.15, 0.18],
      [0.6, 0.35],
    ]) {
      const u = (t - start + 1) % 1;
      if (u > 0.12) continue;
      const q = u / 0.12;
      const x = W * (0.2 + q * 0.6);
      const y = H * (y0 + q * 0.18);
      const g = c.createLinearGradient(x, y, x - 160, y - 48);
      g.addColorStop(0, rgba(p.text, 0.9 * (1 - q)));
      g.addColorStop(1, rgba(p.text, 0));
      c.strokeStyle = g;
      c.lineWidth = 2;
      line(c, x, y, x - 160, y - 48);
    }
  }),
  S('hyperspace', 'space', 'Hyperspace', 'Stars stretching into streaks as you jump to light speed', (c, p, t, r) => {
    dim(c, 0.45);
    c.lineWidth = 2;
    for (let i = 0; i < 220; i++) {
      const a = r() * TAU;
      const z = lap(r(), 2, t);
      const d1 = 20 + z * z * z * 900;
      const d2 = 20 + Math.pow(z + 0.08, 3) * 900;
      c.strokeStyle = rgba(i % 6 ? p.text : p.accent, z);
      line(c, W / 2 + Math.cos(a) * d1, H / 2 + Math.sin(a) * d1, W / 2 + Math.cos(a) * d2, H / 2 + Math.sin(a) * d2);
    }
  }),
  S('nebula', 'space', 'Nebula', 'Glowing clouds of colour among the stars', (c, p, t, r) => {
    dim(c, 0.4);
    c.fillStyle = rgba(p.text, 0.7);
    for (let i = 0; i < 150; i++) dot(c, r() * W, r() * H, 0.6 + r());
    c.globalCompositeOperation = 'lighter';
    const cols = [p.accent, p.dim, mix(p.accent, p.text, 0.4)];
    for (let i = 0; i < 7; i++) {
      const ph = r();
      const d = 120 + r() * 260;
      glow(c, W / 2 + cos(1, t, ph) * d, H / 2 + sin(1, t, ph) * d * 0.5, 260 + r() * 160, cols[i % 3], 0.2);
    }
  }),
  S('planets', 'space', 'Orbiting planets', 'Little planets going round a glowing sun', (c, p, t, r) => {
    dim(c, 0.35);
    const cx = W / 2;
    const cy = H / 2;
    glow(c, cx, cy, 160, p.accent, 0.6);
    c.fillStyle = rgba(mix(p.accent, 'ffffff', 0.4));
    dot(c, cx, cy, 34);
    c.lineWidth = 1;
    const cols = [p.text, p.accent, p.dim, mix(p.accent, p.text, 0.5), p.text];
    for (let i = 0; i < 5; i++) {
      const rx = 120 + i * 95;
      const ry = rx * 0.36;
      c.strokeStyle = rgba(p.text, 0.12);
      c.beginPath();
      c.ellipse(cx, cy, rx, ry, 0, 0, TAU);
      c.stroke();
      const k = 5 - i > 3 ? 2 : 1;
      const ph = r();
      c.fillStyle = rgba(cols[i]);
      dot(c, cx + cos(k, t, ph) * rx, cy + sin(k, t, ph) * ry, 6 + r() * 10);
    }
  }),
  S('galaxy', 'space', 'Spiral galaxy', 'A galaxy of stars slowly turning', (c, p, t, r) => {
    dim(c, 0.4);
    const base = turn(1, t) / 3;
    const arm = Array.from({ length: 180 }, () => {
      const d = Math.pow(r(), 0.6) * 460;
      return { d, a: d * 0.011 + (r() - 0.5) * 0.5, s: 0.6 + r() * 1.6, col: r() < 0.2 ? p.accent : p.text };
    });
    glow(c, W / 2, H / 2, 160, p.accent, 0.35);
    for (let k = 0; k < 3; k++) {
      for (const s of arm) {
        const a = base + (k * TAU) / 3 + s.a;
        c.fillStyle = rgba(s.col, 0.8 - s.d / 700);
        dot(c, W / 2 + Math.cos(a) * s.d, H / 2 + Math.sin(a) * s.d * 0.55, s.s);
      }
    }
  }),
  S('asteroids', 'space', 'Drifting rocks', 'Space rocks tumbling past', (c, p, t, r) => {
    dim(c, 0.35);
    c.fillStyle = rgba(p.text, 0.6);
    for (let i = 0; i < 80; i++) dot(c, r() * W, r() * H, 0.8);
    for (let i = 0; i < 18; i++) {
      const sx = r();
      const y0 = r() * H;
      const k = int(r, 1, 2);
      const ph = r();
      const s = 14 + r() * 36;
      const verts = Array.from({ length: 8 }, () => 0.7 + r() * 0.3);
      const x = W + 80 - lap(sx, k, t) * (W + 160);
      const y = y0 + sin(1, t, ph) * 20;
      const rot = turn(r() < 0.5 ? 1 : -1, t, ph);
      c.fillStyle = rgba(mix(p.dim, p.bg, 0.3), 0.9);
      c.strokeStyle = rgba(p.text, 0.3);
      c.beginPath();
      verts.forEach((v, j) => {
        const a = rot + (j * TAU) / 8;
        if (j) c.lineTo(x + Math.cos(a) * s * v, y + Math.sin(a) * s * v);
        else c.moveTo(x + Math.cos(a) * s * v, y + Math.sin(a) * s * v);
      });
      c.closePath();
      c.fill();
      c.stroke();
    }
  }),
  S('comets', 'space', 'Comets', 'Comets with long glowing tails sweeping across', (c, p, t, r) => {
    dim(c, 0.3);
    c.fillStyle = rgba(p.text, 0.6);
    for (let i = 0; i < 100; i++) dot(c, r() * W, r() * H, 0.8);
    for (let i = 0; i < 5; i++) {
      const u = lap(r(), 1, t);
      const y0 = r() * H * 0.6;
      const x = -300 + u * (W + 600);
      const y = y0 + u * 260;
      const g = c.createLinearGradient(x, y, x - 240, y - 70);
      g.addColorStop(0, rgba(p.text, 0.9));
      g.addColorStop(1, rgba(p.accent, 0));
      c.strokeStyle = g;
      c.lineWidth = 4;
      line(c, x, y, x - 240, y - 70);
      glow(c, x, y, 18, p.text, 0.8);
    }
  }),
  S('radar', 'space', 'Radar sweep', 'A radar screen sweeping round and finding blips', (c, p, t, r) => {
    const cx = W / 2;
    const cy = H / 2;
    c.strokeStyle = rgba(p.accent, 0.25);
    c.lineWidth = 1.5;
    for (let i = 1; i <= 5; i++) {
      c.beginPath();
      c.arc(cx, cy, i * 70, 0, TAU);
      c.stroke();
    }
    line(c, cx - 360, cy, cx + 360, cy);
    line(c, cx, cy - 360, cx, cy + 360);
    const a = turn(1, t);
    for (let j = 0; j < 30; j++) {
      const b = a - j * 0.025;
      c.strokeStyle = rgba(p.accent, 0.5 * (1 - j / 30));
      line(c, cx, cy, cx + Math.cos(b) * 350, cy + Math.sin(b) * 350);
    }
    for (let i = 0; i < 12; i++) {
      const b = r() * TAU;
      const d = 40 + r() * 300;
      const since = (((a - b) % TAU) + TAU) % TAU;
      const on = 1 - since / TAU;
      glow(c, cx + Math.cos(b) * d, cy + Math.sin(b) * d, 14, p.text, on * 0.9);
    }
  }),
  S('eclipse', 'space', 'Eclipse', 'A dark moon with a glowing ring around it', (c, p, t) => {
    dim(c, 0.45);
    const cx = W / 2;
    const cy = H / 2;
    const n = 36;
    const base = turn(1, t) / n;
    c.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const a = base + (i * TAU) / n;
      const len = 220 + 40 * ping(2, t, i / 6);
      c.strokeStyle = rgba(p.accent, 0.18);
      line(c, cx + Math.cos(a) * 150, cy + Math.sin(a) * 150, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    }
    glow(c, cx, cy, 260 + 20 * ping(1, t), p.accent, 0.55);
    c.fillStyle = rgba(mix(p.bg, '000000', 0.6));
    dot(c, cx, cy, 145);
    c.strokeStyle = rgba(mix(p.accent, 'ffffff', 0.5), 0.8);
    c.beginPath();
    c.arc(cx, cy, 146, 0, TAU);
    c.stroke();
  }),
  S('starlayers', 'space', 'Star layers', 'Layers of stars sliding past at different speeds', (c, p, t, r) => {
    dim(c, 0.3);
    for (const [n, s, k, a] of [
      [120, 0.8, 1, 0.4],
      [70, 1.4, 2, 0.65],
      [30, 2.2, 3, 0.95],
    ]) {
      c.fillStyle = rgba(p.text, a);
      for (let i = 0; i < n; i++) dot(c, W + 10 - lap(r(), k, t) * (W + 20), r() * H, s);
    }
  }),

  // Tech
  S('coderain', 'tech', 'Code rain', 'Columns of glowing characters falling down', (c, p, t, r) => {
    dim(c, 0.35);
    const chars = '01アカサタナハマヤラワ<>/{}[]#$%&*+=';
    const size = 20;
    c.font = `${size}px monospace`;
    const flick = step(t, 16);
    for (let i = 0; i < 45; i++) {
      const col = int(r, 0, W / size - 1);
      const head = -100 + lap(r(), int(r, 1, 2), t) * (H + 500);
      for (let j = 0; j < 16; j++) {
        const y = head - j * size;
        if (y < -size || y > H + size) continue;
        const ch = chars[Math.floor(hash(col * 131 + Math.round(y / size), flick) * chars.length)];
        c.fillStyle = rgba(j ? p.accent : p.text, j ? (1 - j / 16) * 0.8 : 1);
        c.fillText(ch, col * size, y);
      }
    }
  }),
  S('circuit', 'tech', 'Circuit board', 'Pulses of light running along circuit lines', (c, p, t, r) => {
    const g = 40;
    for (let i = 0; i < 22; i++) {
      let x = int(r, 1, W / g - 1) * g;
      let y = int(r, 1, H / g - 1) * g;
      const pts: [number, number][] = [[x, y]];
      for (let s = 0; s < 6; s++) {
        const d = int(r, 2, 6) * g * (r() < 0.5 ? -1 : 1);
        if (s % 2) y = Math.max(g, Math.min(H - g, y + d));
        else x = Math.max(g, Math.min(W - g, x + d));
        pts.push([x, y]);
      }
      c.strokeStyle = rgba(p.accent, 0.22);
      c.lineWidth = 2;
      c.beginPath();
      pts.forEach(([px, py], j) => (j ? c.lineTo(px, py) : c.moveTo(px, py)));
      c.stroke();
      c.fillStyle = rgba(p.accent, 0.4);
      dot(c, pts[0][0], pts[0][1], 4);
      dot(c, pts[6][0], pts[6][1], 4);
      const lens = pts.slice(1).map((q, j) => Math.hypot(q[0] - pts[j][0], q[1] - pts[j][1]));
      const total = lens.reduce((a, b) => a + b, 0) || 1;
      let at = lap(r(), int(r, 1, 2), t) * total;
      let j = 0;
      while (j < lens.length - 1 && at > lens[j]) at -= lens[j++];
      const f = lens[j] ? at / lens[j] : 0;
      const hx = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f;
      const hy = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f;
      glow(c, hx, hy, 18, p.text, 0.8);
    }
  }),
  S('hexgrid', 'tech', 'Hex grid', 'Honeycomb cells lighting up in waves', (c, p, t) => {
    const s = 36;
    const hw = Math.sqrt(3) * s;
    c.lineWidth = 1.5;
    for (let row = -1; row < H / (s * 1.5) + 1; row++) {
      for (let col = -1; col < W / hw + 1; col++) {
        const x = col * hw + (row % 2 ? hw / 2 : 0);
        const y = row * s * 1.5;
        const d = Math.hypot(x - W / 2, y - H / 2);
        const on = Math.pow(ping(1, t, -d / 900), 4);
        poly(c, x, y, s - 2, 6, Math.PI / 6);
        c.fillStyle = rgba(p.accent, 0.04 + 0.3 * on);
        c.fill();
        c.strokeStyle = rgba(p.accent, 0.2 + 0.3 * on);
        c.stroke();
      }
    }
  }),
  S('datastream', 'tech', 'Data streams', 'Rows of data dashing across the screen', (c, p, t, r) => {
    const period = 400;
    for (let i = 0; i < 18; i++) {
      const y = (H * (i + 0.5)) / 18;
      const k = int(r, 1, 3) * (i % 2 ? 1 : -1);
      const off = lap(0, k, t) * period;
      const dashes = Array.from({ length: 6 }, () => [r() * period, 10 + r() * 60]);
      c.fillStyle = rgba(i % 4 ? p.accent : p.text, 0.45);
      for (let x0 = -period; x0 < W + period; x0 += period) for (const [dx, w] of dashes) c.fillRect(x0 + dx + off, y - 2, w, 4);
    }
  }),
  S('network', 'tech', 'Network', 'Dots joined by lines, always on the move', (c, p, t, r) => {
    const nodes = Array.from({ length: 38 }, () => {
      const x0 = r() * W;
      const y0 = r() * H;
      const ph = r();
      const ph2 = r();
      return [x0 + sin(1, t, ph) * 60, y0 + cos(1, t, ph2) * 50] as [number, number];
    });
    c.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]);
        if (d < 200) {
          c.strokeStyle = rgba(p.accent, (1 - d / 200) * 0.45);
          line(c, nodes[i][0], nodes[i][1], nodes[j][0], nodes[j][1]);
        }
      }
    }
    c.fillStyle = rgba(p.text, 0.8);
    for (const [x, y] of nodes) dot(c, x, y, 3);
  }),
  S('hud', 'tech', 'HUD rings', 'Sci-fi display rings turning in different directions', (c, p, t, r) => {
    const cx = W / 2;
    const cy = H / 2;
    for (let i = 0; i < 6; i++) {
      const rad = 80 + i * 50;
      const k = (i % 2 ? 1 : -1) * (i < 3 ? 1 : 2);
      c.lineWidth = 3 + (i % 3) * 3;
      c.strokeStyle = rgba(i % 2 ? p.accent : p.text, 0.35);
      const parts = int(r, 2, 4);
      const a0 = turn(k, t, r());
      for (let j = 0; j < parts; j++) {
        const a = a0 + (j * TAU) / parts;
        c.beginPath();
        c.arc(cx, cy, rad, a, a + (TAU / parts) * 0.6);
        c.stroke();
      }
    }
    c.lineWidth = 2;
    c.strokeStyle = rgba(p.accent, 0.3);
    for (let i = 0; i < 60; i++) {
      const a = (i * TAU) / 60;
      const l = i % 5 ? 8 : 18;
      line(c, cx + Math.cos(a) * 400, cy + Math.sin(a) * 400, cx + Math.cos(a) * (400 + l), cy + Math.sin(a) * (400 + l));
    }
  }),
  S('waveform', 'tech', 'Oscilloscope', 'Glowing sound waves on a screen grid', (c, p, t, r) => {
    c.strokeStyle = rgba(p.accent, 0.08);
    c.lineWidth = 1;
    for (let x = 0; x <= W; x += 64) line(c, x, 0, x, H);
    for (let y = 0; y <= H; y += 64) line(c, 0, y, W, y);
    for (let i = 0; i < 3; i++) {
      const f1 = int(r, 1, 3);
      const f2 = int(r, 3, 7);
      const k = int(r, 1, 2);
      const ph = r();
      const base = H * (0.3 + i * 0.2);
      for (const [w, a] of [
        [8, 0.12],
        [2, 0.85],
      ]) {
        c.lineWidth = w;
        c.strokeStyle = rgba(i === 1 ? p.text : p.accent, a);
        c.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const u = x / W;
          const y = base + Math.sin(TAU * (u * f1 + k * t + ph)) * 50 + Math.sin(TAU * (u * f2 - k * t)) * 18;
          if (x) c.lineTo(x, y);
          else c.moveTo(x, y);
        }
        c.stroke();
      }
    }
  }),
  S('scanner', 'tech', 'Scanner', 'A bright line scanning down a field of dots', (c, p, t) => {
    const band = -100 + lap(0, 1, t) * (H + 200);
    for (let x = 16; x < W; x += 32) {
      for (let y = 16; y < H; y += 32) {
        const b = Math.exp(-Math.pow((y - band) / 60, 2));
        c.fillStyle = rgba(b > 0.5 ? p.text : p.accent, 0.12 + 0.8 * b);
        dot(c, x, y, 2 + 3 * b);
      }
    }
    const g = c.createLinearGradient(0, band - 30, 0, band + 30);
    g.addColorStop(0, rgba(p.accent, 0));
    g.addColorStop(0.5, rgba(p.accent, 0.35));
    g.addColorStop(1, rgba(p.accent, 0));
    c.fillStyle = g;
    c.fillRect(0, band - 30, W, 60);
  }),
  S('glitch', 'tech', 'Glitch', 'Blocks of colour glitching in and out', (c, p, t) => {
    const s = step(t, 32);
    const cols = [p.accent, p.text, p.dim];
    for (let i = 0; i < 16; i++) {
      if (hash(i, s + 500) < 0.35) continue;
      c.fillStyle = rgba(cols[i % 3], 0.1 + hash(i, s + 9) * 0.2);
      c.fillRect(hash(i, s) * W, hash(i + 40, s) * H, 40 + hash(i, s + 1) * 300, 4 + hash(i, s + 2) * 60);
    }
    for (let i = 0; i < 10; i++) {
      c.fillStyle = rgba(p.text, 0.08);
      c.fillRect(0, hash(i + 90, s) * H, W, 2);
    }
  }),
  S('dotwave', 'tech', 'Dot wave', 'A sheet of dots rolling like a wave', (c, p, t) => {
    for (let i = 0; i < W / 36 + 1; i++) {
      for (let j = 0; j < H / 36 + 1; j++) {
        const z = Math.sin(TAU * (i * 0.05 + j * 0.035 - t));
        c.fillStyle = rgba(z > 0.001 ? p.accent : p.text, 0.2 + 0.35 * (z + 1));
        dot(c, i * 36, j * 36 + z * 12, 1.5 + 2.2 * (z + 1));
      }
    }
  }),

  // Party
  S('fireworks', 'party', 'Fireworks', 'Rockets bursting into showers of colour', (c, p, t, r) => {
    dim(c, 0.35);
    const cols = [p.accent, p.text, mix(p.accent, 'ffd040', 0.5), mix(p.accent, '40c0ff', 0.5)];
    for (let i = 0; i < 7; i++) {
      const u = lap(i / 7 + r() * 0.05, 1, t);
      const cx = W * (0.12 + r() * 0.76);
      const cy = H * (0.15 + r() * 0.35);
      const col = cols[i % 4];
      const parts = Array.from({ length: 36 }, (_, j) => [(j * TAU) / 36 + r() * 0.1, 0.6 + r() * 0.4]);
      if (u < 0.18) {
        const q = u / 0.18;
        const y = H - (H - cy) * q;
        c.fillStyle = rgba(col, 0.9);
        dot(c, cx, y, 2.5);
        glow(c, cx, y + 12, 10, col, 0.4);
        continue;
      }
      const q = (u - 0.18) / 0.82;
      const a = Math.pow(1 - q, 1.5);
      for (const [ang, v] of parts) {
        const d = v * (1 - (1 - q) * (1 - q)) * 200;
        c.fillStyle = rgba(col, a);
        dot(c, cx + Math.cos(ang) * d, cy + Math.sin(ang) * d + q * q * 70, 2.2);
      }
      glow(c, cx, cy, 140, col, 0.25 * a);
    }
  }),
  S('disco', 'party', 'Disco lights', 'Coloured spots of light dancing round the room', (c, p, t, r) => {
    dim(c, 0.3);
    c.globalCompositeOperation = 'lighter';
    const cols = [p.accent, p.text, p.dim, mix(p.accent, '40c0ff', 0.6)];
    for (let i = 0; i < 40; i++) {
      const x0 = r() * W;
      const y0 = r() * H;
      const ph = r();
      const k = int(r, 1, 2);
      glow(c, x0 + sin(k, t, ph) * 180, y0 + cos(k, t, ph) * 100, 30 + r() * 50, cols[i % 4], 0.4);
    }
  }),
  S('spotlights', 'party', 'Spotlights', 'Stage spotlights sweeping side to side', (c, p, t, r) => {
    dim(c, 0.35);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const ox = W * (0.1 + i * 0.2);
      const oy = H + 20;
      const a = -Math.PI / 2 + sin(1, t, r()) * 0.5;
      const w = 0.11;
      const g = c.createLinearGradient(ox, oy, ox + Math.cos(a) * 1000, oy + Math.sin(a) * 1000);
      g.addColorStop(0, rgba(i % 2 ? p.accent : p.text, 0.35));
      g.addColorStop(1, rgba(i % 2 ? p.accent : p.text, 0));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(ox, oy);
      c.lineTo(ox + Math.cos(a - w) * 1100, oy + Math.sin(a - w) * 1100);
      c.lineTo(ox + Math.cos(a + w) * 1100, oy + Math.sin(a + w) * 1100);
      c.closePath();
      c.fill();
    }
  }),
  S('streamers', 'party', 'Streamers', 'Curly party streamers falling', (c, p, t, r) => {
    const cols = [p.accent, p.text, p.dim, mix(p.accent, p.text, 0.5)];
    c.lineWidth = 4;
    c.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const x = r() * W;
      const y = -140 + lap(r(), 1, t) * (H + 200);
      const ph = r();
      c.strokeStyle = rgba(cols[i % 4], 0.75);
      c.beginPath();
      for (let s = 0; s <= 20; s++) {
        const px = x + Math.sin(s * 0.6 + TAU * (2 * t + ph)) * 12;
        const py = y + s * 6;
        if (s) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      c.stroke();
    }
  }),
  S('glitter', 'party', 'Glitter', 'Tiny sparkling glitter drifting down', (c, p, t, r) => {
    for (let i = 0; i < 160; i++) {
      const x = r() * W;
      const y = -10 + lap(r(), 1, t) * (H + 20);
      const tw = Math.pow(ping(int(r, 2, 5), t, r()), 2);
      const s = 2 + tw * 4;
      c.fillStyle = rgba(i % 3 ? p.text : p.accent, 0.3 + 0.7 * tw);
      c.beginPath();
      c.moveTo(x, y - s);
      c.lineTo(x + s * 0.5, y);
      c.lineTo(x, y + s);
      c.lineTo(x - s * 0.5, y);
      c.closePath();
      c.fill();
    }
  }),
  S('lasers', 'party', 'Laser show', 'Fans of laser beams sweeping the room', (c, p, t, r) => {
    dim(c, 0.4);
    c.globalCompositeOperation = 'lighter';
    for (const [ox, oy] of [
      [0, 0],
      [W, 0],
      [W / 2, -10],
    ]) {
      const ph = r();
      const base = Math.atan2(H - oy, W / 2 - ox);
      for (let j = 0; j < 8; j++) {
        const a = base + (j - 3.5) * 0.09 + sin(1, t, ph) * 0.4;
        for (const [w, al] of [
          [8, 0.08],
          [2, 0.5],
        ]) {
          c.lineWidth = w;
          c.strokeStyle = rgba(j % 2 ? p.accent : p.text, al);
          line(c, ox, oy, ox + Math.cos(a) * 1600, oy + Math.sin(a) * 1600);
        }
      }
    }
  }),
  S('bunting', 'party', 'Bunting', 'Strings of little flags swaying', (c, p, t, r) => {
    const cols = [p.accent, p.text, p.dim, mix(p.accent, p.text, 0.5)];
    for (let row = 0; row < 3; row++) {
      const y0 = 40 + row * 110;
      const sag = 60 + r() * 30;
      const sway = sin(1, t, r()) * 10;
      const yAt = (x: number) => y0 + sag * (1 - Math.pow((x - W / 2) / (W / 2), 2)) + sway * Math.sin((Math.PI * x) / W);
      c.strokeStyle = rgba(p.text, 0.4);
      c.lineWidth = 1.5;
      c.beginPath();
      for (let x = 0; x <= W; x += 20) (x ? c.lineTo(x, yAt(x)) : c.moveTo(x, yAt(x)));
      c.stroke();
      for (let x = 30 + row * 20, j = 0; x < W; x += 70, j++) {
        const y = yAt(x);
        const tip = sin(1, t, j * 0.1 + row * 0.3) * 8;
        c.fillStyle = rgba(cols[(j + row) % 4], 0.8);
        c.beginPath();
        c.moveTo(x - 18, y);
        c.lineTo(x + 18, yAt(x + 36) - (yAt(x + 36) - y) * 0.5);
        c.lineTo(x + tip, y + 40);
        c.closePath();
        c.fill();
      }
    }
  }),
  S('beat', 'party', 'Bass pulse', 'Rings pumping to a steady beat', (c, p, t) => {
    const f = (t * 16) % 1;
    const pulse = Math.pow(1 - f, 3);
    glow(c, W / 2, H / 2, 170 + pulse * 70, p.accent, 0.35 + pulse * 0.25);
    c.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      c.strokeStyle = rgba(i % 2 ? p.accent : p.text, 0.1 + pulse * 0.25);
      c.beginPath();
      c.arc(W / 2, H / 2, 90 + i * 85 + pulse * 18 * (6 - i), 0, TAU);
      c.stroke();
    }
    c.strokeStyle = rgba(p.text, (1 - f) * 0.4);
    c.beginPath();
    c.arc(W / 2, H / 2, f * 700, 0, TAU);
    c.stroke();
  }),
  S('lanterns', 'party', 'Sky lanterns', 'Warm paper lanterns floating up into the night', (c, p, t, r) => {
    dim(c, 0.35);
    const warm = mix(p.accent, 'ffb347', 0.6);
    for (let i = 0; i < 26; i++) {
      const x0 = r() * W;
      const s = 14 + r() * 22;
      const y = H + 80 - lap(r(), 1, t) * (H + 160);
      const ph = r();
      const x = x0 + sin(1, t, ph) * 20;
      const fl = 0.8 + 0.2 * sin(5, t, ph);
      glow(c, x, y, s * 3, warm, 0.25 * fl);
      c.fillStyle = rgba(warm, 0.85 * fl);
      c.beginPath();
      c.ellipse(x, y, s * 0.6, s * 0.8, 0, 0, TAU);
      c.fill();
      c.fillStyle = rgba(mix(warm, 'ffffff', 0.6), 0.9 * fl);
      dot(c, x, y + s * 0.5, s * 0.15);
    }
  }),
  S('starburst', 'party', 'Starburst', 'Turning rays with sparkles popping', (c, p, t, r) => {
    const n = 16;
    const base = turn(1, t) / n;
    c.fillStyle = rgba(p.accent, 0.1);
    for (let i = 0; i < n; i++) {
      const a = base + (i * TAU) / n;
      c.beginPath();
      c.moveTo(W / 2, H / 2);
      c.lineTo(W / 2 + Math.cos(a - 0.08) * 1400, H / 2 + Math.sin(a - 0.08) * 1400);
      c.lineTo(W / 2 + Math.cos(a + 0.08) * 1400, H / 2 + Math.sin(a + 0.08) * 1400);
      c.closePath();
      c.fill();
    }
    for (let i = 0; i < 30; i++) {
      const on = Math.pow(ping(int(r, 1, 3), t, r()), 6);
      c.fillStyle = rgba(i % 2 ? p.text : p.accent, on);
      star(c, r() * W, r() * H, 4 + on * 14, 4, 0.25);
      c.fill();
    }
  }),

  // Spooky
  S('bats', 'spooky', 'Bats', 'Bats flapping past a big moon', (c, p, t, r) => {
    dim(c, 0.4);
    glow(c, W * 0.78, H * 0.25, 220, p.text, 0.25);
    c.fillStyle = rgba(mix(p.text, 'fff4d0', 0.5), 0.85);
    dot(c, W * 0.78, H * 0.25, 80);
    for (let i = 0; i < 16; i++) {
      const s = 10 + r() * 16;
      const x = -80 + lap(r(), int(r, 1, 2), t) * (W + 160);
      const ph = r();
      const y = r() * H * 0.8 + sin(2, t, ph) * 30;
      const flap = sin(12, t, ph);
      c.fillStyle = rgba(mix(p.bg, '000000', 0.7), 0.95);
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x - s, y - s * flap, x - s * 2, y - s * 0.6 * flap);
      c.quadraticCurveTo(x - s, y + s * 0.2, x, y + s * 0.3);
      c.quadraticCurveTo(x + s, y + s * 0.2, x + s * 2, y - s * 0.6 * flap);
      c.quadraticCurveTo(x + s, y - s * flap, x, y);
      c.fill();
      dot(c, x, y, s * 0.3);
    }
  }),
  S('ghosts', 'spooky', 'Ghosts', 'Friendly ghosts floating about', (c, p, t, r) => {
    dim(c, 0.35);
    for (let i = 0; i < 7; i++) {
      const x0 = r() * W;
      const y0 = H * (0.2 + r() * 0.6);
      const ph = r();
      const s = 28 + r() * 30;
      const x = x0 + sin(1, t, ph) * 120;
      const y = y0 + sin(2, t, r()) * 25;
      c.fillStyle = rgba(p.text, 0.22);
      c.beginPath();
      c.arc(x, y, s, Math.PI, 0);
      c.lineTo(x + s, y + s * 1.3);
      for (let j = 0; j <= 6; j++) c.lineTo(x + s - (j * s) / 3, y + s * 1.3 + sin(2, t, j / 6 + ph) * s * 0.15 * (j % 2 ? 1 : -1));
      c.closePath();
      c.fill();
      c.fillStyle = rgba(mix(p.bg, '000000', 0.6), 0.5);
      dot(c, x - s * 0.35, y - s * 0.1, s * 0.12);
      dot(c, x + s * 0.35, y - s * 0.1, s * 0.12);
    }
  }),
  S('mist', 'spooky', 'Graveyard mist', 'Moonlight and mist creeping along the ground', (c, p, t, r) => {
    dim(c, 0.4);
    glow(c, W * 0.25, H * 0.2, 260, p.text, 0.2);
    for (let l = 0; l < 5; l++) {
      for (let i = 0; i < 6; i++) {
        glow(c, r() * W + sin(1, t, r()) * (80 + l * 30), H * (0.65 + l * 0.08), 200 + r() * 100, p.text, 0.1);
      }
    }
  }),
  S('wisps', 'spooky', 'Wisps', 'Glowing spirit lights trailing through the dark', (c, p, t, r) => {
    dim(c, 0.45);
    for (let i = 0; i < 12; i++) {
      const x0 = r() * W;
      const y0 = r() * H;
      const ph = r();
      const ph2 = r();
      const col = i % 3 ? p.accent : p.text;
      for (let j = 9; j >= 0; j--) {
        const tt = t - j * 0.006;
        const x = x0 + sin(1, tt, ph) * 150;
        const y = y0 + sin(2, tt, ph2) * 60;
        glow(c, x, y, 16 - j, col, (1 - j / 10) * 0.5);
      }
    }
  }),
  S('candles', 'spooky', 'Candlelight', 'A row of candles with flickering flames', (c, p, t, r) => {
    dim(c, 0.45);
    const warm = mix(p.accent, 'ffb050', 0.6);
    for (let i = 0; i < 7; i++) {
      const x = W * (0.1 + i * 0.13);
      const h = 80 + r() * 120;
      const top = H - h;
      const ph = r();
      const fl = 1 + 0.15 * sin(7, t, ph) + 0.08 * sin(13, t, r());
      glow(c, x, top - 20, 160 * fl, warm, 0.18);
      c.fillStyle = rgba(mix(p.text, p.bg, 0.3), 0.9);
      c.fillRect(x - 18, top, 36, h);
      c.fillStyle = rgba(warm, 0.95);
      c.beginPath();
      c.ellipse(x + sin(5, t, ph) * 2, top - 18 * fl, 7, 18 * fl, 0, 0, TAU);
      c.fill();
      c.fillStyle = rgba('ffffff', 0.7);
      c.beginPath();
      c.ellipse(x, top - 10 * fl, 3, 8 * fl, 0, 0, TAU);
      c.fill();
    }
  }),
  S('web', 'spooky', 'Spider webs', 'Cobwebs in the corners swaying gently', (c, p, t, r) => {
    dim(c, 0.35);
    c.lineWidth = 1;
    for (const [cx, dir] of [
      [0, 1],
      [W, -1],
    ]) {
      const sw = sin(1, t, cx ? 0.3 : 0) * 0.04;
      const threads = Array.from({ length: 9 }, (_, i) => (i / 8) * (Math.PI / 2) + sw);
      const pt = (a: number, d: number): [number, number] => [cx + dir * Math.cos(a) * d, Math.sin(a) * d];
      c.strokeStyle = rgba(p.text, 0.3);
      for (const a of threads) line(c, cx, 0, ...pt(a, 420));
      for (let k = 1; k <= 9; k++) {
        c.beginPath();
        threads.forEach((a, i) => {
          const [x, y] = pt(a, k * 45 + sin(1, t, k * 0.1) * 3);
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        });
        c.stroke();
      }
      for (let i = 0; i < 10; i++) {
        const [x, y] = pt(threads[int(r, 0, 8)], int(r, 1, 9) * 45);
        c.fillStyle = rgba(p.text, 0.3 + 0.7 * Math.pow(ping(1, t, r()), 4));
        dot(c, x, y, 2);
      }
    }
  }),
  S('moonclouds', 'spooky', 'Moonlit clouds', 'Dark clouds drifting past a bright moon', (c, p, t, r) => {
    dim(c, 0.4);
    glow(c, W * 0.65, H * 0.32, 300, p.text, 0.25);
    c.fillStyle = rgba(mix(p.text, 'fff8e0', 0.5), 0.9);
    dot(c, W * 0.65, H * 0.32, 110);
    c.fillStyle = rgba(mix(p.bg, '000000', 0.4), 0.85);
    for (let i = 0; i < 6; i++) cloud(c, r() * W + sin(1, t, r()) * 160, H * (0.15 + r() * 0.5), 50 + r() * 40);
  }),
  S('eyes', 'spooky', 'Eyes in the dark', 'Glowing eyes that blink now and then', (c, p, t, r) => {
    dim(c, 0.55);
    for (let i = 0; i < 14; i++) {
      const ph = r();
      const x = r() * W + sin(1, t, ph) * 8;
      const y = r() * H + cos(1, t, ph) * 4;
      const b = lap(r(), 1, t);
      const open = b < 0.05 ? Math.abs(b - 0.025) / 0.025 : 1;
      const s = 0.6 + r() * 0.8;
      glow(c, x, y, 40 * s, p.accent, 0.12 * open);
      for (const dx of [-13, 13]) {
        c.fillStyle = rgba(p.accent, 0.9);
        c.beginPath();
        c.ellipse(x + dx * s, y, 8 * s, Math.max(0.3, 5 * s * open), 0, 0, TAU);
        c.fill();
        c.fillStyle = rgba('000000', 0.8);
        c.beginPath();
        c.ellipse(x + dx * s, y, 2 * s, Math.max(0.2, 4 * s * open), 0, 0, TAU);
        c.fill();
      }
    }
  }),
  S('storm', 'spooky', 'Storm', 'Heavy rain with a soft flash of lightning', (c, p, t, r) => {
    dim(c, 0.45);
    rain(c, p, t, r, 200);
    const f = lap(0.7, 1, t);
    const flash = f < 0.1 ? (1 - f / 0.1) * 0.14 : 0;
    c.fillStyle = rgba(p.text, flash);
    c.fillRect(0, 0, W, H);
  }),
  S('runes', 'spooky', 'Glowing runes', 'Mysterious symbols glowing and fading', (c, p, t, r) => {
    dim(c, 0.4);
    c.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const x = r() * W;
      const y = r() * H;
      const s = 18 + r() * 16;
      const on = Math.pow(ping(1, t, r()), 3);
      const segs = Array.from({ length: int(r, 3, 5) }, () => [r() - 0.5, r() - 0.5, r() - 0.5, r() - 0.5]);
      for (const [w, a] of [
        [7, 0.15],
        [2.5, 0.9],
      ]) {
        c.lineWidth = w;
        c.strokeStyle = rgba(p.accent, a * on);
        for (const [a1, b1, a2, b2] of segs) line(c, x + a1 * s * 2, y + b1 * s * 2, x + a2 * s * 2, y + b2 * s * 2);
      }
    }
  }),

  // Under the sea
  S('caustics', 'sea', 'Light ripples', 'Rippling light on the sea floor', (c, p, t) => {
    c.globalCompositeOperation = 'lighter';
    c.lineWidth = 3;
    c.strokeStyle = rgba(p.text, 0.08);
    for (let i = 0; i < 16; i++) {
      c.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const y = (H * i) / 15 + Math.sin(TAU * (x / 300 + t + i * 0.2)) * 22 + Math.sin(TAU * (x / 170 - t)) * 10;
        if (x) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.stroke();
    }
    for (let i = 0; i < 24; i++) {
      c.beginPath();
      for (let y = 0; y <= H; y += 16) {
        const x = (W * i) / 23 + Math.sin(TAU * (y / 260 - t + i * 0.3)) * 22 + Math.sin(TAU * (y / 150 + t)) * 10;
        if (y) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.stroke();
    }
  }),
  S('jellyfish', 'sea', 'Jellyfish', 'Jellyfish pulsing slowly upwards', (c, p, t, r) => {
    for (let i = 0; i < 7; i++) {
      const x0 = r() * W;
      const s = 24 + r() * 26;
      const y = H + 150 - lap(r(), 1, t) * (H + 300);
      const ph = r();
      const x = x0 + sin(1, t, ph) * 20;
      const pulse = 1 + 0.12 * sin(4, t, ph);
      const col = i % 2 ? p.accent : mix(p.accent, p.text, 0.5);
      glow(c, x, y, s * 2.2, col, 0.15);
      c.fillStyle = rgba(col, 0.35);
      c.beginPath();
      c.ellipse(x, y, s * pulse, s * 0.8 / pulse, 0, Math.PI, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = rgba(col, 0.4);
      c.lineWidth = 2;
      for (let j = 0; j < 5; j++) {
        const tx = x - s * 0.7 + (j * s * 1.4) / 4;
        c.beginPath();
        for (let k = 0; k <= 10; k++) {
          const px = tx + Math.sin(k * 0.6 + TAU * (2 * t + ph + j * 0.1)) * 5;
          if (k) c.lineTo(px, y + k * s * 0.18);
          else c.moveTo(px, y);
        }
        c.stroke();
      }
    }
  }),
  S('fish', 'sea', 'Fish school', 'Schools of little fish swimming by', (c, p, t, r) => {
    for (let sch = 0; sch < 4; sch++) {
      const dir = sch % 2 ? -1 : 1;
      const u = lap(r(), 1, t);
      const sx = dir > 0 ? -200 + u * (W + 400) : W + 200 - u * (W + 400);
      const sy = H * (0.2 + r() * 0.6) + sin(1, t, r()) * 40;
      const col = sch % 2 ? p.accent : p.text;
      for (let f = 0; f < 12; f++) {
        const fx = sx + (r() - 0.5) * 220;
        const fy = sy + (r() - 0.5) * 120 + sin(2, t, f * 0.08) * 8;
        const s = 7 + r() * 6;
        const wag = sin(10, t, r()) * s * 0.3;
        c.fillStyle = rgba(col, 0.6);
        c.beginPath();
        c.ellipse(fx, fy, s * 1.4, s * 0.6, 0, 0, TAU);
        c.fill();
        c.beginPath();
        c.moveTo(fx - dir * s * 1.2, fy);
        c.lineTo(fx - dir * s * 2.2, fy - s * 0.6 + wag);
        c.lineTo(fx - dir * s * 2.2, fy + s * 0.6 + wag);
        c.closePath();
        c.fill();
      }
    }
  }),
  S('seaweed', 'sea', 'Seaweed', 'Seaweed swaying in the current', (c, p, t, r) => {
    const col = mix(p.accent, '2e8b57', 0.5);
    c.lineCap = 'round';
    for (let i = 0; i < 20; i++) {
      const bx = r() * W;
      const h = 160 + r() * 280;
      const ph = r();
      c.strokeStyle = rgba(i % 3 ? col : p.dim, 0.55);
      c.lineWidth = 6 + r() * 6;
      c.beginPath();
      for (let s = 0; s <= 12; s++) {
        const y = H + 10 - (s * h) / 12;
        const x = bx + sin(1, t, ph + s * 0.06) * s * 3;
        if (s) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.stroke();
    }
  }),
  S('godrays', 'sea', 'Sun rays', 'Shafts of sunlight shining down through the water', (c, p, t, r) => {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x0 = r() * W + sin(1, t, r()) * 60;
      const w = 40 + r() * 80;
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba(p.text, 0.18));
      g.addColorStop(1, rgba(p.text, 0));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x0 - w / 2, 0);
      c.lineTo(x0 + w / 2, 0);
      c.lineTo(x0 + w * 1.2 + 120, H);
      c.lineTo(x0 - w * 0.2 + 120, H);
      c.closePath();
      c.fill();
    }
    c.fillStyle = rgba(p.text, 0.4);
    for (let i = 0; i < 60; i++) dot(c, r() * W + sin(1, t, r()) * 15, r() * H + cos(1, t, r()) * 15, 1.2);
  }),
  S('deepbubbles', 'sea', 'Rising bubbles', 'Streams of bubbles rising from the deep', (c, p, t, r) => {
    c.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      const bx = r() * W;
      const ph = r();
      for (let j = 0; j < 14; j++) {
        const u = lap(j / 14 + ph, 1, t);
        const y = H + 20 - u * (H + 40);
        const x = bx + sin(3, t, j * 0.2) * 10 * u;
        c.strokeStyle = rgba(p.text, 0.45);
        c.beginPath();
        c.arc(x, y, 2 + u * 7, 0, TAU);
        c.stroke();
      }
    }
  }),
  S('plankton', 'sea', 'Plankton', 'Tiny glowing specks drifting in deep water', (c, p, t, r) => {
    dim(c, 0.35);
    for (let i = 0; i < 200; i++) {
      const x = r() * W + sin(1, t, r()) * 25;
      const y = r() * H + cos(1, t, r()) * 25;
      const on = ping(int(r, 1, 3), t, r());
      c.fillStyle = rgba(i % 4 ? p.accent : p.text, 0.2 + 0.6 * on);
      dot(c, x, y, 1 + on * 1.5);
    }
  }),
  S('pond', 'sea', 'Pond ripples', 'Raindrops making rings on still water', (c, p, t, r) => {
    c.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const x = r() * W;
      const y = r() * H;
      const f0 = lap(r(), 1, t);
      for (let k = 0; k < 3; k++) {
        const f = f0 - k * 0.08;
        if (f <= 0) continue;
        c.strokeStyle = rgba(p.text, (1 - f) * 0.45);
        c.beginPath();
        c.ellipse(x, y, f * 200, f * 70, 0, 0, TAU);
        c.stroke();
      }
    }
  }),
  S('reef', 'sea', 'Coral reef', 'Coral swaying on the sea floor with specks drifting by', (c, p, t, r) => {
    c.lineCap = 'round';
    const cols = [p.accent, p.dim, mix(p.accent, 'ff8070', 0.4)];
    const branch = (x: number, y: number, a: number, len: number, w: number, depth: number, ph: number) => {
      const sway = sin(1, t, ph + depth * 0.05) * 0.06 * depth;
      const x2 = x + Math.cos(a + sway) * len;
      const y2 = y + Math.sin(a + sway) * len;
      c.lineWidth = w;
      line(c, x, y, x2, y2);
      if (depth < 3) {
        branch(x2, y2, a - 0.45, len * 0.72, w * 0.7, depth + 1, ph);
        branch(x2, y2, a + 0.4, len * 0.72, w * 0.7, depth + 1, ph);
      }
    };
    for (let i = 0; i < 10; i++) {
      c.strokeStyle = rgba(cols[i % 3], 0.6);
      branch(W * (i / 9) + (r() - 0.5) * 60, H + 10, -Math.PI / 2 + (r() - 0.5) * 0.4, 60 + r() * 50, 12, 0, r());
    }
    c.fillStyle = rgba(p.text, 0.4);
    for (let i = 0; i < 30; i++) dot(c, W - lap(r(), 1, t) * W, r() * H * 0.7, 1.5);
  }),
  S('whale', 'sea', 'Whale', 'A big whale gliding gently with bubbles rising', (c, p, t, r) => {
    const x = W * 0.5 + sin(1, t) * 60;
    const y = H * 0.5 + sin(1, t, 0.25) * 20;
    const tail = sin(1, t) * 0.25;
    c.fillStyle = rgba(mix(p.bg, '000000', 0.35), 0.85);
    c.beginPath();
    c.ellipse(x, y, 260, 80, 0, 0, TAU);
    c.fill();
    c.save();
    c.translate(x - 240, y);
    c.rotate(tail);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(-90, -10, -150, -70);
    c.quadraticCurveTo(-110, 0, -150, 70);
    c.quadraticCurveTo(-90, 10, 0, 0);
    c.fill();
    c.restore();
    c.strokeStyle = rgba(p.text, 0.2);
    c.lineWidth = 2;
    for (let i = 0; i < 5; i++) line(c, x - 60 + i * 30, y + 40, x - 40 + i * 30, y + 70);
    c.fillStyle = rgba(p.text, 0.5);
    dot(c, x + 170, y - 20, 6);
    c.lineWidth = 1.5;
    for (let j = 0; j < 10; j++) {
      const u = lap(j / 10, 1, t);
      c.strokeStyle = rgba(p.text, 0.45 * (1 - u));
      c.beginPath();
      c.arc(x + 160 + sin(2, t, j * 0.1) * 10, y - 80 - u * (y - 40), 3 + u * 6, 0, TAU);
      c.stroke();
    }
    void r;
  }),

  // Speed & action
  S('speedlines', 'speed', 'Speed lines', 'Comic-style speed lines rushing at the edges', (c, p, t, r) => {
    const s = step(t, 24);
    for (let i = 0; i < 110; i++) {
      const a = r() * TAU;
      const d0 = 300 + r() * 220;
      const w = 1 + r() * 4;
      if (hash(i, s) < 0.35) continue;
      c.strokeStyle = rgba(p.text, 0.3);
      c.lineWidth = w;
      line(c, W / 2 + Math.cos(a) * d0, H / 2 + Math.sin(a) * d0 * 0.6, W / 2 + Math.cos(a) * 1100, H / 2 + Math.sin(a) * 700);
    }
  }),
  S('road', 'speed', 'Retro road', 'Driving down an endless road towards the horizon', (c, p, t) => {
    const hz = H * 0.5;
    glow(c, W / 2, hz, 260, p.accent, 0.5);
    c.fillStyle = rgba(mix(p.bg, '000000', 0.3));
    c.fillRect(0, hz, W, H - hz);
    c.fillStyle = rgba(mix(p.bg2, '000000', 0.2));
    c.beginPath();
    c.moveTo(W / 2 - 10, hz);
    c.lineTo(W / 2 + 10, hz);
    c.lineTo(W / 2 + 560, H);
    c.lineTo(W / 2 - 560, H);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba(p.accent, 0.8);
    c.lineWidth = 3;
    line(c, W / 2 - 10, hz, W / 2 - 560, H);
    line(c, W / 2 + 10, hz, W / 2 + 560, H);
    for (let i = 0; i < 10; i++) {
      const z1 = lap(i / 10, 1, t);
      const z2 = Math.min(1, z1 + 0.04);
      const y1 = hz + (H - hz) * z1 * z1;
      const y2 = hz + (H - hz) * z2 * z2;
      c.fillStyle = rgba(p.text, 0.85);
      c.beginPath();
      c.moveTo(W / 2 - 1 - z1 * 8, y1);
      c.lineTo(W / 2 + 1 + z1 * 8, y1);
      c.lineTo(W / 2 + 1 + z2 * 8, y2);
      c.lineTo(W / 2 - 1 - z2 * 8, y2);
      c.closePath();
      c.fill();
    }
  }),
  S('streaks', 'speed', 'Motion streaks', 'Streaks of light whooshing past', (c, p, t, r) => {
    for (let i = 0; i < 120; i++) {
      const x = W + 300 - lap(r(), int(r, 2, 5), t) * (W + 600);
      const y = r() * H;
      const len = 80 + r() * 220;
      const g = c.createLinearGradient(x, y, x + len, y);
      g.addColorStop(0, rgba(i % 4 ? p.text : p.accent, 0.6));
      g.addColorStop(1, rgba(p.text, 0));
      c.strokeStyle = g;
      c.lineWidth = 1 + r() * 2;
      line(c, x, y, x + len, y);
    }
  }),
  S('zoom', 'speed', 'Zoom burst', 'Frames rushing outwards from the centre', (c, p, t) => {
    c.lineWidth = 3;
    for (let i = 0; i < 16; i++) {
      const z = lap(i / 16, 1, t);
      const s = z * z * 1.8;
      c.strokeStyle = rgba(i % 2 ? p.accent : p.text, (1 - z) * 0.5);
      c.strokeRect(W / 2 - (W * s) / 2, H / 2 - (H * s) / 2, W * s, H * s);
    }
  }),
  S('flag', 'speed', 'Checkered flag', 'A racing flag waving across the screen', (c, p, t) => {
    const g = 60;
    for (let i = 0; i < W / g + 1; i++) {
      for (let j = 0; j < H / g + 1; j++) {
        const wave = sin(1, t, i * 0.06 - j * 0.02);
        const shade = 0.5 + 0.5 * cos(1, t, i * 0.06 - j * 0.02);
        c.fillStyle = rgba((i + j) % 2 ? mix(p.text, p.bg, 0.4 * (1 - shade)) : mix(p.bg, '000000', 0.4 * (1 - shade)), 0.35);
        c.fillRect(i * g, j * g + wave * 24, g, g);
      }
    }
  }),
  S('sparks', 'speed', 'Sparks', 'Hot sparks spraying up and falling', (c, p, t, r) => {
    const warm = mix(p.accent, 'ffa020', 0.5);
    c.lineWidth = 2;
    for (const [ex, dir] of [
      [0, 1],
      [W, -1],
    ]) {
      for (let i = 0; i < 45; i++) {
        const u = lap(r(), 2, t);
        const vx = (0.4 + r() * 0.8) * dir;
        const vy = 0.8 + r() * 0.6;
        const x = ex + vx * u * 500;
        const y = H - vy * u * 700 + u * u * 650;
        const dx = vx * 500;
        const dy = -vy * 700 + 2 * u * 650;
        const n = Math.hypot(dx, dy) || 1;
        c.strokeStyle = rgba(i % 3 ? warm : 'ffffff', 1 - u);
        line(c, x, y, x - (dx / n) * 14, y - (dy / n) * 14);
      }
    }
  }),
  S('arcs', 'speed', 'Electric arcs', 'Crackling bolts of electricity', (c, p, t, r) => {
    const s = step(t, 16);
    for (let i = 0; i < 10; i++) {
      const x1 = r() * W;
      const y1 = r() * H;
      const x2 = x1 + (r() - 0.5) * 600;
      const y2 = y1 + (r() - 0.5) * 400;
      if (hash(i, s) < 0.45) continue;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 10; k++) {
        const f = k / 10;
        const j = k === 0 || k === 10 ? 0 : (hash(i * 31 + k, s) - 0.5) * 60;
        pts.push([x1 + (x2 - x1) * f + j, y1 + (y2 - y1) * f + j * 0.7]);
      }
      for (const [w, a] of [
        [8, 0.1],
        [2, 0.8],
      ]) {
        c.lineWidth = w;
        c.strokeStyle = rgba(i % 2 ? p.accent : p.text, a);
        c.beginPath();
        pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.stroke();
      }
    }
  }),
  S('energy', 'speed', 'Energy rings', 'Thick glowing rings spinning around a core', (c, p, t) => {
    glow(c, W / 2, H / 2, 140 + 30 * ping(4, t), p.accent, 0.5);
    for (let i = 0; i < 5; i++) {
      const a0 = turn(i % 2 ? 2 : -1, t, i * 0.2);
      for (const [w, al] of [
        [18, 0.12],
        [5, 0.6],
      ]) {
        c.lineWidth = w;
        c.strokeStyle = rgba(i % 2 ? p.text : p.accent, al);
        c.beginPath();
        c.arc(W / 2, H / 2, 120 + i * 60, a0, a0 + Math.PI * (0.6 + i * 0.15));
        c.stroke();
      }
    }
  }),
  S('stripes', 'speed', 'Racing stripes', 'Bold diagonal stripes sliding past', (c, p, t) => {
    const period = 120;
    const off = lap(0, 1, t) * period;
    c.fillStyle = rgba(p.accent, 0.14);
    for (let x = -H - period; x < W + period; x += period) {
      c.beginPath();
      c.moveTo(x + off, 0);
      c.lineTo(x + off + 60, 0);
      c.lineTo(x + off + 60 + H, H);
      c.lineTo(x + off + H, H);
      c.closePath();
      c.fill();
    }
  }),
  S('shockwave', 'speed', 'Shockwaves', 'Powerful waves blasting outwards', (c, p, t) => {
    for (let i = 0; i < 4; i++) {
      const f = lap(i / 4, 1, t);
      c.lineWidth = 4 + 30 * (1 - f);
      c.strokeStyle = rgba(i % 2 ? p.accent : p.text, (1 - f) * 0.3);
      c.beginPath();
      c.arc(W / 2, H / 2, f * 900, 0, TAU);
      c.stroke();
    }
    glow(c, W / 2, H / 2, 120, p.accent, 0.3);
  }),
];

/** Draws one frame of a scene; `t` goes from 0 to 1 over the loop, and 1 looks the same as 0. */
export function drawScene(c: Ctx, id: string, p: Palette6, t: number) {
  c.save();
  c.globalCompositeOperation = 'source-over';
  backdrop(c, p);
  const scene = SCENES.find((s) => s.id === id);
  if (scene) scene.draw(c, p, t, rng(7));
  c.restore();
}
