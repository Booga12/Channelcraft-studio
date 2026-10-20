// What RetroBat's EmulationStation reads from a theme: every element type and its properties,
// taken from its own parser (sElementMap in es-core/src/ThemeData.cpp; the commit is in the JSON).
// Anything else in a theme is skipped by RetroBat ("Unknown property" in es_log.txt), so the
// editor can say so instead of showing a preview RetroBat won't match.

import profile from './retrobat-profile.json';

export const RETROBAT_SOURCE: string = profile.source;
const types = profile.types as Record<string, Record<string, string>>;
const baseClasses = profile.baseClasses as Record<string, string>;

/** Shader elements take any child (their uniforms); menu icons take any icon name. */
const OPEN_TYPES = new Set(['shader', 'screenshader', 'menuShader', 'fadeShader', 'menuIcons']);

export function isKnownType(type: string): boolean {
  return type in types;
}

/** The value kind RetroBat parses a property as (e.g. NORMALIZED_PAIR, COLOR), if it reads it. */
export function propertyKind(type: string, prop: string): string | undefined {
  for (let t: string | undefined = type; t; t = baseClasses[t]) {
    const k = types[t]?.[prop];
    if (k) return k;
  }
  return undefined;
}

/**
 * Whether RetroBat reads `prop` on an element of `type`. Unknown element types return null
 * (nothing to judge). Storyboards, shader children and nested elements are accepted.
 */
export function supportsProperty(type: string, prop: string): boolean | null {
  if (!isKnownType(type)) return null;
  if (OPEN_TYPES.has(type) || prop === 'storyboard' || prop === 'shader' || prop === 'itemTemplate') return true;
  if (propertyKind(type, prop)) return true;
  // A child element (e.g. a <text> inside a <container>).
  return isKnownType(prop);
}
