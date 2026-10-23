// Layouts of the game list screens. Like system layouts, each one works with every design: the
// design draws its background, panels, colours, fonts and animations, and the layout says where
// things go. On themes not made from a design, a layout only moves RetroBat's own parts (the
// list, picture, description...), so the `plain` placement is used there.

import type { Rect } from './presets';

type Props = Record<string, string>;

/** How a design lays out a game screen. Mirrored layouts flip one of these left to right. */
export type GameArchetype = 'list-right' | 'cinema' | 'cover' | 'centered' | 'list-only';

export interface GameLayout {
  id: string;
  label: string;
  description: string;
  archetype: GameArchetype;
  mirror?: boolean;
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

export const GAME_LAYOUTS: GameLayout[] = [
  { id: 'classic', label: 'Classic', description: 'Game list on the right; the cover, screenshot and details in a panel on the left.', archetype: 'list-right', diagram: LIST_RIGHT },
  { id: 'mirrored', label: 'Mirrored', description: 'Game list on the left; the cover, screenshot and details on the right.', archetype: 'list-right', mirror: true, diagram: flip(LIST_RIGHT) },
  { id: 'videofocus', label: 'Cinema', description: 'Fan art fills the screen behind a big title and details; the list sits on the right.', archetype: 'cinema', diagram: CINEMA },
  { id: 'cinema-left', label: 'Cinema, list on the left', description: 'Fan art fills the screen, the list on the left and the title and details on the right.', archetype: 'cinema', mirror: true, diagram: flip(CINEMA) },
  { id: 'cover', label: 'Cover shelf', description: 'A big box cover with a mirror reflection, details in the middle and the list on the right.', archetype: 'cover', diagram: COVER },
  { id: 'cover-left', label: 'Cover shelf, list on the left', description: 'The list on the left, details in the middle and a big reflected cover on the right.', archetype: 'cover', mirror: true, diagram: flip(COVER) },
  { id: 'bigpicture', label: 'Centre stage', description: 'Cover and screenshot side by side in the middle, details under them and a short list at the bottom.', archetype: 'centered', diagram: CENTERED },
  { id: 'listonly', label: 'Just the list', description: 'A big centred game list, with a slim strip of details along the bottom.', archetype: 'list-only', diagram: LIST_ONLY },
];

export function gameLayout(id: string | null | undefined): GameLayout | undefined {
  return GAME_LAYOUTS.find((l) => l.id === id);
}

/** The game layout a design comes with. */
export function defaultGameLayout(archetype: GameArchetype): GameLayout {
  return GAME_LAYOUTS.find((l) => l.archetype === archetype && !l.mirror)!;
}
