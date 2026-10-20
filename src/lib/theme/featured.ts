// Matching game video and cover on the system screen.
//
// RetroBat's {random} video and {random:image} pictures each pick a game on their own, so the
// video can be one game and the cover another. A featured game fixes that: one real <game> from
// each console's gamelist supplies both files, which are copied into the theme (named by their
// hash) and shown by per-console blocks: <view name="system" if="${system.theme} == 'snes'">.
// Those blocks live in their own file, _inc/ccs/featured.xml, included at the end of theme.xml.
// The choices are kept in a comment at its top, so a pair survives when the ROM drive is away.

import type { GameInfo } from './games';

export const FEATURED_FILE = '_inc/ccs/featured.xml';
/** Copied media, relative to the theme folder (featured.xml refers to it as ./featured/...). */
export const FEATURED_MEDIA = '_inc/ccs/featured';
export const VIDEO_EL = 'ccs_featured_video';
export const COVER_EL = 'ccs_featured_cover';
const MARK = 'ChannelCraft featured games: ';

/** "auto" picks the first complete game; "none" turns it off; anything else is a game's <path>. */
export type Choice = string;

export interface Pair {
  /** The console's theme id (es_systems <theme>), used in the condition. */
  theme: string;
  /** The game's <path> and name in its gamelist. */
  game: string;
  name: string;
  /** Media files relative to the theme folder. */
  video: string;
  cover: string;
}

export interface FeaturedState {
  choices: Record<string, Choice>;
  /** By system name (ROM folder). */
  pairs: Record<string, Pair>;
}

/** The choices and pairs stored in featured.xml (empty if there is none). */
export function readFeatured(src: string | undefined): FeaturedState {
  const empty: FeaturedState = { choices: {}, pairs: {} };
  if (!src) return empty;
  const i = src.indexOf(MARK);
  if (i < 0) return empty;
  const end = src.indexOf('-->', i);
  try {
    const data = JSON.parse(src.slice(i + MARK.length, end).trim()) as Partial<FeaturedState>;
    return { choices: data.choices ?? {}, pairs: data.pairs ?? {} };
  } catch {
    return empty;
  }
}

const xmlAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const xmlText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** A theme-relative media path as featured.xml (in _inc/ccs/) refers to it. */
const local = (rel: string) => `./${rel.replace(/^_inc\/ccs\//, '')}`;

/** The whole featured.xml for `state`. */
export function featuredXml(state: FeaturedState): string {
  // "--" can't appear in an XML comment; JSON lets it be written as -.
  const json = JSON.stringify(state).replace(/-/g, '\\u002d');
  const lines = ['<theme>', `  <!-- ${MARK}${json} -->`, '  <!-- Made by ChannelCraft Studio: each console shows one real game’s video and cover together. -->'];
  for (const sys of Object.keys(state.pairs).sort()) {
    const p = state.pairs[sys];
    lines.push(
      `  <view name="system" if="${xmlAttr(`\${system.theme} == '${p.theme.replace(/'/g, '')}'`)}">`,
      `    <!-- ${xmlText(p.name).replace(/--/g, '–')} -->`,
      `    <video name="${VIDEO_EL}" extra="true">`,
      `      <path>${xmlText(local(p.video))}</path>`,
      '      <visible>true</visible>',
      '    </video>',
      `    <image name="${COVER_EL}" extra="true">`,
      `      <path>${xmlText(local(p.cover))}</path>`,
      '      <visible>true</visible>',
      '    </image>',
      '  </view>',
    );
  }
  lines.push('</theme>', '');
  return lines.join('\n');
}

/** The cover RetroBat would use first: box art, then thumbnail, then screenshot. */
export function coverOf(g: GameInfo): string | undefined {
  return g.media.boxart ?? g.media.thumbnail ?? g.media.image;
}

/**
 * The game to feature: the chosen one, or (automatic) the first with both a video and a cover
 * that exist on disk. Null when there is none.
 */
export function pickGame(games: GameInfo[], choice: Choice, exists: (path: string) => boolean): { game: GameInfo; video: string; cover: string } | null {
  const candidates = choice === 'auto' ? games : games.filter((g) => g.path === choice);
  for (const game of candidates) {
    const video = game.media.video;
    const cover = [game.media.boxart, game.media.thumbnail, game.media.image].find((c) => c && exists(c));
    if (video && cover && exists(video)) return { game, video, cover };
  }
  return null;
}
