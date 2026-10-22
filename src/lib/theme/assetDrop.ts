// Which property of an element a dropped library asset sets, or why it doesn't fit.

import { SCHEMA, specFor } from './schema';
import { typeLabel } from '../friendly';

const an = (w: string) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);

export type AssetKind = 'image' | 'video' | 'sound' | 'font';

export const ASSET_KIND_LABEL: Record<AssetKind, string> = { image: 'picture', video: 'video', sound: 'sound', font: 'font' };

/** Theme folder each kind is copied into (the same folders Import uses). */
export const ASSET_THEME_DIR: Record<AssetKind, string> = { image: '_inc/images', video: '_inc/videos', sound: '_inc/sounds', font: '_inc/fonts' };

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
