// Drop shadows with RetroBat's own shader, the way installed themes write it:
//   <shader><path>:/shaders/shadow.glsl</path><shadowOffset>4</shadowOffset></shader>
// resources/shaders/shadow.glsl draws the picture plus a black copy at half strength, moved by
// `shadowOffset` screen pixels (0 means its default of 6). It also declares `blur`, but never
// uses it, so the distance is the only thing worth offering.

import { elements, textOf, type XElement } from '../xml/cst';
import type { PropDef, ResolvedElement } from './resolver';

export const SHADOW_SHADER = ':/shaders/shadow.glsl';
export const SHADOW_DEFAULT = 6;
/** Element types the shadow is offered for: pictures (the shader shadows the picture's shape). */
export const SHADOW_TYPES = new Set(['image']);

export interface ShaderInfo {
  def: PropDef;
  /** The shadow shader, or another one (blur, grayscale…), which we leave alone. */
  shadow: boolean;
  offset: number;
}

function child(def: PropDef, name: string): XElement | undefined {
  return elements(def.node).find((n) => n.name === name);
}

/** The element's shader block, if it has one. */
export function shaderOf(el: ResolvedElement): ShaderInfo | null {
  const def = el.complex.findLast((c) => c.name === 'shader') ?? (el.props.get('shader') as PropDef | undefined);
  if (!def) return null;
  const pathNode = child(def, 'path');
  const path = (pathNode ? textOf(def.file.doc, pathNode) : def.raw).trim();
  const shadow = path.replace(/\\/g, '/').toLowerCase().endsWith('shaders/shadow.glsl');
  const offNode = child(def, 'shadowOffset');
  const off = offNode ? parseFloat(textOf(def.file.doc, offNode)) : NaN;
  return { def, shadow, offset: Number.isFinite(off) && off !== 0 ? off : SHADOW_DEFAULT };
}

export function shadowXml(offset: number): string {
  return ['<shader>', `  <path>${SHADOW_SHADER}</path>`, `  <shadowOffset>${Math.round(offset)}</shadowOffset>`, '</shader>'].join('\n');
}

/** CSS for the preview: a soft black copy at half strength, `offset` pixels of a 1080-line screen. */
export function shadowCss(offset: number, screenH: number): string {
  const px = (offset * screenH) / 1080;
  return `drop-shadow(${px.toFixed(2)}px ${px.toFixed(2)}px ${Math.max(1, (2 * screenH) / 1080).toFixed(2)}px rgba(0,0,0,0.5))`;
}
