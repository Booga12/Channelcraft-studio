// Every design the pickers show: the ready-made ones, then the ones you saved from your themes
// ("Save as my design"). Saved designs are kept in the app (not in a theme), can be shared as a
// small .ccdesign file, and are a ready-made design with your colours, depth, layouts and fonts.

import { BUILT_IN_DESIGNS, DESIGN_GROUPS as BUILT_IN_GROUPS } from './designCatalog';
import type { Design, DesignGroup, Palette6 } from './designs';
import { DEPTHS, type Depth } from './depth';
import { SYSTEM_LAYOUTS } from './systemLayouts';
import { GAME_LAYOUTS } from './gameLayouts';
import { catalogFont } from './fonts';

/** A design you saved: the ready-made design it started from, and what you changed. */
export interface SavedDesign {
  id: string;
  label: string;
  description?: string;
  /** Id of the ready-made design it is based on (its artwork style, decorations, animations). */
  base: string;
  palette: Palette6;
  depth?: Depth;
  system: string;
  gameLayout: string;
  font: string;
  titleFont?: string;
}

/** What a .ccdesign file holds. */
export interface DesignFile {
  format: 'channelcraft-design';
  version: 1;
  design: SavedDesign;
}

const KEY = 'ccs.myDesigns';
const MINE: { id: DesignGroup; label: string } = { id: 'mine', label: 'My designs' };

export const DESIGNS: Design[] = $state([...BUILT_IN_DESIGNS]);
export const DESIGN_GROUPS: { id: DesignGroup; label: string }[] = $state([...BUILT_IN_GROUPS]);

/** The designs you saved, newest first. */
export const myDesigns: { list: SavedDesign[] } = $state({ list: [] });

const HEX = /^[0-9a-f]{6}([0-9a-f]{2})?$/i;
const PALETTE_KEYS: (keyof Palette6)[] = ['bg', 'bg2', 'surface', 'text', 'dim', 'accent', 'accentText'];

/**
 * A saved design checked field by field, or null when it can't be used. Anything not recognised
 * (a layout or font this version doesn't have) falls back to the base design's own.
 */
export function cleanSavedDesign(x: unknown): SavedDesign | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const base = BUILT_IN_DESIGNS.find((d) => d.id === o.base);
  const id = str(o.id, 60).toLowerCase();
  const label = str(o.label, 40);
  if (!base || !/^my-[a-z0-9-]+$/.test(id) || !label) return null;
  const p = (o.palette ?? {}) as Record<string, unknown>;
  const palette = {} as Palette6;
  for (const k of PALETTE_KEYS) {
    const v = str(p[k], 8).replace(/^#/, '');
    palette[k] = HEX.test(v) ? v.toUpperCase() : base.palette[k];
  }
  const depth = DEPTHS.find((d) => d.id === o.depth)?.id;
  const system = SYSTEM_LAYOUTS.some((l) => l.id === o.system) ? (o.system as string) : base.system;
  const gameLayout = GAME_LAYOUTS.some((l) => l.id === o.gameLayout) ? (o.gameLayout as string) : undefined;
  const font = catalogFont(str(o.font, 40)) ? str(o.font, 40) : base.font;
  const titleFont = catalogFont(str(o.titleFont, 40)) ? str(o.titleFont, 40) : base.titleFont;
  return { id, label, description: str(o.description) || undefined, base: base.id, palette, depth: depth ?? base.depth, system, gameLayout: gameLayout ?? '', font, titleFont };
}

/** The saved design as a design the pickers and the editor use. */
export function savedToDesign(s: SavedDesign): Design {
  const base = BUILT_IN_DESIGNS.find((d) => d.id === s.base) ?? BUILT_IN_DESIGNS[0];
  // The base's second accent and decoration colours only fit while its accent is kept.
  const sameAccent = s.palette.accent.slice(0, 6).toUpperCase() === base.palette.accent.slice(0, 6).toUpperCase();
  return {
    ...base,
    id: s.id,
    label: s.label,
    description: s.description || `Your design, made from ${base.label}.`,
    group: 'mine',
    tags: [...base.tags, 'mine'],
    palette: { ...s.palette },
    accent2: sameAccent ? base.accent2 : undefined,
    decoColors: sameAccent ? base.decoColors : undefined,
    depth: s.depth ?? base.depth,
    system: s.system,
    gameLayout: s.gameLayout || undefined,
    font: s.font,
    titleFont: s.titleFont,
  };
}

/** Puts the saved designs into the pickers, first, in their own "My designs" group. */
function refresh() {
  const mine = myDesigns.list.map(savedToDesign);
  DESIGNS.splice(0, DESIGNS.length, ...mine, ...BUILT_IN_DESIGNS);
  DESIGN_GROUPS.splice(0, DESIGN_GROUPS.length, ...(mine.length ? [MINE] : []), ...BUILT_IN_GROUPS);
}

function store() {
  try {
    localStorage.setItem(KEY, JSON.stringify(myDesigns.list));
  } catch {
    // Not kept (private window or no storage); still there until the app closes.
  }
}

/** Reads the saved designs (at start). */
export function loadMyDesigns() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    myDesigns.list = (Array.isArray(raw) ? raw : []).map(cleanSavedDesign).filter((d): d is SavedDesign => !!d);
  } catch {
    myDesigns.list = [];
  }
  refresh();
}

/** A new id for a saved design, from its name: my-cosy-arcade-3f9a. */
export function newDesignId(label: string): string {
  const slug = label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'design';
  let id: string;
  do id = `my-${slug}-${Math.random().toString(16).slice(2, 6)}`;
  while (DESIGNS.some((d) => d.id === id));
  return id;
}

/** Adds a saved design, or replaces the one with the same id; the design as the pickers show it. */
export function putMyDesign(s: SavedDesign): Design {
  myDesigns.list = [s, ...myDesigns.list.filter((d) => d.id !== s.id)];
  store();
  refresh();
  return DESIGNS.find((d) => d.id === s.id)!;
}

export function removeMyDesign(id: string) {
  myDesigns.list = myDesigns.list.filter((d) => d.id !== id);
  store();
  refresh();
}

export function renameMyDesign(id: string, label: string) {
  const s = myDesigns.list.find((d) => d.id === id);
  const name = label.trim().slice(0, 40);
  if (!s || !name) return;
  putMyDesign({ ...s, label: name });
}

/** The text of a .ccdesign file for sharing a saved design. */
export function designFileText(s: SavedDesign): string {
  const file: DesignFile = { format: 'channelcraft-design', version: 1, design: $state.snapshot(s) as SavedDesign };
  return JSON.stringify(file, null, 2);
}

/**
 * The saved design in a .ccdesign file, or an error to show. A design with the same id as one
 * you have gets a new id, so importing never overwrites your own.
 */
export function readDesignFile(text: string): SavedDesign | string {
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch {
    return 'This isn’t a ChannelCraft design file.';
  }
  const f = o as Partial<DesignFile>;
  if (f?.format !== 'channelcraft-design') return 'This isn’t a ChannelCraft design file.';
  if (typeof f.version !== 'number' || f.version > 1) return 'This design was made with a newer ChannelCraft Studio. Update the app to open it.';
  const s = cleanSavedDesign(f.design);
  if (!s) return 'This design file is damaged or made from a design this version doesn’t have.';
  return DESIGNS.some((d) => d.id === s.id) ? { ...s, id: newDesignId(s.label) } : s;
}

loadMyDesigns();
