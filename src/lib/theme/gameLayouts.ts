// Layouts of the game list screens. Like system layouts, each one works with every design: the
// design draws its background, panels, colours, fonts and animations, and the layout says where
// things go. On themes not made from a design, a layout only moves RetroBat's own parts (the
// list, picture, description...), so the `plain` placement is used there.

import type { Rect } from './presets';

type Props = Record<string, string>;

/** How a design lays out a game screen. Mirrored layouts flip one of these left to right. */
export type GameArchetype =
  | 'list-right' | 'cinema' | 'cover' | 'centered' | 'list-only'
  | 'showcase' | 'hero' | 'sidebar' | 'tvguide' | 'trading-card' | 'manga-spread' | 'versus' | 'marquee-top' | 'terminal' | 'handheld' | 'scrapbook' | 'magazine-cover';

export interface GameLayout {
  id: string;
  label: string;
  description: string;
  archetype: GameArchetype;
  mirror?: boolean;
  /** For a mirrored layout: the layout it flips (the Presets panel shows one card and a Flip option). */
  flipOf?: string;
  /** Mini picture of the layout, in screen fractions. */
  diagram: Rect[];
  /** Placement on themes without a design, when hand-made (otherwise taken from the design version). */
  plain?: Record<string, Props>;
}

/** Mirrors diagram rectangles left to right. */
const flip = (rs: Rect[]): Rect[] => rs.map((r) => ({ ...r, x: Math.round((1 - r.x - r.w) * 1000) / 1000 }));

const LIST_RIGHT: Rect[] = [
  { x: 0.04, y: 0.04, w: 0.26, h: 0.07, role: 'logo' },
  { x: 0.03, y: 0.14, w: 0.46, h: 0.78, role: 'text' },
  { x: 0.06, y: 0.26, w: 0.17, h: 0.3, role: 'art' },
  { x: 0.26, y: 0.26, w: 0.22, h: 0.3, role: 'art' },
  { x: 0.54, y: 0.16, w: 0.41, h: 0.74, role: 'list' },
];
const CINEMA: Rect[] = [
  { x: 0.05, y: 0.09, w: 0.3, h: 0.12, role: 'logo' },
  { x: 0.05, y: 0.26, w: 0.4, h: 0.06, role: 'text' },
  { x: 0.05, y: 0.46, w: 0.4, h: 0.16, role: 'text' },
  { x: 0.05, y: 0.67, w: 0.2, h: 0.2, role: 'art' },
  { x: 0.29, y: 0.67, w: 0.1, h: 0.2, role: 'art' },
  { x: 0.665, y: 0.16, w: 0.29, h: 0.7, role: 'list' },
];
const COVER: Rect[] = [
  { x: 0.07, y: 0.19, w: 0.3, h: 0.56, role: 'art' },
  { x: 0.41, y: 0.12, w: 0.24, h: 0.8, role: 'text' },
  { x: 0.685, y: 0.14, w: 0.27, h: 0.76, role: 'list' },
];
const CENTERED: Rect[] = [
  { x: 0.37, y: 0.04, w: 0.26, h: 0.07, role: 'logo' },
  { x: 0.12, y: 0.16, w: 0.16, h: 0.36, role: 'art' },
  { x: 0.32, y: 0.16, w: 0.36, h: 0.36, role: 'art' },
  { x: 0.1, y: 0.56, w: 0.8, h: 0.17, role: 'text' },
  { x: 0.27, y: 0.77, w: 0.46, h: 0.15, role: 'list' },
];
const LIST_ONLY: Rect[] = [
  { x: 0.37, y: 0.04, w: 0.26, h: 0.07, role: 'logo' },
  { x: 0.22, y: 0.15, w: 0.56, h: 0.62, role: 'list' },
  { x: 0.08, y: 0.8, w: 0.84, h: 0.12, role: 'text' },
];


const R = (x: number, y: number, w: number, h: number, role: Rect['role']): Rect => ({ x, y, w, h, role });

/** The newer layouts; each also comes flipped left to right. */
const MORE: GameLayout[] = [
  { id: 'showcase', label: 'Showcase', description: 'A big box cover in the middle standing on its reflection, a slim list beside it.', archetype: 'showcase', diagram: [R(0.04, 0.05, 0.22, 0.07, 'logo'), R(0.28, 0.21, 0.28, 0.46, 'art'), R(0.05, 0.32, 0.18, 0.2, 'art'), R(0.08, 0.74, 0.68, 0.06, 'text'), R(0.74, 0.1, 0.23, 0.82, 'list')] },
  { id: 'hero', label: 'Hero banner', description: 'Fan art across the top half with the game logo over it; the list and details below.', archetype: 'hero', diagram: [R(0.05, 0.28, 0.34, 0.14, 'logo'), R(0.05, 0.44, 0.5, 0.06, 'text'), R(0.05, 0.54, 0.42, 0.38, 'list'), R(0.55, 0.63, 0.1, 0.2, 'art'), R(0.71, 0.63, 0.2, 0.2, 'art'), R(0.53, 0.85, 0.43, 0.09, 'text')] },
  { id: 'sidebar', label: 'Sidebar', description: 'A thin list down the left, fan art filling the rest, details in a card at the bottom.', archetype: 'sidebar', diagram: [R(0, 0, 0.3, 1, 'list'), R(0.75, 0.2, 0.2, 0.2, 'art'), R(0.34, 0.62, 0.62, 0.32, 'text'), R(0.365, 0.65, 0.1, 0.26, 'art')] },
  { id: 'tvguide', label: 'TV guide', description: 'The video or screenshot on top like a TV channel, the games as programme rows along the bottom.', archetype: 'tvguide', diagram: [R(0.05, 0.08, 0.5, 0.44, 'art'), R(0.58, 0.1, 0.3, 0.06, 'text'), R(0.58, 0.29, 0.38, 0.25, 'text'), R(0.04, 0.58, 0.92, 0.34, 'list')] },
  { id: 'trading-card', label: 'Trading card', description: 'The cover set at an angle on a card like a collectible, with a stats panel beside it.', archetype: 'trading-card', diagram: [R(0.07, 0.12, 0.32, 0.78, 'logo'), R(0.1, 0.2, 0.26, 0.5, 'art'), R(0.42, 0.12, 0.24, 0.78, 'text'), R(0.69, 0.12, 0.28, 0.8, 'list')] },
  { id: 'manga-spread', label: 'Manga spread', description: 'Slanted panels for the cover, screenshot and story, like a comic page.', archetype: 'manga-spread', diagram: [R(0.04, 0.12, 0.3, 0.56, 'art'), R(0.37, 0.1, 0.3, 0.34, 'art'), R(0.37, 0.48, 0.3, 0.44, 'text'), R(0.7, 0.1, 0.27, 0.82, 'list')] },
  { id: 'versus', label: 'Versus', description: 'A split screen with a diagonal slash: the big cover on one side, stats on the other.', archetype: 'versus', diagram: [R(0.05, 0.18, 0.3, 0.6, 'art'), R(0.42, 0.14, 0.31, 0.06, 'text'), R(0.42, 0.32, 0.31, 0.1, 'text'), R(0.425, 0.46, 0.3, 0.2, 'art'), R(0.76, 0.12, 0.21, 0.8, 'list')] },
  { id: 'marquee-top', label: 'Marquee top', description: 'The game marquee huge across the top like an arcade cabinet, the list in the middle.', archetype: 'marquee-top', diagram: [R(0.25, 0.03, 0.5, 0.18, 'logo'), R(0.3, 0.25, 0.4, 0.64, 'list'), R(0.04, 0.24, 0.22, 0.36, 'art'), R(0.73, 0.25, 0.24, 0.3, 'art'), R(0.73, 0.6, 0.24, 0.3, 'text')] },
  { id: 'terminal', label: 'Terminal', description: 'A wide list like a command prompt, with details as plain lines in a side panel.', archetype: 'terminal', diagram: [R(0.03, 0.12, 0.55, 0.8, 'list'), R(0.61, 0.12, 0.36, 0.8, 'text'), R(0.64, 0.34, 0.12, 0.2, 'art'), R(0.79, 0.34, 0.16, 0.2, 'art')] },
  { id: 'handheld', label: 'Handheld screen', description: 'The list inside a little handheld console with a d-pad and buttons, the cover and details either side.', archetype: 'handheld', diagram: [R(0.22, 0.08, 0.56, 0.86, 'logo'), R(0.27, 0.13, 0.46, 0.5, 'list'), R(0.02, 0.16, 0.18, 0.4, 'art'), R(0.8, 0.18, 0.18, 0.24, 'art'), R(0.8, 0.48, 0.18, 0.42, 'text')] },
  { id: 'scrapbook', label: 'Scrapbook', description: 'The cover, screenshot and title stuck on at playful angles, like stickers in a scrapbook.', archetype: 'scrapbook', diagram: [R(0.09, 0.15, 0.22, 0.42, 'art'), R(0.34, 0.18, 0.24, 0.24, 'art'), R(0.06, 0.66, 0.5, 0.07, 'text'), R(0.06, 0.76, 0.5, 0.17, 'text'), R(0.62, 0.1, 0.35, 0.82, 'list')] },
  { id: 'magazine-cover', label: 'Magazine cover', description: 'A huge title across the top, the box cover as the cover star and the story in a column.', archetype: 'magazine-cover', diagram: [R(0.04, 0.06, 0.6, 0.1, 'text'), R(0.06, 0.25, 0.32, 0.6, 'art'), R(0.41, 0.22, 0.24, 0.46, 'text'), R(0.41, 0.71, 0.24, 0.18, 'art'), R(0.69, 0.14, 0.28, 0.78, 'list')] },
];

export const GAME_LAYOUTS: GameLayout[] = [
  { id: 'classic', label: 'Classic', description: 'Game list on the right; the cover, screenshot and details in a panel on the left.', archetype: 'list-right', diagram: LIST_RIGHT },
  { id: 'mirrored', label: 'Mirrored', description: 'Game list on the left; the cover, screenshot and details on the right.', archetype: 'list-right', mirror: true, flipOf: 'classic', diagram: flip(LIST_RIGHT) },
  { id: 'videofocus', label: 'Cinema', description: 'Fan art fills the screen behind a big title and details; the list sits on the right.', archetype: 'cinema', diagram: CINEMA },
  { id: 'cinema-left', label: 'Cinema, list on the left', description: 'Fan art fills the screen, the list on the left and the title and details on the right.', archetype: 'cinema', mirror: true, flipOf: 'videofocus', diagram: flip(CINEMA) },
  { id: 'cover', label: 'Cover shelf', description: 'A big box cover with a mirror reflection, details in the middle and the list on the right.', archetype: 'cover', diagram: COVER },
  { id: 'cover-left', label: 'Cover shelf, list on the left', description: 'The list on the left, details in the middle and a big reflected cover on the right.', archetype: 'cover', mirror: true, flipOf: 'cover', diagram: flip(COVER) },
  { id: 'bigpicture', label: 'Centre stage', description: 'Cover and screenshot side by side in the middle, details under them and a short list at the bottom.', archetype: 'centered', diagram: CENTERED },
  { id: 'listonly', label: 'Just the list', description: 'A big centred game list, with a slim strip of details along the bottom.', archetype: 'list-only', diagram: LIST_ONLY },
  ...MORE.flatMap((l): GameLayout[] => [l, { ...l, id: `${l.id}-flipped`, label: `${l.label}, flipped`, mirror: true, flipOf: l.id, diagram: flip(l.diagram) }]),
];

/** The flipped version of a layout, or the layout it flips. */
export function flipped(id: string): string | null {
  const l = gameLayout(id);
  if (!l) return null;
  if (l.flipOf) return l.flipOf;
  return GAME_LAYOUTS.find((x) => x.flipOf === id)?.id ?? null;
}

export function gameLayout(id: string | null | undefined): GameLayout | undefined {
  return GAME_LAYOUTS.find((l) => l.id === id);
}

/** The game layout a design comes with. */
export function defaultGameLayout(archetype: GameArchetype): GameLayout {
  return GAME_LAYOUTS.find((l) => l.archetype === archetype && !l.mirror)!;
}
