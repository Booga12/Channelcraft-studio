// Real games from RetroBat's scraped gamelists (roms\<system>\gamelist.xml), so the preview can
// show the user's own box art, screenshots, logos and descriptions.

import { join } from '../path';
import { elements, parse, textOf } from '../xml/cst';

export interface GameInfo {
  /** The game's <path> in the gamelist (its id there). */
  path: string;
  name: string;
  description: string;
  rating: number;
  releasedate: string;
  developer: string;
  publisher: string;
  genre: string;
  players: string;
  playcount: string;
  lastplayed: string;
  /** Total play time in seconds, as RetroBat stores it (MetaData.cpp: gametime). */
  gametime: string;
  favorite: boolean;
  /** Absolute media paths by gamelist tag: image, thumbnail, marquee, video, fanart, boxart, wheel... */
  media: Record<string, string>;
}

const TEXT_TAGS = ['name', 'desc', 'rating', 'releasedate', 'developer', 'publisher', 'genre', 'players', 'playcount', 'lastplayed', 'gametime', 'favorite', 'hidden'];

/** `./x`, `../x`, `~/x` (the gamelist's folder in RetroBat) and absolute paths. */
function mediaPath(systemDir: string, v: string): string {
  if (/^[A-Za-z]:[\\/]|^\\\\/.test(v)) return v;
  return join(systemDir, v.replace(/^~[\\/]/, './'));
}

export function parseGamelist(text: string, systemDir: string): GameInfo[] {
  const doc = parse(text);
  if (!doc.root) return [];
  const out: GameInfo[] = [];
  for (const g of elements(doc.root).filter((e) => e.name === 'game')) {
    const fields: Record<string, string> = {};
    const media: Record<string, string> = {};
    let path = '';
    for (const c of elements(g)) {
      const v = textOf(doc, c).trim();
      if (!v) continue;
      if (c.name === 'path') path = v;
      if (TEXT_TAGS.includes(c.name)) fields[c.name] = v;
      else if (c.name !== 'path' && /^(\.\.?[\\/]|~[\\/]|[A-Za-z]:[\\/]|\\\\)/.test(v) && /\.(png|jpe?g|gif|webp|svg|mp4|mkv|webm|avi)$/i.test(v)) media[c.name] = mediaPath(systemDir, v);
    }
    // RetroBat doesn't show hidden games, so neither does the preview.
    if (!fields.name || fields.hidden === 'true') continue;
    out.push({
      path,
      name: fields.name,
      description: fields.desc ?? '',
      rating: Number(fields.rating ?? 0) || 0,
      releasedate: fields.releasedate ?? '',
      developer: fields.developer ?? '',
      publisher: fields.publisher ?? '',
      genre: fields.genre ?? '',
      players: fields.players ?? '',
      playcount: fields.playcount ?? '',
      lastplayed: fields.lastplayed ?? '',
      gametime: fields.gametime ?? '',
      favorite: fields.favorite === 'true',
      media,
    });
  }
  // Games with artwork first: they make the best preview.
  return out.sort((a, b) => Object.keys(b.media).length - Object.keys(a.media).length);
}

/** Value of `{game:xxx}` for a real game (media keys give absolute paths). */
export function gameBinding(g: GameInfo, key: string): string | number | boolean | undefined {
  const k = key.toLowerCase();
  switch (k) {
    case 'name':
    case 'namenoextra':
    case 'fullnamenotags':
    case 'nameshort':
      return g.name;
    case 'desc':
    case 'description':
      return g.description;
    case 'rating':
      return g.rating;
    case 'stars':
      return Math.round(g.rating * 5);
    case 'releasedate':
      return g.releasedate;
    case 'year':
      return g.releasedate.slice(0, 4);
    case 'developer':
    case 'publisher':
    case 'genre':
    case 'players':
    case 'playcount':
    case 'lastplayed':
    case 'gametime':
      return g[k as 'developer'];
    case 'favorite':
      return g.favorite;
    case 'screenshot':
      return g.media.image ?? '';
    case 'boxart':
      return g.media.boxart ?? g.media.thumbnail ?? '';
  }
  return g.media[k] ?? g.media[key] ?? '';
}
