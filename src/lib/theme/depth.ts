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
  /** Background art zooms slowly behind everything, and decorations drift the other way. */
  parallax: boolean;
  /** Drop shadow under text (RetroBat's glow, moved): which text, its size, offset in pixels and strength. */
  textShadow: { on: 'titles' | 'all'; size: number; offset: number; strength: number } | null;
  /** A shadow panel under each panel so it floats: offset in screen fractions and strength. */
  panelShadow: { dx: number; dy: number; alpha: string } | null;
  /** Mirror reflections under logos standing on a shelf or floor, and under one-row tiles. */
  reflect: number;
  /** How much more the selected grid tile grows. */
  lift: number;
}

export const DEPTHS: DepthLevel[] = [
  { id: 'off', label: 'Off', help: 'Flat: no shadows, the selected logo grows a little.', shadow: null, frameShadow: 6, logoScale: 1.15, bevel: 0, parallax: false, textShadow: null, panelShadow: null, reflect: 0, lift: 1 },
  { id: 'subtle', label: 'Subtle', help: 'Soft shadows under art, titles and panels, a gentle bevel, and logos that lift when selected.', shadow: 5, frameShadow: 14, logoScale: 1.25, bevel: 0.6, parallax: false, textShadow: { on: 'titles', size: 2, offset: 2, strength: 0.55 }, panelShadow: { dx: 0.003, dy: 0.005, alpha: '33' }, reflect: 0, lift: 1 },
  { id: 'strong', label: 'Strong', help: 'Deep shadows under art, text and floating panels, mirror reflections, big lifts, and layers that drift at different distances.', shadow: 9, frameShadow: 24, logoScale: 1.4, bevel: 1, parallax: true, textShadow: { on: 'all', size: 3, offset: 3, strength: 0.7 }, panelShadow: { dx: 0.005, dy: 0.009, alpha: '55' }, reflect: 0.22, lift: 1.06 },
];

export const DEPTH_VAR = 'designDepth';
/** The theme's motion feel (calm, normal, lively), kept with the design colours; RetroBat ignores it. */
export const MOTION_VAR = 'designMotion';

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
/** Decorations drift the other way on Strong. */
export const DRIFT_ANIM = 'drift';
/** Titles that get a shadow already on Subtle. */
export const TITLES = ['ccs_title', 'ccs_systemname', 'logoText', 'ccs_vs'];

/** A RetroBat screen shader over the whole theme, kept with the design colours as `designScreenFx`. */
export const SCREEN_FX_VAR = 'designScreenFx';
export const SCREEN_FX = [
  { id: 'none', label: 'None', help: 'No effect over the screen.', path: '' },
  { id: 'crt', label: 'CRT', help: 'An old tube TV: curved, glowing and lined. RetroBat draws it with its own CRT shader.', path: ':/shaders/crt.glsl' },
  { id: 'scanlines', label: 'Scanlines', help: 'Fine dark lines across the screen, like an arcade monitor.', path: ':/shaders/scanlines.glsl' },
  { id: 'pixelate', label: 'Pixelate', help: 'Everything drawn in chunky pixels.', path: ':/shaders/pixelate.glsl' },
  { id: 'grayscale', label: 'Black and white', help: 'Everything in shades of grey, like an old photo.', path: ':/shaders/grayscale.glsl' },
] as const;
export type ScreenFx = (typeof SCREEN_FX)[number]['id'];
export const screenFxOf = (id: string | null | undefined) => SCREEN_FX.find((f) => f.id === id?.trim()) ?? SCREEN_FX[0];

/** How every animation in a theme moves: size (amount) and speed against each preset's own. */
export const MOTION_FEELS = {
  calm: { label: 'Calm', help: 'Smaller, slower movement. Relaxed and classy.', amount: 0.7, speed: 0.8 },
  normal: { label: 'Normal', help: 'Each animation as designed.', amount: 1, speed: 1 },
  lively: { label: 'Lively', help: 'Bigger, snappier movement. Fun and energetic.', amount: 1.4, speed: 1.25 },
} as const;
