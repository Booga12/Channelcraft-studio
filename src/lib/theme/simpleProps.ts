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

export type Glow = 'none' | 'soft' | 'strong' | 'shadow';
export const GLOWS: { id: Glow; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'soft', label: 'Soft' },
  { id: 'strong', label: 'Strong' },
  { id: 'shadow', label: 'Shadow' },
];

/** Which glow a text has, from RetroBat's glowColor, glowSize and glowOffset. */
export function glowOf(color: string | undefined, size: string | undefined, offset: string | undefined): Glow {
  const s = parseFloat(size ?? '') || 0;
  const c = (color ?? '').trim();
  const alpha = COLOR_RE.test(c) && c.length === 8 ? parseInt(c.slice(6), 16) : 255;
  if (s <= 0 || alpha === 0) return 'none';
  const off = parsePair(offset);
  if (off && (off[0] !== 0 || off[1] !== 0)) return 'shadow';
  return s <= 3 ? 'soft' : 'strong';
}

/**
 * The properties that give a text this glow. A glow takes the text's own colour (`textHex`,
 * RRGGBB); the shadow is dark and moved down and right. `hasOffset`: the text already has a
 * glowOffset, which then has to go back to 0 0.
 */
export function glowProps(g: Glow, textHex: string, hasOffset: boolean): Record<string, string> {
  const rgb = /^[0-9a-f]{6}/i.test(textHex) ? textHex.slice(0, 6).toUpperCase() : 'FFFFFF';
  const still: Record<string, string> = hasOffset ? { glowOffset: '0 0' } : {};
  switch (g) {
    case 'none':
      return { glowSize: '0', ...still };
    case 'soft':
      return { glowColor: `${rgb}80`, glowSize: '2', ...still };
    case 'strong':
      return { glowColor: `${rgb}CC`, glowSize: '5', ...still };
    case 'shadow':
      return { glowColor: '000000B4', glowSize: '1', glowOffset: '2 2' };
  }
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
