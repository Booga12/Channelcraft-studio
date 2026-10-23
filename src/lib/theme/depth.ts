// Depth for themes made from a design: a 3D feel RetroBat can really draw. It can't turn things
// in 3D, so depth comes from what it does have: its drop-shadow shader under art, the border
// shader's outer shadow round screenshots and videos, a bevel on panels, selected logos that
// lift (grow) more, and on Strong a slow zoom on the background art so it seems to move behind
// the rest (parallax). The level is kept in the design colours block as `designDepth`, which
// RetroBat ignores.

export type Depth = 'off' | 'subtle' | 'strong';

export interface DepthLevel {
  id: Depth;
  label: string;
  help: string;
  /** Drop shadow distance (RetroBat's shadow shader) under art, or null for none. */
  shadow: number | null;
  /** Outer shadow of framed screenshots and videos, in screen pixels. */
  frameShadow: number;
  /** How much the selected carousel logo grows. */
  logoScale: number;
  /** Panels get a light top edge and a darker bottom edge. */
  bevel: number;
  /** Background art zooms slowly behind everything. */
  parallax: boolean;
}

export const DEPTHS: DepthLevel[] = [
  { id: 'off', label: 'Off', help: 'Flat: no shadows, the selected logo grows a little.', shadow: null, frameShadow: 6, logoScale: 1.15, bevel: 0, parallax: false },
  { id: 'subtle', label: 'Subtle', help: 'Soft shadows under art, a gentle bevel on panels, and logos that lift when selected.', shadow: 5, frameShadow: 14, logoScale: 1.25, bevel: 0.6, parallax: false },
  { id: 'strong', label: 'Strong', help: 'Deep shadows, chunky panels, big lifts, and background art that drifts behind everything.', shadow: 9, frameShadow: 24, logoScale: 1.4, bevel: 1, parallax: true },
];

export const DEPTH_VAR = 'designDepth';

export const depthLevel = (id: string | undefined | null): DepthLevel => DEPTHS.find((d) => d.id === id?.trim()) ?? DEPTHS[1];

/** Pictures that get the drop shadow, per screen kind. */
export const SHADOWED: Record<'system' | 'game', string[]> = {
  system: ['ccs_console'],
  game: ['ccs_boxart', 'md_marquee', 'logo'],
};
/** Framed pictures and videos whose outer shadow follows the depth. */
export const FRAMED = ['md_image', 'md_video'];
/** Background art that zooms slowly on Strong. */
export const PARALLAX: Record<'system' | 'game', string> = { system: 'ccs_systemart', game: 'ccs_fanart' };
export const PARALLAX_ANIM = 'slow-zoom';

/** How every animation in a theme moves: size (amount) and speed against each preset's own. */
export const MOTION_FEELS = {
  calm: { label: 'Calm', help: 'Smaller, slower movement. Relaxed and classy.', amount: 0.7, speed: 0.8 },
  normal: { label: 'Normal', help: 'Each animation as designed.', amount: 1, speed: 1 },
  lively: { label: 'Lively', help: 'Bigger, snappier movement. Fun and energetic.', amount: 1.4, speed: 1.25 },
} as const;
