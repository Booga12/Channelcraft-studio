// The plain logic behind Simple mode's property cards: what a text shows, glow presets, sizes,
// the theme's colour swatches, snapping to the screen and one-click looks.

import { COLOR_RE, fmtNum, parsePair } from './schema';
import type { Resolution, ResolvedElement } from './resolver';

/** Element types that get the Text card. */
export const TEXT_TYPES = new Set(['text', 'datetime', 'clock']);
/** Element types that get the Picture card. */
export const PICTURE_TYPES = new Set(['image', 'video']);

// ---- what a text says --------------------------------------------------------------------------

export interface TextSource {
  id: string;
  label: string;
  code: string;
  /** Only on the screens that show one game (the console screen has no current game). */
  game?: boolean;
}

export const TEXT_SOURCES: TextSource[] = [
  { id: 'system', label: 'Console name', code: '{system:fullName}' },
  { id: 'maker', label: 'Console maker', code: '{system:manufacturer}' },
  { id: 'systemYear', label: 'Console release year', code: '{system:releaseYear}' },
  { id: 'total', label: 'Number of games', code: '{system:total}' },
  { id: 'game', label: 'Game name', code: '{game:name}', game: true },
  { id: 'year', label: 'Game release year', code: '{game:year}', game: true },
  { id: 'developer', label: 'Developer', code: '{game:developer}', game: true },
  { id: 'publisher', label: 'Publisher', code: '{game:publisher}', game: true },
  { id: 'genre', label: 'Genre', code: '{game:genre}', game: true },
  { id: 'players', label: 'Players', code: '{game:players}', game: true },
];

export type TextKind = { kind: 'source'; source: TextSource } | { kind: 'own' } | { kind: 'theme' };

/** What a text property holds: one of the known sources, your own words, or something the theme works out. */
export function textKind(raw: string): TextKind {
  const t = raw.trim();
  const source = TEXT_SOURCES.find((s) => s.code.toLowerCase() === t.toLowerCase());
  if (source) return { kind: 'source', source };
  if (/\$\{|\{[a-z]+[:.]/i.test(t) || /^\s*\w+\(/.test(t)) return { kind: 'theme' };
  return { kind: 'own' };
}

/** Text sizes as a fraction of the screen height. */
export const FONT_SIZES = { S: 0.03, M: 0.04, L: 0.055, XL: 0.08 } as const;
export type FontSizeName = keyof typeof FONT_SIZES;

/** The named size closest to `v`, when it is close. */
export function sizeName(v: number): FontSizeName | null {
  for (const [k, s] of Object.entries(FONT_SIZES)) if (Math.abs(s - v) < 0.0015) return k as FontSizeName;
  return null;
}

// ---- glow and shadow ---------------------------------------------------------------------------
//
// RetroBat has no blur for text. It draws a text's glow by drawing the text again in glowColor at
// every pixel offset from -glowSize to +glowSize across and down, moved by glowOffset, under the
// text. Where those copies overlap their colour builds up, so a glow written like a CSS glow (a
// strong colour) comes out as a thick hard outline. A soft glow needs a faint colour that builds
// up near the letters and fades further out: the strength below is how solid it gets next to the
// letters, and the colour's alpha is worked out from it and the size.

export type TextFxKind = 'none' | 'glow' | 'shadow' | 'outline';

export interface TextFx {
  kind: TextFxKind;
  /** RRGGBB */
  color: string;
  /** How far it spreads, in pixels of a 1080-line screen (glowSize). */
  size: number;
  /** 0 to 1: how solid it is next to the letters. */
  strength: number;
  /** Where a shadow falls, in pixels (glowOffset). */
  dx: number;
  dy: number;
}

export const TEXT_FX_KINDS: { id: TextFxKind; label: string; title: string }[] = [
  { id: 'none', label: 'None', title: 'Just the letters' },
  { id: 'glow', label: 'Glow', title: 'Soft light all around the letters' },
  { id: 'shadow', label: 'Shadow', title: 'A shadow falling to one side' },
  { id: 'outline', label: 'Outline', title: 'A clean line around the letters' },
];

/** How many copies overlap next to the letters, roughly, for a size. */
const overlap = (size: number) => Math.max(1, (2 * size + 1) ** 2 / 2);

/** The alpha (0 to 1) each copy needs for a strength. */
export function copyAlpha(strength: number, size: number): number {
  return 1 - Math.pow(1 - Math.min(0.999, Math.max(0, strength)), 1 / overlap(size));
}

const strengthOf = (alpha: number, size: number) => 1 - Math.pow(1 - alpha, overlap(size));
const hex2 = (a: number) =>
  Math.max(1, Math.min(255, Math.round(a * 255)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

/** The effect a text has, from RetroBat's glowColor, glowSize and glowOffset. */
export function textFxOf(color: string | undefined, size: string | undefined, offset: string | undefined): TextFx {
  const c = (color ?? '').trim();
  const rgb = COLOR_RE.test(c) ? c.slice(0, 6).toUpperCase() : 'FFFFFF';
  const alpha = COLOR_RE.test(c) && c.length === 8 ? parseInt(c.slice(6), 16) / 255 : 1;
  const s = Math.max(0, Math.round(parseFloat(size ?? '') || 0));
  const off = parsePair(offset) ?? [0, 0];
  const base = { color: rgb, size: s, dx: off[0], dy: off[1] };
  if (s <= 0 || alpha <= 0) return { ...base, kind: 'none', strength: 0, size: Math.max(1, s) };
  if (off[0] || off[1]) return { ...base, kind: 'shadow', strength: strengthOf(alpha, s) };
  if (alpha >= 0.85) return { ...base, kind: 'outline', strength: alpha };
  return { ...base, kind: 'glow', strength: strengthOf(alpha, s) };
}

/** The properties for an effect. `hasOffset`: the text has a glowOffset, which then goes back to 0 0. */
export function textFxProps(fx: TextFx, hasOffset: boolean): Record<string, string> {
  const still: Record<string, string> = hasOffset ? { glowOffset: '0 0' } : {};
  const size = Math.max(1, Math.round(fx.size));
  if (fx.kind === 'none') return { glowSize: '0', ...still };
  if (fx.kind === 'outline') return { glowColor: `${fx.color}${hex2(Math.max(0.85, fx.strength))}`, glowSize: String(size), ...still };
  const color = `${fx.color}${hex2(copyAlpha(Math.min(0.95, fx.strength), size))}`;
  if (fx.kind === 'glow') return { glowColor: color, glowSize: String(size), ...still };
  const dx = Math.round(fx.dx);
  const dy = Math.round(fx.dy);
  return { glowColor: color, glowSize: String(size), glowOffset: dx || dy ? `${dx} ${dy}` : '2 2' };
}

/** One-click starting points for each effect (the colour is filled in by the caller). */
export const TEXT_FX_PRESETS: Record<Exclude<TextFxKind, 'none'>, { id: string; label: string; fx: Omit<TextFx, 'kind' | 'color'> }[]> = {
  glow: [
    { id: 'soft', label: 'Soft', fx: { size: 3, strength: 0.45, dx: 0, dy: 0 } },
    { id: 'medium', label: 'Medium', fx: { size: 4, strength: 0.65, dx: 0, dy: 0 } },
    { id: 'strong', label: 'Strong', fx: { size: 6, strength: 0.85, dx: 0, dy: 0 } },
    { id: 'neon', label: 'Neon', fx: { size: 8, strength: 0.95, dx: 0, dy: 0 } },
  ],
  shadow: [
    { id: 'subtle', label: 'Subtle', fx: { size: 1, strength: 0.5, dx: 2, dy: 2 } },
    { id: 'medium', label: 'Medium', fx: { size: 2, strength: 0.7, dx: 3, dy: 3 } },
    { id: 'deep', label: 'Deep', fx: { size: 3, strength: 0.85, dx: 5, dy: 5 } },
    { id: 'long', label: 'Long', fx: { size: 1, strength: 0.6, dx: 8, dy: 8 } },
  ],
  outline: [
    { id: 'thin', label: 'Thin', fx: { size: 1, strength: 1, dx: 0, dy: 0 } },
    { id: 'bold', label: 'Bold', fx: { size: 2, strength: 1, dx: 0, dy: 0 } },
    { id: 'heavy', label: 'Heavy', fx: { size: 3, strength: 1, dx: 0, dy: 0 } },
  ],
};

/** The 8 directions a shadow can fall, as offsets of 1. */
export const SHADOW_DIRS: { id: string; label: string; x: number; y: number }[] = [
  { id: 'nw', label: 'Up and left', x: -1, y: -1 },
  { id: 'n', label: 'Up', x: 0, y: -1 },
  { id: 'ne', label: 'Up and right', x: 1, y: -1 },
  { id: 'w', label: 'Left', x: -1, y: 0 },
  { id: 'e', label: 'Right', x: 1, y: 0 },
  { id: 'sw', label: 'Down and left', x: -1, y: 1 },
  { id: 's', label: 'Down', x: 0, y: 1 },
  { id: 'se', label: 'Down and right', x: 1, y: 1 },
];

/** A shadow's direction (one of SHADOW_DIRS) and distance, from its offset. */
export function shadowDir(dx: number, dy: number): { dir: string; distance: number } {
  const sx = Math.sign(Math.round(dx));
  const sy = Math.sign(Math.round(dy));
  return { dir: SHADOW_DIRS.find((d) => d.x === sx && d.y === sy)?.id ?? 'se', distance: Math.max(Math.abs(dx), Math.abs(dy)) || 2 };
}

/**
 * RetroBat's text glow drawn the way it does it, as a CSS text-shadow: one sharp copy at each
 * pixel offset, no blur. `colour` is the glow colour as CSS; `scale` is preview pixels per pixel
 * of a 1080-line screen.
 */
export function glowCss(fx: TextFx, colour: string, scale: number): string {
  if (fx.kind === 'none') return '';
  const s = Math.min(10, Math.max(1, Math.round(fx.size)));
  const out: string[] = [];
  for (let x = -s; x <= s; x++) for (let y = -s; y <= s; y++) out.push(`${((x + fx.dx) * scale).toFixed(2)}px ${((y + fx.dy) * scale).toFixed(2)}px 0 ${colour}`);
  return out.join(', ');
}

// Presets used by the one-click looks and readability fixes.
export type Glow = 'none' | 'soft' | 'strong' | 'shadow' | 'outline';
export const GLOWS: { id: Glow; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'soft', label: 'Soft' },
  { id: 'strong', label: 'Strong' },
  { id: 'shadow', label: 'Shadow' },
];

/** Which preset a text's glow is closest to. */
export function glowOf(color: string | undefined, size: string | undefined, offset: string | undefined): Glow {
  const fx = textFxOf(color, size, offset);
  if (fx.kind === 'glow') return fx.strength <= 0.6 ? 'soft' : 'strong';
  return fx.kind;
}

/**
 * The properties that give a text this glow. A glow takes the text's own colour (`textHex`,
 * RRGGBB); the shadow is dark and moved down and right. `hasOffset`: the text already has a
 * glowOffset, which then has to go back to 0 0.
 */
export function glowProps(g: Glow, textHex: string, hasOffset: boolean): Record<string, string> {
  const rgb = /^[0-9a-f]{6}/i.test(textHex) ? textHex.slice(0, 6).toUpperCase() : 'FFFFFF';
  const preset = (kind: Exclude<TextFxKind, 'none'>, id: string, color: string) => textFxProps({ kind, color, ...TEXT_FX_PRESETS[kind].find((x) => x.id === id)!.fx }, hasOffset);
  if (g === 'none') return textFxProps({ kind: 'none', color: rgb, size: 1, strength: 0, dx: 0, dy: 0 }, hasOffset);
  if (g === 'soft') return preset('glow', 'soft', rgb);
  if (g === 'strong') return preset('glow', 'strong', rgb);
  if (g === 'shadow') return preset('shadow', 'medium', '000000');
  return preset('outline', 'thin', '000000');
}

// ---- colours -----------------------------------------------------------------------------------

/** RRGGBB[AA] in upper case with its alpha, or null. */
export function hex8(v: string | undefined): string | null {
  const t = (v ?? '').trim();
  if (!COLOR_RE.test(t)) return null;
  return (t.length === 6 ? `${t}FF` : t).toUpperCase();
}

/** How many parts of the theme (on any screen) use a variable. */
export function varUsers(res: Resolution, name: string): number {
  const ref = `\${${name}}`;
  let n = 0;
  for (const view of res.views.values()) {
    for (const el of view.elements.values()) if ([...el.props.values()].some((d) => d.raw.includes(ref))) n++;
  }
  return n;
}

export interface Swatch {
  /** The theme variable it links to. */
  name: string;
  hex: string;
}

/** Design colours first, in an order that suits text. */
const DESIGN_ORDER = ['designText', 'designDimText', 'designAccent', 'designSelectedText', 'designGlow', 'designBackground', 'designPanel'];

/**
 * The theme's colours worth offering as one-click swatches: its design colours, else the colour
 * variables this screen uses most.
 */
export function themeSwatches(res: Resolution, view: string, max = 7): Swatch[] {
  const colours = [...res.vars.values()].filter((v) => COLOR_RE.test(v.value.trim()));
  const design = DESIGN_ORDER.map((n) => colours.find((v) => v.name === n)).filter((v): v is NonNullable<typeof v> => !!v);
  const pool = design.length ? design : colours;
  const used = new Map<string, number>();
  for (const el of res.views.get(view)?.elements.values() ?? []) {
    for (const d of el.props.values()) for (const m of d.raw.matchAll(/\$\{([^}]+)\}/g)) used.set(m[1], (used.get(m[1]) ?? 0) + 1);
  }
  const sorted = design.length ? pool : [...pool].sort((a, b) => (used.get(b.name) ?? 0) - (used.get(a.name) ?? 0) || a.name.localeCompare(b.name));
  return sorted.slice(0, max).map((v) => ({ name: v.name, hex: hex8(v.value)! }));
}

/** Basic colours offered next to the theme's own. */
export const BASIC_SWATCHES = ['FFFFFFFF', '111111FF', 'F2C14EFF', 'FF6B8BFF', '53D6C3FF', '6D7FF2FF'];

// ---- position and size -------------------------------------------------------------------------

export type SnapX = 'left' | 'center' | 'right';
export type SnapY = 'top' | 'middle' | 'bottom';

/**
 * Where an element's position goes so its box (`rect`, screen fractions) sits at a spot on the
 * screen, `margin` away from the edges.
 */
export function snapPos(rect: { x: number; y: number; w: number; h: number }, pos: [number, number], sx: SnapX, sy: SnapY, margin = 0.04): [number, number] {
  const tx = sx === 'left' ? margin : sx === 'right' ? 1 - margin - rect.w : 0.5 - rect.w / 2;
  const ty = sy === 'top' ? margin : sy === 'bottom' ? 1 - margin - rect.h : 0.5 - rect.h / 2;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return [r(pos[0] + tx - rect.x), r(pos[1] + ty - rect.y)];
}

/** Which spot an element's box is at, if it is at one. */
export function snappedAt(rect: { x: number; y: number; w: number; h: number }, margin = 0.04): { x: SnapX; y: SnapY } | null {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.006;
  const x: SnapX | null = near(rect.x, margin) ? 'left' : near(rect.x + rect.w, 1 - margin) ? 'right' : near(rect.x + rect.w / 2, 0.5) ? 'center' : null;
  const y: SnapY | null = near(rect.y, margin) ? 'top' : near(rect.y + rect.h, 1 - margin) ? 'bottom' : near(rect.y + rect.h / 2, 0.5) ? 'middle' : null;
  return x && y ? { x, y } : null;
}

/** The size property a picture is sized by, and its width. */
export function pictureSize(el: ResolvedElement): { prop: 'maxSize' | 'size' | 'minSize'; w: number; h: number } | null {
  for (const prop of ['maxSize', 'size', 'minSize'] as const) {
    const v = parsePair(el.props.get(prop)?.value);
    if (v && (v[0] > 0 || v[1] > 0)) return { prop, w: v[0], h: v[1] };
  }
  return null;
}

/** A picture's size at a new width, keeping its shape (a 0 stays 0: RetroBat keeps the shape then). */
export function resized(s: { w: number; h: number }, w: number): string {
  const r = (n: number) => fmtNum(Math.round(n * 1000) / 1000);
  if (s.w <= 0) return `0 ${r(w)}`;
  return `${r(w)} ${s.h > 0 ? r((s.h * w) / s.w) : '0'}`;
}

// ---- one-click looks ---------------------------------------------------------------------------

export interface TextLook {
  id: string;
  label: string;
  /** A free font from the catalogue (fonts.ts), downloaded when picked. */
  font: string;
  caps: boolean;
  glow: Glow;
}

export const TEXT_LOOKS: TextLook[] = [
  { id: 'clean', label: 'Clean', font: 'inter', caps: false, glow: 'none' },
  { id: 'bold', label: 'Bold', font: 'bebas', caps: true, glow: 'shadow' },
  { id: 'neon', label: 'Neon', font: 'audiowide', caps: true, glow: 'strong' },
  { id: 'arcade', label: 'Arcade', font: 'pressstart', caps: true, glow: 'shadow' },
];

export interface PictureLook {
  id: string;
  label: string;
  corners: number;
  /** RetroBat's soft shadow distance in pixels, or none. */
  shadow: number | null;
  opacity: number;
}

export const PICTURE_LOOKS: PictureLook[] = [
  { id: 'plain', label: 'Plain', corners: 0, shadow: null, opacity: 1 },
  { id: 'card', label: 'Card', corners: 0.04, shadow: 6, opacity: 1 },
  { id: 'lifted', label: 'Lifted', corners: 0.02, shadow: 14, opacity: 1 },
  { id: 'faded', label: 'Faded', corners: 0, shadow: null, opacity: 0.5 },
];

// ---- animation timing --------------------------------------------------------------------------

export const SPEEDS = [
  { id: 'calm', label: 'Calm', speed: 0.6 },
  { id: 'normal', label: 'Normal', speed: 1 },
  { id: 'quick', label: 'Quick', speed: 1.6 },
] as const;

/** The named speed closest to `speed` (1 = the animation's own). */
export function speedName(speed: number): (typeof SPEEDS)[number]['id'] {
  return SPEEDS.reduce((a, b) => (Math.abs(Math.log(b.speed / speed)) < Math.abs(Math.log(a.speed / speed)) ? b : a)).id;
}

/** When an entrance starts, in milliseconds after the screen shows. */
export const DELAYS = [
  { id: 'now', label: 'Right away', ms: 0 },
  { id: 'later', label: 'A bit later', ms: 300 },
  { id: 'last', label: 'Last', ms: 700 },
] as const;

export function delayName(ms: number): (typeof DELAYS)[number]['id'] {
  return DELAYS.reduce((a, b) => (Math.abs(b.ms - ms) < Math.abs(a.ms - ms) ? b : a)).id;
}

/** A small moving sample for an animation's tile, by what kind of motion it is. */
export function animDemo(id: string): string {
  if (/spin/.test(id)) return 'spin';
  if (/sway|swing$/.test(id)) return 'sway';
  if (/pulse|breathe|slow-zoom/.test(id)) return 'pulse';
  if (/float|hover/.test(id)) return 'bob';
  if (/^drift$/.test(id)) return 'drift';
  if (/slide|follow|drift-in/.test(id)) return 'slide';
  if (/rise|glide|drop/.test(id)) return 'rise';
  if (/pop|zoom/.test(id)) return 'pop';
  if (/swing-in|tilt/.test(id)) return 'tilt';
  return 'fade';
}

// ---- finding a setting -------------------------------------------------------------------------

/** Words people might type to find each card. */
export const CARD_WORDS: Record<string, string> = {
  looks: 'look looks style quick preset neon arcade bold clean card faded',
  text: 'text words say says font size big small caps capital capitals uppercase align alignment left right middle centre center long name fit',
  colour: 'colour color colours colors glow shadow read readable contrast swatch pick eyedropper',
  colours: 'colour color colours colors swatch pick',
  picture: 'picture image file logo swap change video',
  corners: 'corner corners round rounded shadow border frame',
  position: 'position move place layer layers front behind back top order see through transparent opacity snap nudge size width bigger smaller',
  animation: 'animation animate animations motion move moving speed delay start fade slide pop float bounce zoom spin',
  more: 'more other setting settings',
};

/** Whether a card matches what was typed (every word must match). */
export function cardMatches(card: string, query: string, extra = ''): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${CARD_WORDS[card] ?? ''} ${extra}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}
