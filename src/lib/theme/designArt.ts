// Full-screen artwork for designs: the background picture and the floating decorations
// (sparkles, hearts, bolts...). Both are written as PNG, drawn here as SVG source, so they can
// use patterns and gradients RetroBat's own SVG renderer can't draw.

import type { Palette6 } from './designs';

export type Background =
  | 'gradient' | 'grid' | 'scanlines' | 'waves' | 'stripes' | 'sunset' | 'dots' | 'plain' | 'glass' | 'pixels' | 'rays' | 'aurora'
  | 'diagonal' | 'blobs' | 'bokeh' | 'hex' | 'embers' | 'carpet' | 'hearts' | 'confetti' | 'petals' | 'code' | 'holo' | 'circuit'
  | 'speedlines' | 'halftone' | 'stars' | 'space' | 'wood' | 'hills' | 'fog' | 'chrome' | 'artdeco' | 'vapor' | 'manga';

export type Deco = 'sparkles' | 'hearts' | 'stars' | 'bubbles' | 'bolts' | 'shapes' | 'petals' | 'leaves' | 'bats' | 'diamonds' | 'bursts' | 'planets';

/** What the artwork needs from a design. */
export interface ArtSource {
  id: string;
  palette: Palette6;
  background: Background;
  /** A second accent for two-colour art (sun gradients, confetti...). */
  accent2?: string;
  deco?: Deco;
  /** Decoration colours; the accents and text colour when not given. */
  decoColors?: string[];
}

export const W = 1920;
export const H = 1080;
export const hex = (c: string) => `#${c.slice(0, 6)}`;
export const svg = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;
const f = (n: number) => (Math.round(n * 10) / 10).toString();

/** Mixes two RRGGBB colours (t = 0 gives a). */
export function mixHex(a: string, b: string, t: number): string {
  const ch = (c: string, i: number) => parseInt(c.slice(i, i + 2), 16) || 0;
  return [0, 2, 4].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** The same pseudo-random numbers every time for the same seed, so artwork never changes by itself. */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let s = h >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const accent2Of = (a: ArtSource) => hex(a.accent2 ?? mixHex(a.palette.accent, a.palette.text, 0.45));

function linear(id: string, stops: [number, string, number?][], x2 = 0, y2 = 1, x1 = 0, y1 = 0) {
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op === undefined ? '' : ` stop-opacity="${op}"`}/>`).join('')}</linearGradient>`;
}
function radial(id: string, color: string, op: number, cx = 0.5, cy = 0.5, r = 0.5) {
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
}
const vignette = (op = 0.4) => `<defs><radialGradient id="vg" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${op}"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#vg)"/>`;

/** A perspective floor of lines from a horizon down to the bottom edge. */
function floorGrid(horizon: number, color: string, op: number, rows = 12) {
  const lines: string[] = [];
  for (let i = -20; i <= 20; i++) lines.push(`<line x1="${W / 2 + i * 40}" y1="${horizon}" x2="${W / 2 + i * 260}" y2="${H}"/>`);
  for (let k = 0; k < rows; k++) {
    const y = horizon + Math.pow(k / (rows - 1), 2) * (H - horizon);
    lines.push(`<line x1="0" y1="${f(y)}" x2="${W}" y2="${f(y)}"/>`);
  }
  return `<g stroke="${color}" stroke-opacity="${op}" stroke-width="2">${lines.join('')}</g>`;
}

/** A striped sun on the horizon. */
function sun(cx: number, cy: number, r: number, top: string, bottom: string, sky: string) {
  const bands: string[] = [];
  for (let i = 0; i < 7; i++) bands.push(`<rect x="${cx - r}" y="${f(cy + r * 0.05 + i * r * 0.115)}" width="${r * 2}" height="${f(r * (0.03 + i * 0.008))}" fill="${sky}"/>`);
  return `<defs>${linear('sun', [[0, top], [1, bottom]])}</defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#sun)"/>${bands.join('')}`;
}

// ---- shapes (unit size, centred on 0 0) ----

const SPARKLE = 'M0 -1C0.12 -0.12 0.12 -0.12 1 0C0.12 0.12 0.12 0.12 0 1C-0.12 0.12 -0.12 0.12 -1 0C-0.12 -0.12 -0.12 -0.12 0 -1Z';
const HEART = 'M0 -0.35C0 -0.75 -0.5 -0.75 -0.5 -0.4C-0.5 -0.1 0 0.1 0 0.5C0 0.1 0.5 -0.1 0.5 -0.4C0.5 -0.75 0 -0.75 0 -0.35Z';
const BOLT = 'M0.2 -1L-0.5 0.15L-0.05 0.15L-0.25 1L0.5 -0.2L0.05 -0.2Z';
const PETAL = 'M0 -1C0.6 -0.6 0.6 0.4 0 1C-0.6 0.4 -0.6 -0.6 0 -1Z';
const BAT = 'M0 -0.2C0.2 -0.5 0.5 -0.5 1 -0.6C0.8 -0.3 0.85 -0.1 0.9 0.15C0.7 0 0.5 0.05 0.35 0.25C0.25 0.1 0.1 0.1 0 0.3C-0.1 0.1 -0.25 0.1 -0.35 0.25C-0.5 0.05 -0.7 0 -0.9 0.15C-0.85 -0.1 -0.8 -0.3 -1 -0.6C-0.5 -0.5 -0.2 -0.5 0 -0.2Z';
const DIAMOND = 'M0 -1L0.7 0L0 1L-0.7 0Z';
const SQUIGGLE = 'M-1 0C-0.75 -0.5 -0.5 -0.5 -0.25 0S0.25 0.5 0.5 0S0.85 -0.5 1 -0.2';
const TRIANGLE = 'M0 -0.9L0.85 0.6L-0.85 0.6Z';
const PLUS = 'M-0.25 -1H0.25V-0.25H1V0.25H0.25V1H-0.25V0.25H-1V-0.25H-0.25Z';

function starPath(points: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const r = i % 2 ? inner : 1;
    pts.push(`${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`);
  }
  return `M${pts.join('L')}Z`;
}
const STAR = starPath(5, 0.45);
const BURST = starPath(12, 0.64);

/** Sprinkles of a decoration round the edges of the screen, clear of the clock and help bar. */
export function decoSvg(a: ArtSource): string | null {
  if (!a.deco) return null;
  const p = a.palette;
  const rnd = rng(`${a.id}:${a.deco}`);
  const colours = (a.decoColors?.length ? a.decoColors : [p.accent, a.accent2 ?? mixHex(p.accent, p.text, 0.45), p.text]).map(hex);
  const spots: [number, number][] = [];
  for (let tries = 0; spots.length < 15 && tries < 600; tries++) {
    const x = rnd();
    const y = rnd();
    const edge = x < 0.1 || x > 0.9 || y < 0.12 || y > 0.86;
    if (!edge && rnd() > 0.06) continue;
    if ((x > 0.82 && y < 0.11) || (x < 0.42 && y > 0.92)) continue;
    if (spots.some(([sx, sy]) => Math.hypot((sx - x) * W, (sy - y) * H) < 130)) continue;
    spots.push([x, y]);
  }
  const out: string[] = [];
  spots.forEach(([x, y], i) => {
    const s = 14 + rnd() * 30;
    const rot = Math.round(rnd() * 360);
    const c = colours[i % colours.length];
    const op = (0.5 + rnd() * 0.4).toFixed(2);
    const at = `transform="translate(${f(x * W)} ${f(y * H)}) rotate(${rot}) scale(${f(s)})"`;
    const fill = (d: string, extra = '') => out.push(`<path d="${d}" fill="${c}" fill-opacity="${op}" ${at}${extra}/>`);
    const line = (d: string, w = 0.16) => out.push(`<path d="${d}" fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${at}/>`);
    switch (a.deco) {
      case 'sparkles':
        fill(SPARKLE);
        break;
      case 'hearts':
        fill(HEART);
        break;
      case 'stars':
        if (i % 3) fill(STAR);
        else fill(SPARKLE);
        break;
      case 'bubbles':
        out.push(`<g ${at} opacity="${op}"><circle r="1" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="0.1"/><path d="M-0.55 -0.35A0.65 0.65 0 0 1 -0.2 -0.62" fill="none" stroke="#fff" stroke-width="0.12" stroke-linecap="round"/></g>`);
        break;
      case 'bolts':
        fill(BOLT);
        break;
      case 'shapes':
        [() => line(TRIANGLE), () => line(SQUIGGLE, 0.22), () => fill(PLUS), () => out.push(`<circle r="0.8" fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="0.22" ${at}/>`)][i % 4]();
        break;
      case 'petals':
        fill(PETAL);
        break;
      case 'leaves':
        fill(PETAL);
        line('M0 -0.8L0 0.8', 0.08);
        break;
      case 'bats':
        fill(BAT);
        break;
      case 'diamonds':
        line(DIAMOND, 0.1);
        if (i % 2) out.push(`<path d="${DIAMOND}" fill="${c}" fill-opacity="${op}" transform="translate(${f(x * W)} ${f(y * H)}) rotate(${rot}) scale(${f(s * 0.45)})"/>`);
        break;
      case 'bursts':
        out.push(`<path d="${BURST}" fill="${c}" fill-opacity="${op}" stroke="#000" stroke-opacity="0.6" stroke-width="0.08" ${at}/>`);
        break;
      case 'planets':
        out.push(`<g ${at} opacity="${op}"><circle r="0.7" fill="${c}"/><ellipse rx="1.15" ry="0.3" fill="none" stroke="${c}" stroke-width="0.1" transform="rotate(-20)"/></g>`);
        break;
    }
  });
  return svg(W, H, out.join(''));
}

/** The background picture. */
export function backgroundSvg(a: ArtSource): string {
  const p = a.palette;
  const bg = hex(p.bg);
  const bg2 = hex(p.bg2);
  const ac = hex(p.accent);
  const a2 = accent2Of(a);
  const tx = hex(p.text);
  const rnd = rng(`${a.id}:${a.background}`);
  const full = (fill: string, extra = '') => `<rect width="${W}" height="${H}" fill="${fill}"${extra}/>`;
  switch (a.background) {
    case 'grid':
      return svg(W, H, `<defs>${linear('s', [[0, bg], [0.58, bg2], [1, bg]])}</defs>${full('url(#s)')}${floorGrid(H * 0.58, ac, 0.45)}<rect y="${H * 0.575}" width="${W}" height="4" fill="${a2}" opacity="0.8"/>`);
    case 'scanlines':
      return svg(W, H, `<defs><radialGradient id="g" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="${bg2}"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs>${full('url(#g)')}`);
    case 'waves': {
      const wave = (y: number, amp: number, o: number, op: number) => {
        let d = `M0 ${y}`;
        for (let x = 0; x <= W; x += 40) d += ` L${x} ${f(y + Math.sin(x / 260 + o) * amp)}`;
        return `<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity="${op}" stroke-width="3"/>`;
      };
      return svg(W, H, `<defs>${linear('b', [[0, bg2], [1, bg]], 1, 1)}${radial('gl', ac, 0.25, 0.5, 0.6, 0.6)}</defs>${full('url(#b)')}${full('url(#gl)')}${wave(H * 0.55, 60, 0, 0.4)}${wave(H * 0.58, 45, 1.3, 0.3)}${wave(H * 0.61, 70, 2.1, 0.25)}${wave(H * 0.64, 35, 3.4, 0.35)}${wave(H * 0.67, 55, 4.2, 0.18)}`);
    }
    case 'stripes':
      return svg(W, H, `<defs><pattern id="st" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)"><rect width="40" height="40" fill="${bg}"/><rect width="40" height="14" fill="${bg2}"/></pattern>${radial('gl', '#ffffff', 0.5, 0.3, 0.2, 0.6)}</defs>${full('url(#st)')}${full('url(#gl)')}`);
    case 'sunset':
      return svg(W, H, `<defs>${linear('sky', [[0, bg], [0.62, bg2], [1, '#ff5f7e']])}</defs>${full('url(#sky)')}${sun(960, 610, 300, '#ffd23d', '#ff3d8b', bg)}<rect y="${H * 0.66}" width="${W}" height="${H * 0.34}" fill="${bg}" opacity="0.94"/>${floorGrid(H * 0.66, ac, 0.5, 9)}`);
    case 'dots':
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]], 1, 1)}<pattern id="d" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="4" fill="${ac}" fill-opacity="0.16"/><circle cx="27" cy="27" r="4" fill="${a2}" fill-opacity="0.14"/></pattern></defs>${full('url(#g)')}${full('url(#d)')}`);
    case 'glass':
      return svg(W, H, `<defs>${radial('a', bg2, 1, 0.2, 0.2, 0.6)}${radial('c', a2, 0.55, 0.85, 0.85, 0.55)}${radial('e', ac, 0.3, 0.6, 0.1, 0.4)}</defs>${full(bg)}${full('url(#a)')}${full('url(#c)')}${full('url(#e)')}`);
    case 'pixels': {
      const blocks: string[] = [];
      for (let i = 0; i < 80; i++) blocks.push(`<rect x="${Math.floor(rnd() * 48) * 40}" y="${Math.floor(rnd() * 27) * 40}" width="40" height="40" fill="${i % 7 ? bg2 : ac}" fill-opacity="${i % 7 ? 1 : 0.35}"/>`);
      return svg(W, H, `${full(bg)}${blocks.join('')}`);
    }
    case 'rays': {
      const beams: string[] = [];
      for (let i = -6; i <= 6; i++) beams.push(`<path d="M${W / 2 - 30} -20 L${W / 2 + 30} -20 L${W / 2 + i * 260 + 120} ${H} L${W / 2 + i * 260 - 120} ${H} Z" fill="${ac}" fill-opacity="${(0.08 - Math.abs(i) * 0.009).toFixed(3)}"/>`);
      return svg(W, H, `<defs><radialGradient id="r" cx="0.5" cy="0" r="1"><stop offset="0" stop-color="${bg2}"/><stop offset="1" stop-color="${bg}"/></radialGradient>${radial('fl', ac, 0.2, 0.5, 0.55, 0.4)}</defs>${full('url(#r)')}${beams.join('')}${full('url(#fl)')}`);
    }
    case 'aurora': {
      const band = (y: number, amp: number, o: number, op: number, c: string) => {
        let d = `M0 ${y}`;
        for (let x = 0; x <= W; x += 60) d += ` L${x} ${f(y + Math.sin(x / 300 + o) * amp)}`;
        return `<path d="${d} L${W} ${H} L0 ${H} Z" fill="${c}" fill-opacity="${op}"/>`;
      };
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]])}</defs>${full('url(#g)')}${band(H * 0.3, 40, 0, 0.06, a2)}${band(H * 0.45, 55, 1.7, 0.06, ac)}${band(H * 0.62, 35, 3.1, 0.07, ac)}${band(H * 0.78, 30, 4.4, 0.06, a2)}`);
    }
    case 'diagonal':
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]], 1, 1)}<pattern id="dl" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="2" height="28" fill="${tx}" fill-opacity="0.035"/></pattern></defs>${full('url(#g)')}${full('url(#dl)')}<path d="M${W * 0.64} 0H${W * 0.82}L${W * 0.5} ${H}H${W * 0.32}Z" fill="${ac}" fill-opacity="0.08"/><path d="M${W * 0.86} 0H${W * 0.89}L${W * 0.57} ${H}H${W * 0.54}Z" fill="${a2}" fill-opacity="0.14"/>`);
    case 'blobs':
      return svg(W, H, `<defs>${radial('b1', ac, 0.28, 0.85, 0.1, 0.45)}${radial('b2', a2, 0.24, 0.1, 0.9, 0.5)}${radial('b3', bg2, 1, 0.45, 0.4, 0.6)}</defs>${full(bg)}${full('url(#b3)')}${full('url(#b1)')}${full('url(#b2)')}`);
    case 'bokeh': {
      const dots: string[] = [];
      for (let i = 0; i < 46; i++) dots.push(`<circle cx="${f(rnd() * W)}" cy="${f(rnd() * H)}" r="${f(20 + rnd() * rnd() * 130)}" fill="url(#${i % 3 ? 'k1' : 'k2'})" opacity="${(0.25 + rnd() * 0.6).toFixed(2)}"/>`);
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]])}<radialGradient id="k1"><stop offset="0" stop-color="${ac}" stop-opacity="0.45"/><stop offset="0.75" stop-color="${ac}" stop-opacity="0.22"/><stop offset="1" stop-color="${ac}" stop-opacity="0"/></radialGradient><radialGradient id="k2"><stop offset="0" stop-color="${a2}" stop-opacity="0.4"/><stop offset="0.75" stop-color="${a2}" stop-opacity="0.2"/><stop offset="1" stop-color="${a2}" stop-opacity="0"/></radialGradient></defs>${full('url(#g)')}${dots.join('')}${vignette(0.45)}`);
    }
    case 'hex': {
      const s = 30;
      const hexPath = (cx: number, cy: number) => `M${[0, 1, 2, 3, 4, 5].map((k) => `${f(cx + Math.cos((Math.PI / 3) * k - Math.PI / 2) * s)} ${f(cy + Math.sin((Math.PI / 3) * k - Math.PI / 2) * s)}`).join('L')}Z`;
      const w = Math.sqrt(3) * s;
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]], 1, 1)}<pattern id="hx" width="${f(w)}" height="${s * 3}" patternUnits="userSpaceOnUse"><path d="${hexPath(w / 2, s)}${hexPath(0, s * 2.5)}${hexPath(w, s * 2.5)}" fill="none" stroke="${ac}" stroke-opacity="0.12" stroke-width="2"/></pattern>${radial('gl', ac, 0.35, 0.05, 0.95, 0.55)}${radial('g2', a2, 0.25, 0.95, 0.05, 0.45)}</defs>${full('url(#g)')}${full('url(#hx)')}${full('url(#gl)')}${full('url(#g2)')}<path d="M${W * 0.7} 0H${W * 0.76}L${W * 0.58} ${H}H${W * 0.52}Z" fill="${a2}" fill-opacity="0.1"/>`);
    }
    case 'embers': {
      const sparks: string[] = [];
      const hot = ['#ffd27a', ac, a2];
      for (let i = 0; i < 130; i++) sparks.push(`<circle cx="${f(rnd() * W)}" cy="${f(H * (1 - rnd() * rnd()))}" r="${f(1.2 + rnd() * 4)}" fill="${hot[i % 3]}" opacity="${(0.25 + rnd() * 0.7).toFixed(2)}"/>`);
      return svg(W, H, `<defs>${linear('g', [[0, bg], [0.6, bg2], [1, ac]])}${radial('heat', ac, 0.5, 0.5, 1.05, 0.65)}</defs>${full('url(#g)')}${full('url(#heat)')}${sparks.join('')}${vignette(0.5)}`);
    }
    case 'carpet': {
      const t = 160;
      return svg(W, H, `<defs><pattern id="cp" width="${t}" height="${t}" patternUnits="userSpaceOnUse"><path d="M20 30L40 64H0Z" fill="${ac}" fill-opacity="0.55"/><circle cx="110" cy="40" r="16" fill="none" stroke="${a2}" stroke-opacity="0.6" stroke-width="6"/><path d="M60 120C75 100 90 140 105 120S135 100 150 120" fill="none" stroke="${tx}" stroke-opacity="0.35" stroke-width="6" stroke-linecap="round"/><path d="M28 104h8v-8h8v8h8v8h-8v8h-8v-8h-8Z" fill="${a2}" fill-opacity="0.5"/><circle cx="140" cy="150" r="5" fill="${ac}" fill-opacity="0.5"/><circle cx="80" cy="80" r="4" fill="${tx}" fill-opacity="0.35"/></pattern></defs>${full(bg)}${full('url(#cp)')}${full(bg, ' fill-opacity="0.45"')}${vignette(0.55)}`);
    }
    case 'hearts':
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]], 1, 1)}<pattern id="hp" width="96" height="96" patternUnits="userSpaceOnUse"><path d="${HEART}" fill="${ac}" fill-opacity="0.16" transform="translate(24 24) scale(18)"/><circle cx="72" cy="72" r="5" fill="${a2}" fill-opacity="0.22"/><path d="${SPARKLE}" fill="#ffffff" fill-opacity="0.5" transform="translate(72 22) scale(6)"/></pattern>${radial('gl', '#ffffff', 0.55, 0.5, 0.35, 0.6)}</defs>${full('url(#g)')}${full('url(#hp)')}${full('url(#gl)')}`);
    case 'confetti': {
      const bits: string[] = [];
      const cs = [ac, a2, '#ffd84d', tx];
      for (let i = 0; i < 150; i++) {
        const x = f(rnd() * W);
        const y = f(rnd() * H);
        const c = cs[i % cs.length];
        const op = (0.35 + rnd() * 0.5).toFixed(2);
        bits.push(i % 3 ? `<rect x="-6" y="-3" width="${f(8 + rnd() * 10)}" height="${f(4 + rnd() * 4)}" rx="2" fill="${c}" opacity="${op}" transform="translate(${x} ${y}) rotate(${Math.round(rnd() * 180)})"/>` : `<circle cx="${x}" cy="${y}" r="${f(3 + rnd() * 4)}" fill="${c}" opacity="${op}"/>`);
      }
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]])}${radial('gl', '#ffffff', 0.4, 0.5, 0.45, 0.55)}</defs>${full('url(#g)')}${full('url(#gl)')}${bits.join('')}`);
    }
    case 'petals': {
      const bits: string[] = [];
      for (let i = 0; i < 6; i++) bits.push(`<circle cx="${f(rnd() * W)}" cy="${f(rnd() * H)}" r="${f(160 + rnd() * 200)}" fill="url(#bl)"/>`);
      for (let i = 0; i < 80; i++) bits.push(`<path d="${PETAL}" fill="${i % 4 ? ac : '#ffffff'}" fill-opacity="${(0.25 + rnd() * 0.5).toFixed(2)}" transform="translate(${f(rnd() * W)} ${f(rnd() * H)}) rotate(${Math.round(rnd() * 360)}) scale(${f(7 + rnd() * 9)} ${f(9 + rnd() * 10)})"/>`);
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]])}${radial('bl', ac, 0.22)}</defs>${full('url(#g)')}${bits.join('')}`);
    }
    case 'code': {
      const glyphs = '01アイウエオカキクケコサシスセソ<>/{}[]=+*#$%&ABCDEF'.split('');
      const cols: string[] = [];
      for (let x = 12; x < W; x += 34) {
        const len = 6 + Math.floor(rnd() * 22);
        const start = Math.floor(rnd() * 34) - 6;
        const op = 0.05 + rnd() * 0.28;
        for (let k = 0; k < len; k++) {
          const y = (start + k) * 30;
          if (y < 0 || y > H) continue;
          const last = k === len - 1;
          cols.push(`<text x="${x}" y="${y}" fill="${last ? tx : ac}" fill-opacity="${(last ? Math.min(0.9, op * 3) : op * (0.35 + (0.65 * k) / len)).toFixed(2)}">${glyphs[Math.floor(rnd() * glyphs.length)].replace('&', '&amp;').replace('<', '&lt;')}</text>`);
        }
      }
      return svg(W, H, `<defs>${radial('gl', ac, 0.12, 0.5, 0.5, 0.7)}</defs>${full(bg)}${full('url(#gl)')}<g font-family="Consolas, 'Courier New', monospace" font-size="24">${cols.join('')}</g>${vignette(0.6)}`);
    }
    case 'holo': {
      const rings: string[] = [];
      for (let i = 1; i <= 6; i++) rings.push(`<circle cx="${W / 2}" cy="${H * 0.42}" r="${i * 120}" fill="none" stroke="${ac}" stroke-opacity="${(0.16 - i * 0.02).toFixed(2)}" stroke-width="${i % 2 ? 2 : 1}"${i % 2 ? '' : ' stroke-dasharray="10 14"'}/>`);
      return svg(W, H, `<defs>${linear('g', [[0, bg], [0.62, bg2], [1, bg]])}<pattern id="sl" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="2" fill="${ac}" fill-opacity="0.05"/></pattern>${radial('gl', ac, 0.25, 0.5, 0.42, 0.45)}</defs>${full('url(#g)')}${full('url(#gl)')}${rings.join('')}${floorGrid(H * 0.66, ac, 0.3, 10)}${full('url(#sl)')}`);
    }
    case 'circuit': {
      const traces: string[] = [];
      const step = 40;
      for (let i = 0; i < 46; i++) {
        let x = Math.floor(rnd() * (W / step)) * step;
        let y = Math.floor(rnd() * (H / step)) * step;
        let d = `M${x} ${y}`;
        let dir = Math.floor(rnd() * 4);
        const segs = 2 + Math.floor(rnd() * 4);
        for (let k = 0; k < segs; k++) {
          const len = step * (1 + Math.floor(rnd() * 5));
          const diag = k > 0 && rnd() < 0.4;
          const dx = [1, 0, -1, 0][dir] * len;
          const dy = [0, 1, 0, -1][dir] * len;
          if (diag) {
            x += dx + (dir % 2 ? len : 0) * (rnd() < 0.5 ? 1 : -1);
            y += dy + (dir % 2 ? 0 : len) * (rnd() < 0.5 ? 1 : -1);
          } else {
            x += dx;
            y += dy;
          }
          d += ` L${x} ${y}`;
          dir = (dir + (rnd() < 0.5 ? 1 : 3)) % 4;
        }
        traces.push(`<path d="${d}" fill="none" stroke="${i % 5 ? ac : a2}" stroke-opacity="${(0.12 + rnd() * 0.2).toFixed(2)}" stroke-width="3" stroke-linejoin="round"/><circle cx="${x}" cy="${y}" r="6" fill="${bg}" stroke="${i % 5 ? ac : a2}" stroke-opacity="0.4" stroke-width="3"/>`);
      }
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]], 1, 1)}${radial('gl', ac, 0.18, 0.7, 0.3, 0.5)}</defs>${full('url(#g)')}${full('url(#gl)')}${traces.join('')}${vignette(0.5)}`);
    }
    case 'speedlines': {
      const cx = W * 0.62;
      const cy = H * 0.45;
      const lines: string[] = [];
      for (let i = 0; i < 110; i++) {
        const a = rnd() * Math.PI * 2;
        const w = 0.004 + rnd() * 0.012;
        const r0 = 300 + rnd() * 260;
        const R = 1500;
        lines.push(`<path d="M${f(cx + Math.cos(a - w) * R)} ${f(cy + Math.sin(a - w) * R)}L${f(cx + Math.cos(a) * r0)} ${f(cy + Math.sin(a) * r0)}L${f(cx + Math.cos(a + w) * R)} ${f(cy + Math.sin(a + w) * R)}Z" fill="${i % 4 ? tx : ac}" fill-opacity="${(0.06 + rnd() * 0.16).toFixed(2)}"/>`);
      }
      return svg(W, H, `<defs><radialGradient id="g" cx="0.62" cy="0.45" r="0.8"><stop offset="0" stop-color="${bg2}"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs>${full('url(#g)')}${lines.join('')}`);
    }
    case 'halftone': {
      const dots: string[] = [];
      for (let y = 0; y <= H; y += 30)
        for (let x = (y / 30) % 2 ? 15 : 0; x <= W; x += 30) {
          const t = Math.max(0, 1 - Math.hypot(x, y) / 1100) + Math.max(0, 1 - Math.hypot(W - x, H - y) / 1000);
          const r = 1 + 10 * Math.min(1, t);
          if (r > 1.6) dots.push(`<circle cx="${x}" cy="${y}" r="${f(r)}"/>`);
        }
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]], 1, 1)}</defs>${full('url(#g)')}<g fill="${ac}" fill-opacity="0.3">${dots.join('')}</g>`);
    }
    case 'stars':
    case 'space': {
      const stars: string[] = [];
      for (let i = 0; i < 280; i++) stars.push(`<circle cx="${f(rnd() * W)}" cy="${f(rnd() * H * (a.background === 'stars' ? 0.8 : 1))}" r="${f(0.6 + rnd() * rnd() * 2.4)}" fill="#ffffff" opacity="${(0.25 + rnd() * 0.75).toFixed(2)}"/>`);
      for (let i = 0; i < 9; i++) stars.push(`<path d="${SPARKLE}" fill="${i % 2 ? '#ffffff' : a2}" opacity="0.85" transform="translate(${f(rnd() * W)} ${f(rnd() * H * 0.7)}) scale(${f(6 + rnd() * 10)})"/>`);
      if (a.background === 'stars') {
        // A crescent moon, swirls in the sky and a dark hill line along the bottom.
        let swirl = '';
        for (let k = 0; k < 3; k++) {
          let d = `M0 ${f(H * (0.3 + k * 0.12))}`;
          for (let x = 0; x <= W; x += 40) d += ` L${x} ${f(H * (0.3 + k * 0.12) + Math.sin(x / 220 + k * 1.7) * 38)}`;
          swirl += `<path d="${d}" fill="none" stroke="${a2}" stroke-opacity="0.1" stroke-width="${18 - k * 4}" stroke-linecap="round"/>`;
        }
        let hill = `M0 ${H * 0.86}`;
        for (let x = 0; x <= W; x += 60) hill += ` L${x} ${f(H * 0.86 + Math.sin(x / 340) * 30 + Math.sin(x / 120) * 8)}`;
        return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]])}<mask id="m"><circle cx="${W * 0.84}" cy="${H * 0.2}" r="74" fill="#fff"/><circle cx="${W * 0.84 + 30}" cy="${H * 0.2 - 18}" r="64" fill="#000"/></mask>${radial('mg', '#fff6d5', 0.35, 0.84, 0.2, 0.18)}</defs>${full('url(#g)')}${swirl}${stars.join('')}${full('url(#mg)')}<circle cx="${W * 0.84}" cy="${H * 0.2}" r="74" fill="#fff6d5" mask="url(#m)"/><path d="${hill} L${W} ${H} L0 ${H}Z" fill="${bg}"/>`);
      }
      return svg(W, H, `<defs>${radial('n1', ac, 0.35, 0.7, 0.3, 0.5)}${radial('n2', a2, 0.25, 0.22, 0.75, 0.5)}<radialGradient id="pl" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="${ac}"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs>${full(bg)}${full('url(#n1)')}${full('url(#n2)')}${stars.join('')}<ellipse cx="${W * 0.86}" cy="${H * 0.8}" rx="360" ry="70" fill="none" stroke="${a2}" stroke-opacity="0.35" stroke-width="10" transform="rotate(-16 ${W * 0.86} ${H * 0.8})"/><circle cx="${W * 0.86}" cy="${H * 0.8}" r="200" fill="url(#pl)"/>`);
    }
    case 'wood': {
      const planks: string[] = [];
      const pw = 160;
      for (let i = 0; i * pw < W; i++) {
        const x = i * pw;
        planks.push(`<rect x="${x}" y="0" width="${pw}" height="${H}" fill="${i % 2 ? bg : bg2}"/>`);
        for (let k = 0; k < 6; k++) {
          const gx = x + 14 + k * 24 + rnd() * 8;
          let d = `M${f(gx)} 0`;
          for (let y = 0; y <= H; y += 60) d += ` L${f(gx + Math.sin(y / 140 + i + k) * 6)} ${y}`;
          planks.push(`<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.07" stroke-width="2"/>`);
        }
        planks.push(`<rect x="${x}" y="0" width="3" height="${H}" fill="#000" fill-opacity="0.35"/>`);
      }
      return svg(W, H, `<defs>${radial('lamp', '#ffc27a', 0.42, 0.2, 0.1, 0.7)}</defs>${planks.join('')}${full('url(#lamp)')}${vignette(0.55)}`);
    }
    case 'hills': {
      const hill = (y: number, amp: number, o: number, c: string) => {
        let d = `M0 ${y}`;
        for (let x = 0; x <= W; x += 40) d += ` L${x} ${f(y + Math.sin(x / 380 + o) * amp + Math.sin(x / 150 + o * 2) * amp * 0.25)}`;
        return `<path d="${d} L${W} ${H} L0 ${H}Z" fill="${c}"/>`;
      };
      const clouds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const x = rnd() * W;
        const y = H * (0.08 + rnd() * 0.3);
        clouds.push(`<g fill="#ffffff" opacity="0.7"><ellipse cx="${f(x)}" cy="${f(y)}" rx="90" ry="26"/><ellipse cx="${f(x + 40)}" cy="${f(y - 18)}" rx="50" ry="28"/></g>`);
      }
      return svg(W, H, `<defs>${linear('sky', [[0, bg2], [1, bg]])}${radial('sun', a2, 0.9, 0.82, 0.16, 0.12)}</defs>${full('url(#sky)')}${full('url(#sun)')}${clouds.join('')}${hill(H * 0.62, 50, 0, `#${mixHex(p.accent, p.bg, 0.55)}`)}${hill(H * 0.72, 40, 2, `#${mixHex(p.accent, p.bg, 0.3)}`)}${hill(H * 0.84, 30, 4, ac)}`);
    }
    case 'fog': {
      const fog = (y: number, amp: number, o: number, op: number) => {
        let d = `M0 ${y}`;
        for (let x = 0; x <= W; x += 50) d += ` L${x} ${f(y + Math.sin(x / 260 + o) * amp)}`;
        return `<path d="${d} L${W} ${H} L0 ${H}Z" fill="#ffffff" fill-opacity="${op}"/>`;
      };
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]])}${radial('moon', '#e8f0ff', 0.4, 0.8, 0.2, 0.22)}${radial('blood', ac, 0.3, 0.5, 1.1, 0.7)}</defs>${full('url(#g)')}${full('url(#moon)')}<circle cx="${W * 0.8}" cy="${H * 0.2}" r="80" fill="#e8f0ff" fill-opacity="0.85"/>${fog(H * 0.55, 30, 0, 0.035)}${fog(H * 0.65, 40, 1.4, 0.045)}${fog(H * 0.75, 30, 2.8, 0.05)}${fog(H * 0.86, 25, 4.1, 0.06)}${full('url(#blood)')}${vignette(0.65)}`);
    }
    case 'chrome': {
      const bubbles: string[] = [];
      for (let i = 0; i < 14; i++) bubbles.push(`<circle cx="${f(rnd() * W)}" cy="${f(rnd() * H)}" r="${f(30 + rnd() * rnd() * 160)}" fill="url(#bu)" stroke="#ffffff" stroke-opacity="0.6" stroke-width="2"/>`);
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [0.35, bg], [0.5, '#ffffff'], [0.65, bg], [1, bg2]], 1, 1)}<radialGradient id="bu" cx="0.32" cy="0.3" r="0.7"><stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="0.3" stop-color="${a2}" stop-opacity="0.25"/><stop offset="1" stop-color="${ac}" stop-opacity="0.18"/></radialGradient></defs>${full('url(#g)')}<g fill="#ffffff" fill-opacity="0.25"><rect y="${H * 0.18}" width="${W}" height="6"/><rect y="${H * 0.2}" width="${W}" height="2"/><rect y="${H * 0.78}" width="${W}" height="4"/></g>${bubbles.join('')}`);
    }
    case 'artdeco': {
      const rays: string[] = [];
      const cx = W / 2;
      for (let i = 0; i < 24; i++) {
        const a0 = Math.PI + (i / 24) * Math.PI;
        const a1 = Math.PI + ((i + 0.5) / 24) * Math.PI;
        rays.push(`<path d="M${cx} ${H}L${f(cx + Math.cos(a0) * 1600)} ${f(H + Math.sin(a0) * 1600)}L${f(cx + Math.cos(a1) * 1600)} ${f(H + Math.sin(a1) * 1600)}Z" fill="${ac}" fill-opacity="0.045"/>`);
      }
      const arcs: string[] = [];
      for (let r = 160; r <= 400; r += 48) arcs.push(`<path d="M${cx - r} ${H}A${r} ${r} 0 0 1 ${cx + r} ${H}" fill="none" stroke="${ac}" stroke-opacity="0.32" stroke-width="2"/>`);
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]])}</defs>${full('url(#g)')}${rays.join('')}${arcs.join('')}<rect x="28" y="28" width="${W - 56}" height="${H - 56}" fill="none" stroke="${ac}" stroke-opacity="0.5" stroke-width="2"/><rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="${ac}" stroke-opacity="0.3" stroke-width="1"/><path d="M28 120L120 28M${W - 28} 120L${W - 120} 28M28 ${H - 120}L120 ${H - 28}M${W - 28} ${H - 120}L${W - 120} ${H - 28}" stroke="${ac}" stroke-opacity="0.5" stroke-width="2"/>`);
    }
    case 'vapor':
      return svg(W, H, `<defs>${linear('sky', [[0, bg], [0.6, bg2], [1, a2]])}</defs>${full('url(#sky)')}${sun(W * 0.5, H * 0.5, 260, '#ffe66d', ac, bg2)}<rect y="${H * 0.62}" width="${W}" height="${H * 0.38}" fill="${bg}"/>${floorGrid(H * 0.62, ac, 0.6, 10)}<rect y="${H * 0.615}" width="${W}" height="5" fill="${a2}" opacity="0.9"/>`);
    case 'manga': {
      const panelsAt = [
        `30,30 1150,30 1050,520 30,520`,
        `1180,30 1890,30 1890,520 1080,520`,
        `30,550 700,550 780,1050 30,1050`,
        `730,550 1890,550 1890,1050 810,1050`,
      ];
      const fills = ['url(#tone)', bg, 'url(#tone2)', 'url(#tone)'];
      return svg(W, H, `<defs><pattern id="tone" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="2.6" fill="${tx}" fill-opacity="0.13"/></pattern><pattern id="tone2" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="3" fill="${tx}" fill-opacity="0.08"/></pattern></defs>${full(bg2)}${panelsAt.map((pts, i) => `<polygon points="${pts}" fill="${bg}"/><polygon points="${pts}" fill="${fills[i]}" stroke="${tx}" stroke-opacity="0.55" stroke-width="6" stroke-linejoin="round"/>`).join('')}<path d="M${W - 260} 120l40 -70l10 60l60 -40l-30 70" fill="none" stroke="${ac}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>`);
    }
    case 'gradient':
      return svg(W, H, `<defs>${linear('g', [[0, bg2], [1, bg]])}${radial('gl', ac, 0.16, 0.85, 0.1, 0.55)}</defs>${full('url(#g)')}${full('url(#gl)')}`);
    default:
      return svg(W, H, `${full(bg)}${vignette(0.3)}`);
  }
}

export const BACKGROUNDS: Background[] = ['gradient', 'grid', 'scanlines', 'waves', 'stripes', 'sunset', 'dots', 'plain', 'glass', 'pixels', 'rays', 'aurora', 'diagonal', 'blobs', 'bokeh', 'hex', 'embers', 'carpet', 'hearts', 'confetti', 'petals', 'code', 'holo', 'circuit', 'speedlines', 'halftone', 'stars', 'space', 'wood', 'hills', 'fog', 'chrome', 'artdeco', 'vapor', 'manga'];
