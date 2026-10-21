// Frames for pictures and videos with RetroBat's own border shader (resources/shaders/border.glsl):
//   <shader><path>:/shaders/border.glsl</path><borderSize>3</borderSize><borderColor>FFFFFFCC</borderColor>
//     <cornerRadius>0.04</cornerRadius><outerShadowSize>10</outerShadowSize><outerShadowColor>00000080</outerShadowColor>
//     <saturation>1</saturation></shader>
// What the shader does (read from its source):
// - Sizes below 1 are a share of the element's height, 1 and above are screen pixels.
// - The picture is drawn smaller to make room, inside a rounded border, with a shadow fading out
//   to the element's edge, all within the element's own box.
// - It leaves pictures alone whose top-left or bottom-right corner is see-through (most logos),
//   so frames suit screenshots, videos, box art and fan art.
// - Settings that are left out are reset to 0 by RetroBat, and saturation 0 turns the picture
//   grey, so saturation is always written.
// Rounded corners alone don't need the shader: pictures and videos have `roundCorners`.

import { elements, textOf, type XElement } from '../xml/cst';
import type { PropDef, ResolvedElement } from './resolver';

export const BORDER_SHADER = ':/shaders/border.glsl';
/** Element types that can have a frame or rounded corners. */
export const FRAME_TYPES = new Set(['image', 'video']);

export interface Frame {
  /** Corner radius: below 1 a share of the element's height. */
  corners: number;
  /** Border width in screen pixels (0 = none). */
  border: number;
  borderColor: string;
  /** Shadow size in screen pixels (0 = none). */
  shadow: number;
  shadowColor: string;
}

export const FRAME_DEFAULT: Frame = { corners: 0.04, border: 3, borderColor: 'FFFFFFCC', shadow: 10, shadowColor: '00000080' };

export interface FrameInfo {
  def: PropDef;
  frame: Frame;
}

function child(def: PropDef, el: XElement, name: string): string | undefined {
  const n = elements(el).find((x) => x.name === name);
  return n ? textOf(def.file.doc, n).trim() : undefined;
}

const isBorder = (path: string) => path.replace(/\\/g, '/').toLowerCase().endsWith('shaders/border.glsl');

/** The element's border-shader frame, if it has one. */
export function frameOf(el: ResolvedElement): FrameInfo | null {
  const def = el.complex.findLast((c) => c.name === 'shader');
  if (!def) return null;
  const path = child(def, def.node, 'path') ?? '';
  if (!isBorder(path)) return null;
  const n = (name: string, d = 0) => {
    const v = parseFloat(child(def, def.node, name) ?? '');
    return Number.isFinite(v) ? v : d;
  };
  return {
    def,
    frame: {
      corners: n('cornerRadius'),
      border: n('borderSize'),
      borderColor: child(def, def.node, 'borderColor') ?? '00000000',
      shadow: n('outerShadowSize'),
      shadowColor: child(def, def.node, 'outerShadowColor') ?? '00000000',
    },
  };
}

const r = (v: number) => String(Math.round(v * 10000) / 10000);

/** The shader block for a frame (two-space indented). */
export function frameXml(f: Frame): string {
  return [
    '<shader>',
    `  <path>${BORDER_SHADER}</path>`,
    `  <borderSize>${Math.round(f.border)}</borderSize>`,
    `  <borderColor>${f.borderColor}</borderColor>`,
    `  <cornerRadius>${r(f.corners)}</cornerRadius>`,
    `  <outerShadowSize>${Math.round(f.shadow)}</outerShadowSize>`,
    `  <outerShadowColor>${f.shadowColor}</outerShadowColor>`,
    '  <saturation>1</saturation>',
    '</shader>',
  ].join('\n');
}

/** A size as the shader reads it, in preview pixels: below 1 a share of `boxH`, else 1080p pixels. */
export function shaderPx(v: number, boxH: number, screenH: number): number {
  if (v <= 0) return 0;
  return v < 1 ? v * boxH : (v * screenH) / 1080;
}

/** `roundCorners` in preview pixels: below 1 a share of the larger side, else 1080p pixels. */
export function roundPx(v: number, w: number, h: number, screenH: number): number {
  if (!(v > 0)) return 0;
  return v < 1 ? v * Math.max(w, h) : (v * screenH) / 1080;
}
