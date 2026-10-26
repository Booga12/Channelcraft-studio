// Which property of an element a dropped library asset sets, or why it doesn't fit.

import { fmtNum, SCHEMA, specFor } from './schema';
import { typeLabel } from '../friendly';
import { extname } from '../path';

const an = (w: string) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);

export type AssetKind = 'image' | 'video' | 'sound' | 'font';

export const ASSET_KIND_LABEL: Record<AssetKind, string> = { image: 'picture', video: 'video', sound: 'sound', font: 'font' };

/** Theme folder each kind is copied into (the same folders Import uses). */
export const ASSET_THEME_DIR: Record<AssetKind, string> = { image: '_inc/images', video: '_inc/videos', sound: '_inc/sounds', font: '_inc/fonts' };

/** File kinds by extension (lower case, with the dot). */
const EXT_KIND: Record<string, AssetKind> = {
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.svg': 'image', '.webp': 'image', '.bmp': 'image',
  '.mp4': 'video', '.m4v': 'video', '.mov': 'video', '.mkv': 'video', '.webm': 'video', '.avi': 'video', '.mpg': 'video', '.mpeg': 'video',
  '.wav': 'sound', '.ogg': 'sound', '.mp3': 'sound', '.flac': 'sound',
  '.ttf': 'font', '.otf': 'font',
};

export function kindOfFile(path: string): AssetKind | null {
  return EXT_KIND[extname(path)] ?? null;
}

export type DropFit = { ok: true; prop: string; note?: string } | { ok: false; hint: string };

/** The asset kind a property takes, from the schema (path → picture). */
export function kindOfProp(type: string, prop: string): AssetKind | null {
  const k = specFor(type, prop).kind;
  return k === 'path' ? 'image' : k === 'video' ? 'video' : k === 'sound' ? 'sound' : k === 'font' ? 'font' : null;
}

/** RetroBat's game elements fill their picture or video in themselves from each game. */
const GAME_MEDIA = /^md_(image|thumbnail|marquee|fanart|video)$/;

/** The element type has this property, of this kind, in the schema. */
const has = (type: string, prop: string, kind: string) => !!SCHEMA[type]?.some((s) => s.name === prop && s.kind === kind);

/**
 * Where an asset of `kind` goes on an element of `type` called `name`: `path` for the matching
 * kind, the fallback picture where the main path is game data, the font or scroll sound for text
 * and lists. `prop` forces one property (a drop on a property row).
 */
export function dropFit(type: string, name: string, kind: AssetKind, prop?: string): DropFit {
  const what = ASSET_KIND_LABEL[kind];
  if (prop) {
    const want = kindOfProp(type, prop);
    if (want === kind) return { ok: true, prop };
    return { ok: false, hint: want ? `This takes ${an(ASSET_KIND_LABEL[want])}, not ${an(what)}.` : `This setting doesn't take a file.` };
  }
  const isMedia = type === 'image' || type === 'video';
  if (isMedia && GAME_MEDIA.test(name)) {
    if (kind === 'image') return { ok: true, prop: 'default', note: 'shown when a game has none of its own' };
    return { ok: false, hint: `RetroBat fills this in with each game's own ${type === 'video' ? 'video' : 'picture'}. Drop a picture to set the one shown when a game has none.` };
  }
  switch (kind) {
    case 'image':
      if (has(type, 'path', 'path')) return { ok: true, prop: 'path' };
      if (type === 'video') return { ok: true, prop: 'default', note: 'shown before and without the video' };
      if (type === 'rating') return { ok: false, hint: 'A rating has two pictures (filled and empty stars). Drop it on one of them in Properties.' };
      if (type === 'textlist') return { ok: true, prop: 'selectorImagePath', note: 'as the selection bar' };
      break;
    case 'video':
      if (type === 'video') return { ok: true, prop: 'path' };
      if (type === 'image') return { ok: false, hint: 'This is a picture element. Drop the video on a video element, or add one from Add.' };
      break;
    case 'sound':
      if (has(type, 'path', 'sound')) return { ok: true, prop: 'path' };
      if (has(type, 'scrollSound', 'sound')) return { ok: true, prop: 'scrollSound', note: 'as the scroll sound' };
      break;
    case 'font':
      if (has(type, 'fontPath', 'font')) return { ok: true, prop: 'fontPath' };
      break;
  }
  const fits: Record<AssetKind, string> = {
    image: 'pictures, frames and video placeholders',
    video: 'video elements',
    sound: 'sounds, game lists and carousels',
    font: 'text, clocks and game lists',
  };
  return { ok: false, hint: `${what[0].toUpperCase()}${what.slice(1)}s can't go on ${an(typeLabel(type).toLowerCase())}. They go on ${fits[kind]}.` };
}

/** How a drop's property is named to the user: "video file" for a video path, else the property. */
export function dropPropLabel(prop: string, kind: AssetKind, propLabel: (p: string) => string): string {
  return prop === 'path' ? `${ASSET_KIND_LABEL[kind]} file` : propLabel(prop).toLowerCase();
}

// ---- adding a file as a new element ----------------------------------------------------------

/** Pictures and videos can become an element of their own; sounds and fonts go on one. */
export function addsAsNew(kind: AssetKind): kind is 'image' | 'video' {
  return kind === 'image' || kind === 'video';
}

/** A layer name from a file name: "My Logo (1).png" → "my_logo_1", else the element type. */
export function nameFromFile(file: string, kind: 'image' | 'video'): string {
  const stem = file.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '');
  const clean = stem.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  return /^[a-z]/.test(clean) ? clean : kind === 'image' ? 'picture' : 'video';
}

/**
 * The inside of a new picture or video element: centred on `at` (0–1 of the screen), fitted in
 * a box that keeps its shape (maxSize), drawn above everything at `z`.
 */
export function newAssetBody(kind: 'image' | 'video', rel: string, at: { x: number; y: number }, z: number): string {
  const box = kind === 'image' ? 0.3 : 0.4;
  const half = box / 2;
  const clamp = (v: number) => Math.min(1 - half, Math.max(half, v));
  const pos = `${fmtNum(Math.round(clamp(at.x) * 1000) / 1000)} ${fmtNum(Math.round(clamp(at.y) * 1000) / 1000)}`;
  const lines = [`<pos>${pos}</pos>`, '<origin>0.5 0.5</origin>', `<maxSize>${box} ${box}</maxSize>`, `<path>${rel.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</path>`];
  if (kind === 'video') lines.push('<delay>0</delay>');
  lines.push(`<zIndex>${fmtNum(z)}</zIndex>`);
  return lines.join('\n');
}
