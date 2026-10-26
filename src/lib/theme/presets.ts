// Layout presets rearrange the elements RetroBat itself draws on a screen (game list, game
// picture, description, carousel...). A preset is written as its own <view> block at the end of
// theme.xml, marked with a comment, so it overrides the theme without touching its other files
// and can be swapped for another preset later.

import { attr, elements, patchInsertChild, patchReplaceSpan, type XElement, type XNode } from '../xml/cst';
import { DESIGNS, designElements, designGameLayout, designVars, elementsMarkup, isDesignExtra, type Design, type DesignContext, type DesignEl, type DesignVar, type Palette6 } from './designs';
import type { Change } from './edits';
import { DEPTH_VAR, MOTION_VAR, type Depth } from './depth';
import type { ThemeProject } from './project';
import type { Resolution } from './resolver';
import { SYSTEM_LAYOUTS, systemLayout, type SystemLayout } from './systemLayouts';
import { GAME_LAYOUTS, gameLayout, type GameLayout } from './gameLayouts';
import { screenOf, tuningOf } from './animations';
import { TILE_STYLES, tileStyleOfPath, tileStyleProps } from './tiles';

type Props = Record<string, string>;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  role: 'list' | 'art' | 'text' | 'logo' | 'carousel' | 'info';
}

export interface LayoutPreset {
  id: string;
  label: string;
  description: string;
  kind: 'game' | 'system';
  /** Mini picture of the layout, in screen fractions. */
  diagram: Rect[];
  elements: Record<string, Props>;
  /** Shared artwork (SVG) the preset needs, written to _inc/ccs/common/. */
  assets?: Record<string, string>;
}

export interface Palette {
  id: string;
  label: string;
  colors: Record<string, string>;
}

/** Element types RetroBat uses for its own elements. */
export const NATIVE_TYPES: Record<string, string> = {
  gamelist: 'textlist',
  logo: 'image',
  logoText: 'text',
  md_image: 'image',
  md_thumbnail: 'image',
  md_marquee: 'image',
  md_video: 'video',
  md_description: 'text',
  md_rating: 'rating',
  md_releasedate: 'datetime',
  md_lastplayed: 'datetime',
  md_developer: 'text',
  md_publisher: 'text',
  md_genre: 'text',
  md_players: 'text',
  md_playcount: 'text',
  md_name: 'text',
  systemcarousel: 'carousel',
  systemInfo: 'text',
  imagegrid: 'imagegrid',
  default: 'gridtile',
  selected: 'gridtile',
  gridtile: 'text',
  'gridtile.image': 'image',
  'gridtile.image:selected': 'image',
};

const DETAIL_FIELDS = ['developer', 'publisher', 'genre', 'players', 'lastplayed', 'playcount'];
/** Labels and secondary fields that the presets tidy away; each can be shown again in Layers. */
const TIDY: Record<string, Props> = Object.fromEntries([...DETAIL_FIELDS.map((f) => `md_${f}`), ...[...DETAIL_FIELDS, 'rating', 'releasedate'].map((f) => `md_lbl_${f}`)].map((n) => [n, { visible: 'false' }]));

const HIDE = { visible: 'false' };

function art(pos: string, max: string): Props {
  return { pos, origin: '0.5 0.5', maxSize: max, visible: 'true' };
}

const CLASSIC: Record<string, Props> = {
  logo: { pos: '0.04 0.045', origin: '0 0', maxSize: '0.32 0.09' },
  gamelist: { pos: '0.52 0.13', size: '0.45 0.78' },
  md_image: art('0.26 0.38', '0.42 0.42'),
  md_video: art('0.26 0.38', '0.42 0.42'),
  md_marquee: HIDE,
  md_rating: { pos: '0.04 0.64', size: '0 0.034', visible: 'true' },
  md_releasedate: { pos: '0.2 0.64', fontSize: '0.026', visible: 'true' },
  md_description: { pos: '0.04 0.7', size: '0.44 0.22', fontSize: '0.021', visible: 'true' },
  ...TIDY,
};

/** Mirrors a layout left-right, keeping each element's anchor. */
function mirror(layout: Record<string, Props>): Record<string, Props> {
  const out: Record<string, Props> = {};
  for (const [name, props] of Object.entries(layout)) {
    const p = { ...props };
    if (p.pos) {
      const [x, y] = p.pos.split(' ').map(Number);
      const [ox] = (p.origin ?? '0 0').split(' ').map(Number);
      const w = Number((p.size ?? p.maxSize ?? '0.17 0').split(' ')[0]) || 0.17;
      const left = x - ox * w;
      const nx = 1 - (left + w) + ox * w;
      p.pos = `${round(nx)} ${y}`;
    }
    out[name] = p;
  }
  return out;
}

function round(n: number) {
  return String(Math.round(n * 1000) / 1000);
}

/** White rounded tile, tinted by each grid tile's background colour. */
export const TILE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect x="1" y="1" width="94" height="94" rx="22" fill="#ffffff"/></svg>\n';

/** RetroBat's own game parts, which a layout moves on themes without a design. */
const PLAIN_PARTS = ['logo', 'gamelist', 'md_image', 'md_marquee', 'md_rating', 'md_releasedate', 'md_description', 'md_genre', 'md_developer', 'md_players'];
const PLACEMENT = ['pos', 'size', 'maxSize', 'origin', 'alignment', 'fontSize'];

/** Hand-made placements for themes without a design (RetroBat's own parts only). */
const PLAIN: Record<string, Record<string, Props>> = {
  classic: CLASSIC,
  mirrored: mirror(CLASSIC),
  bigpicture: {
    logo: { pos: '0.04 0.04', origin: '0 0', maxSize: '0.25 0.08' },
    md_image: art('0.5 0.33', '0.7 0.44'),
    md_video: art('0.5 0.33', '0.7 0.44'),
    md_marquee: HIDE,
    gamelist: { pos: '0.04 0.6', size: '0.44 0.34' },
    md_rating: { pos: '0.52 0.6', size: '0 0.034', visible: 'true' },
    md_releasedate: { pos: '0.68 0.6', fontSize: '0.026', visible: 'true' },
    md_description: { pos: '0.52 0.66', size: '0.44 0.26', fontSize: '0.021', visible: 'true' },
    ...TIDY,
  },
  videofocus: {
    logo: { pos: '0.04 0.04', origin: '0 0', maxSize: '0.25 0.08' },
    md_image: art('0.34 0.43', '0.6 0.56'),
    md_video: art('0.34 0.43', '0.6 0.56'),
    md_marquee: HIDE,
    gamelist: { pos: '0.68 0.12', size: '0.29 0.8', fontSize: '0.028' },
    md_rating: { pos: '0.04 0.74', size: '0 0.032', visible: 'true' },
    md_releasedate: { pos: '0.2 0.74', fontSize: '0.024', visible: 'true' },
    md_description: { pos: '0.04 0.8', size: '0.6 0.13', fontSize: '0.02', visible: 'true' },
    ...TIDY,
  },
  listonly: {
    logo: { pos: '0.5 0.05', origin: '0.5 0', maxSize: '0.3 0.09' },
    gamelist: { pos: '0.2 0.16', size: '0.6 0.74', alignment: 'center' },
    md_image: HIDE,
    md_video: HIDE,
    md_marquee: HIDE,
    md_rating: HIDE,
    md_releasedate: HIDE,
    md_description: HIDE,
    ...TIDY,
  },
};

export const LAYOUTS: LayoutPreset[] = [
  ...GAME_LAYOUTS.map(gamePreset),
  ...SYSTEM_LAYOUTS.map(systemPreset),
];


/** A game layout as a plain preset: hand-made, or RetroBat's own parts placed as the design version places them. */
function gamePreset(l: GameLayout): LayoutPreset {
  let placed = PLAIN[l.id];
  if (!placed) {
    const els = designElements(DESIGNS[0], { art: '.', font: null, titleFont: null, logos: null, consoles: null }, 'detailed', undefined, l.id);
    placed = {};
    for (const e of els) {
      if (!PLAIN_PARTS.includes(e.name)) continue;
      const props: Props = {};
      for (const k of PLACEMENT) if (typeof e.props[k] === 'string') props[k] = e.props[k] as string;
      // RetroBat's game list has no visible property; everything else is shown.
      placed[e.name] = e.name === 'gamelist' ? props : { ...props, visible: 'true' };
    }
    if (placed.md_image) placed.md_video = { ...placed.md_image };
    for (const [n, v] of Object.entries(TIDY)) if (!placed[n]) placed[n] = v;
  }
  return { id: l.id, label: l.label, description: l.description, kind: 'game', diagram: l.diagram, elements: placed };
}

/** A plain system layout preset: moves RetroBat's carousel (or grid) and info line, nothing else. */
function systemPreset(l: SystemLayout): LayoutPreset {
  const [infoPos, infoSize, infoAlign] = l.info;
  const systemInfo = { pos: infoPos, size: infoSize, alignment: infoAlign, visible: 'true' };
  return {
    id: l.id,
    label: l.label,
    description: l.description,
    kind: 'system',
    diagram: l.diagram,
    elements: l.grid ? { ...gridElements(l.grid), systemInfo } : { systemcarousel: { ...l.carousel! }, systemInfo },
    assets: l.grid ? { 'tile.svg': TILE_SVG } : undefined,
  };
}

/**
 * Elements for a system grid in the way RetroBat themes write it: an imagegrid, tile styles
 * for normal and selected tiles, logo colours, and the info line.
 */
function gridElements(gridProps: Props): Record<string, Props> {
  return {
    imagegrid: { ...gridProps, autoLayoutSelectedZoom: gridProps.autoLayoutSelectedZoom ?? '1.06', animateSelection: 'true', padding: '0.012 0.012 0.012 0.012', scrollLoop: 'false', scrollbarColor: '00000000', zIndex: '30' },
    default: { backgroundImage: './_inc/ccs/common/tile.svg', backgroundCornerSize: '22 22', backgroundColor: 'FFFFFF22', imageColor: 'FFFFFFFF', padding: '24 24 24 24', selectionMode: 'full', imageSizeMode: 'maxSize' },
    selected: { backgroundImage: './_inc/ccs/common/tile.svg', backgroundCornerSize: '22 22', backgroundColor: 'FFFFFFF2', imageColor: 'FFFFFFFF', padding: '24 24 24 24' },
    gridtile: { visible: 'false', size: '0 0' },
    'gridtile.image': { color: 'FFFFFFAA' },
    'gridtile.image:selected': { color: 'FFFFFFFF' },
  };
}

export const PALETTES: Palette[] = [
  { id: 'midnight', label: 'Midnight', colors: { bgColor: '15171CFF', panelColor: 'FFFFFF14', textColor: 'F2F4F8FF', dimTextColor: 'A0A7B4FF', accentColor: '4C8DFFFF', selectedTextColor: 'FFFFFFFF' } },
  { id: 'daylight', label: 'Daylight', colors: { bgColor: 'EEF1F5FF', panelColor: '0B1F4414', textColor: '1A1D23FF', dimTextColor: '5B6270FF', accentColor: '2563EBFF', selectedTextColor: 'FFFFFFFF' } },
  { id: 'neon', label: 'Neon', colors: { bgColor: '0B0614FF', panelColor: 'FF2BD61A', textColor: 'F6F0FFFF', dimTextColor: 'B79CE8FF', accentColor: 'FF2BD6FF', selectedTextColor: 'FFFFFFFF' } },
  { id: 'retro', label: 'Retro red', colors: { bgColor: '1B0E0EFF', panelColor: 'FFFFFF12', textColor: 'FFF3E8FF', dimTextColor: 'D4B5A3FF', accentColor: 'E2382EFF', selectedTextColor: 'FFFFFFFF' } },
  { id: 'forest', label: 'Forest', colors: { bgColor: '0F1A14FF', panelColor: 'FFFFFF12', textColor: 'EAF5ECFF', dimTextColor: 'A3BFA9FF', accentColor: '3FB56BFF', selectedTextColor: 'FFFFFFFF' } },
  { id: 'pocket', label: 'Pocket green', colors: { bgColor: '0F380FFF', panelColor: '9BBC0F22', textColor: '9BBC0FFF', dimTextColor: '8BAC0FFF', accentColor: '306230FF', selectedTextColor: 'E0F8D0FF' } },
  // Professional
  { id: 'navy', label: 'Navy office', colors: { bgColor: '0E1A2BFF', panelColor: 'FFFFFF12', textColor: 'F3F6FAFF', dimTextColor: '9FB0C6FF', accentColor: '3D8BFFFF', selectedTextColor: 'FFFFFFFF' } },
  { id: 'paper', label: 'Paper', colors: { bgColor: 'F4EEE4FF', panelColor: 'FFFFFFB3', textColor: '1E1A16FF', dimTextColor: '6B5F52FF', accentColor: 'C0392BFF', selectedTextColor: 'FFFFFFFF' } },
  { id: 'gold', label: 'Black and gold', colors: { bgColor: '080706FF', panelColor: 'D4AF3714', textColor: 'F6EBD2FF', dimTextColor: 'B9A57DFF', accentColor: 'D4AF37FF', selectedTextColor: '080706FF' } },
  // Gaming
  { id: 'esports', label: 'Esports red', colors: { bgColor: '0A0C10FF', panelColor: 'FFFFFF12', textColor: 'F4F6F8FF', dimTextColor: '98A2B3FF', accentColor: 'FF3B4EFF', selectedTextColor: 'FFFFFFFF' } },
  { id: 'lava', label: 'Lava', colors: { bgColor: '120405FF', panelColor: 'FF6A0018', textColor: 'FFF1E6FF', dimTextColor: 'D9A38CFF', accentColor: 'FF6A00FF', selectedTextColor: '120405FF' } },
  // Cute
  { id: 'bubblegum', label: 'Bubblegum', colors: { bgColor: 'FFE3F1FF', panelColor: 'FFFFFFE6', textColor: '4A1838FF', dimTextColor: '9A5A80FF', accentColor: 'FF3D9AFF', selectedTextColor: 'FFFFFFFF' } },
  { id: 'lavender', label: 'Lavender', colors: { bgColor: 'F6F0FFFF', panelColor: 'FFFFFFE8', textColor: '3D2C5EFF', dimTextColor: '8C7BAEFF', accentColor: 'A66CFFFF', selectedTextColor: 'FFFFFFFF' } },
  { id: 'sakura', label: 'Sakura', colors: { bgColor: 'FFF4F7FF', panelColor: 'FFFFFFDD', textColor: '4A2731FF', dimTextColor: '9B6B78FF', accentColor: 'E8507AFF', selectedTextColor: 'FFFFFFFF' } },
  // Tech
  { id: 'terminal', label: 'Terminal green', colors: { bgColor: '020604FF', panelColor: '00FF6614', textColor: 'B8FFCFFF', dimTextColor: '4FAF72FF', accentColor: '00FF66FF', selectedTextColor: '020604FF' } },
  { id: 'hologram', label: 'Hologram', colors: { bgColor: '030A14FF', panelColor: '00E5FF14', textColor: 'E6FCFFFF', dimTextColor: '7FB8C8FF', accentColor: '00E5FFFF', selectedTextColor: '030A14FF' } },
  // Anime
  { id: 'shonen', label: 'Shonen orange', colors: { bgColor: '1A0B00FF', panelColor: 'FFFFFF14', textColor: 'FFF6ECFF', dimTextColor: 'E7B98FFF', accentColor: 'FF8A00FF', selectedTextColor: '1A0B00FF' } },
  { id: 'starry', label: 'Starry night', colors: { bgColor: '070B24FF', panelColor: 'FFFFFF14', textColor: 'F1F3FFFF', dimTextColor: 'A3A8D9FF', accentColor: 'FFD66BFF', selectedTextColor: '070B24FF' } },
  // Moods
  { id: 'vaporwave', label: 'Vaporwave', colors: { bgColor: '1B0A33FF', panelColor: 'FFFFFF14', textColor: 'FFF0FBFF', dimTextColor: 'E5A8E0FF', accentColor: 'FF4FD8FF', selectedTextColor: '1B0A33FF' } },
  { id: 'cabin', label: 'Cosy cabin', colors: { bgColor: '3A2416FF', panelColor: '1A0E0799', textColor: 'FFF3E2FF', dimTextColor: 'D9BC9CFF', accentColor: 'FFB45CFF', selectedTextColor: '2A1709FF' } },
  { id: 'haunted', label: 'Haunted', colors: { bgColor: '07070AFF', panelColor: 'FFFFFF10', textColor: 'EDE7E3FF', dimTextColor: '9C8F8AFF', accentColor: 'C1121FFF', selectedTextColor: 'FFFFFFFF' } },
  { id: 'comic', label: 'Comic yellow', colors: { bgColor: 'FFE14DFF', panelColor: 'FFFFFFF0', textColor: '111111FF', dimTextColor: '3A3A3AFF', accentColor: 'E62429FF', selectedTextColor: 'FFFFFFFF' } },
];

export function layoutsFor(view: string): LayoutPreset[] {
  // The grid and game carousel screens are styled by the design itself, with no layouts of their own.
  const kind = view === 'system' ? 'system' : ['menu', 'screen', 'splash', 'grid', 'gamecarousel'].includes(view) ? null : 'game';
  return LAYOUTS.filter((l) => l.kind === kind);
}

/** Mixes two RRGGBB(AA) colours; t = 0 gives a, 1 gives b. Returns RRGGBB. */
function mix(a: string, b: string, t: number): string {
  const ch = (c: string, i: number) => parseInt(c.slice(i, i + 2), 16) || 0;
  return [0, 2, 4].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** A palette as the seven colours designs are drawn with. */
export function paletteColours(palette: Palette): Palette6 {
  const c = palette.colors;
  const bg = c.bgColor ?? '101014FF';
  const accent = c.accentColor ?? 'FFFFFFFF';
  return {
    bg,
    // The second background colour: a little towards the accent, for gradients and floors.
    bg2: `${mix(bg, accent, 0.14)}FF`,
    surface: c.panelColor ?? 'FFFFFF14',
    text: c.textColor ?? 'FFFFFFFF',
    dim: c.dimTextColor ?? 'AAAAAAFF',
    accent,
    accentText: c.selectedTextColor ?? 'FFFFFFFF',
  };
}

/** The design colours (designAccent...) a palette sets in themes made from a design. */
export function paletteDesignVars(palette: Palette): Record<DesignVar, string> {
  return designVars(paletteColours(palette));
}

/** A design theme's colours read back from its variables, to redraw its artwork in them. */
export function coloursFromVars(get: (name: DesignVar) => string | undefined): Palette6 | null {
  const v = (n: DesignVar) => get(n)?.trim();
  const bg = v('designBackground');
  const accent = v('designAccent');
  if (!bg || !accent) return null;
  return { bg, bg2: v('designBackground2') ?? bg, surface: v('designPanel') ?? 'FFFFFF14', text: v('designText') ?? 'FFFFFFFF', dim: v('designDimText') ?? 'AAAAAAFF', accent, accentText: v('designSelectedText') ?? 'FFFFFFFF' };
}

/** Which colours of a palette this theme has variables for (a design theme's count as all). */
export function paletteCoverage(palette: Palette, res: Resolution): number {
  const own = Object.keys(palette.colors).filter((n) => res.vars.has(n)).length;
  return res.vars.has('designAccent') ? Math.max(own, Object.keys(palette.colors).length) : own;
}

const MARK = (view: string) => `ChannelCraft layout preset (${view})`;

/** The preset id last applied to a view, read back from its marker comment. */
export function appliedLayout(project: ThemeProject, view: string): string | null {
  return markerText(project, view)?.match(/\[([\w-]+)\]/)?.[1] ?? null;
}

/**
 * The system layout in use on the system screen, if ChannelCraft wrote it: a plain layout preset,
 * or the layout of a design (the one chosen with it, or the design's own).
 */
export function appliedSystemLayout(project: ThemeProject): string | null {
  const text = markerText(project, 'system');
  if (!text) return null;
  const chosen = text.match(/\[layout:([\w-]+)\]/)?.[1];
  if (chosen) return chosen;
  const id = text.match(/\[([\w-]+)\]/)?.[1] ?? null;
  if (id?.startsWith('design-')) return DESIGNS.find((d) => `design-${d.id}` === id)?.system ?? null;
  return id;
}

/** The game layout in use on a game list screen: chosen with a design, the design's own, or a plain one. */
export function appliedGameLayout(project: ThemeProject, view: string): string | null {
  const text = markerText(project, view);
  if (!text) return null;
  const chosen = text.match(/\[game:([\w-]+)\]/)?.[1];
  if (chosen) return chosen;
  const id = text.match(/\[([\w-]+)\]/)?.[1] ?? null;
  if (id?.startsWith('design-')) {
    const d = DESIGNS.find((x) => `design-${x.id}` === id);
    return d ? designGameLayout(d) : null;
  }
  return gameLayout(id) ? id : null;
}

/** The design on a screen, if one was applied there. */
export function appliedDesign(project: ThemeProject, view: string): Design | null {
  const id = appliedLayout(project, view);
  return id?.startsWith('design-') ? (DESIGNS.find((d) => `design-${d.id}` === id) ?? null) : null;
}

function markerText(project: ThemeProject, view: string): string | null {
  const entry = project.entry;
  if (!entry?.doc.root) return null;
  for (const n of entry.doc.root.children) {
    if (n.kind !== 'comment') continue;
    const text = entry.src.slice(n.start, n.end);
    if (text.includes(MARK(view))) return text;
  }
  return null;
}

/** Changes that write `preset` for each view, replacing an earlier ChannelCraft preset block. */
export function layoutChanges(project: ThemeProject, res: Resolution, preset: LayoutPreset, views: string[]): Change[] {
  const changes: Change[] = [];
  for (const view of views) {
    const resolved = res.views.get(view);
    const body: string[] = [];
    for (const [name, props] of Object.entries(preset.elements)) {
      if (name === 'md_video' && view !== 'video') continue;
      const type = resolved?.elements.get(name)?.type ?? NATIVE_TYPES[name] ?? 'text';
      // Secondary fields are only tidied away if the theme actually shows them.
      if (TIDY[name] && !resolved?.elements.has(name)) continue;
      body.push(`  <${type} name="${name}">`);
      for (const [k, v] of Object.entries(props)) body.push(`    <${k}>${v}</${k}>`);
      body.push(`  </${type}>`);
    }
    changes.push(blockChange(project, res, view, `${preset.label} [${preset.id}]`, body));
  }
  return changes;
}

/**
 * The ChannelCraft block for a view at the end of theme.xml: replaces the existing block (layout
 * preset or design), or adds one. `body` lines are two-space indented children of the view.
 */
export function blockChange(project: ThemeProject, res: Resolution, view: string, title: string, body: string[]): Change {
  const entry = project.entry!;
  const root = entry.doc.root!;
  const tag = res.views.get(view)?.custom ? 'customView' : 'view';
  const markup = [`<!-- ${MARK(view)}: ${title}. Delete this block to undo it. -->`, `<${tag} name="${view}">`, ...body, `</${tag}>`].join('\n');
  const existing = findBlock(root.children, entry.src, view);
  return existing ? { file: entry, patch: patchReplaceSpan(entry.doc, existing.comment, existing.view, markup) } : { file: entry, patch: patchInsertChild(entry.doc, root, markup) };
}

const isShown = (e: { props: Map<string, { value: string }> }) => !['false', '0'].includes((e.props.get('visible')?.value ?? 'true').trim().toLowerCase());

export interface DesignOptions {
  /** Game layout for the game list screens; the design's own when not given. */
  gameLayout?: string | null;
  /** A game layout per screen, where screens differ (taking over from `gameLayout`). */
  gameLayouts?: Record<string, string | null>;
  /**
   * What to keep from the screen's current ChannelCraft block. Always: elements you added and
   * parts you hid. 'layout' (same design, new placement) also keeps colours, fonts and
   * animations you set on its parts, and the grid's tile style.
   */
  carry?: 'layout' | 'design';
}

/** Changes that apply a design to the given views; `hideOwn` hides the theme's own decorations. */
export function designChanges(project: ThemeProject, res: Resolution, design: Design, ctx: DesignContext, views: string[], hideOwn: boolean, systemLayoutId = design.system, opts: DesignOptions = {}): Change[] {
  const out: Change[] = [];
  const layout = systemLayout(systemLayoutId) ?? systemLayout(design.system)!;
  // What the screen's current layout of this design would draw, to tell your own changes from the layout's.
  const before = (view: string) => {
    if (appliedDesign(project, view)?.id !== design.id) return null;
    const old = designElements(design, ctx, view, appliedSystemLayout(project) ?? undefined, appliedGameLayout(project, view));
    return new Map(old.map((e) => [e.name, e.props]));
  };
  for (const view of views) {
    const game = gameLayout(opts.gameLayouts?.[view] ?? opts.gameLayout) ?? gameLayout(designGameLayout(design))!;
    const els = designElements(design, ctx, view, layout.id, game.id);
    if (!els.length) continue;
    const kept = opts.carry ? carryOver(project, res, view, els, opts.carry, (n) => before(view)?.get(n)) : [];
    const names = new Set(els.map((e) => e.name));
    const extras = new Set(els.filter((e) => isDesignExtra(e.name)).map((e) => e.name));
    const body = [...elementsMarkup(els, extras, view), ...kept];
    if (hideOwn) {
      // Only the theme's own parts: ones defined just in ChannelCraft's block are kept or dropped above.
      const block = designBlock(project, view);
      const onlyInBlock = (e: { defs: { file: unknown; node: XElement }[] }) => !!block && e.defs.every((d) => d.file === project.entry && d.node.start >= block.view.start && d.node.end <= block.view.end);
      for (const e of res.views.get(view)?.elements.values() ?? []) {
        if (onlyInBlock(e)) continue;
        if (e.extra && !names.has(e.name) && !isDesignExtra(e.name)) body.push(`  <${e.type} name="${e.name}" extra="${e.extra}">`, '    <visible>false</visible>', `  </${e.type}>`);
        // The theme's own game parts the design doesn't place (e.g. md_image on the video screen,
        // where the design shows md_video) would stay where the theme put them, over the design.
        else if (!e.extra && (e.name.startsWith('md_') || e.name === 'folderpath') && !names.has(e.name) && isShown(e)) body.push(`  <${e.type} name="${e.name}">`, '    <visible>false</visible>', `  </${e.type}>`);
      }
    }
    const title = view === 'system' ? `design ${design.label} [design-${design.id}], layout ${layout.label} [layout:${layout.id}]` : `design ${design.label} [design-${design.id}], game layout ${game.label} [game:${game.id}]`;
    out.push(blockChange(project, res, view, title, body));
  }
  return out;
}

/** Whether ChannelCraft's blocks on these screens hide the theme's own decorations (so a rebuild does too). */
export function hidesOwn(project: ThemeProject, res: Resolution, views: string[]): boolean {
  let own = false;
  for (const view of views) {
    const block = designBlock(project, view);
    if (!block) continue;
    for (const node of elements(block.view)) {
      const r = res.views.get(view)?.elements.get(attr(node, 'name') ?? '');
      const elsewhere = r?.defs.some((d) => d.file !== project.entry || d.node.start < block.view.start || d.node.end > block.view.end);
      if (!elsewhere) continue;
      own = true;
      const kids = elements(node);
      if (kids.length === 1 && kids[0].name === 'visible') return true;
    }
  }
  return !own;
}

/** RetroBat's own element names (a design places these; they're never "yours"). */
const isNativeName = (n: string) => n in NATIVE_TYPES || n.startsWith('md_') || n === 'help' || n === 'logoText';

/** Parts whose animation comes from the depth setting. */
const DEPTH_ANIMATED = ['ccs_fanart', 'ccs_systemart', 'ccs_deco'];

/** Properties of a design part that are look, not placement: kept when only the layout changes. */
const STYLE_KEYS = ['color', 'colorEnd', 'primaryColor', 'secondaryColor', 'selectedColor', 'selectorColor', 'glowColor', 'glowSize', 'textColor', 'iconColor', 'unfilledColor', 'fontPath', 'forceUppercase', 'opacity', 'saturation'];

/**
 * What to keep from a screen's current ChannelCraft block when it's rebuilt: adjusts `els` in place
 * (looks and animations you set, parts you hid, the grid's tile style) and returns the markup of
 * elements you added yourself.
 */
function carryOver(project: ThemeProject, res: Resolution, view: string, els: DesignEl[], mode: 'layout' | 'design', drawn: (name: string) => DesignEl['props'] | undefined = () => undefined): string[] {
  const block = designBlock(project, view);
  const entry = project.entry;
  if (!block || !entry) return [];
  const inBlock = (n: XElement) => n.start >= block.view.start && n.end <= block.view.end;
  const byName = new Map(els.map((e) => [e.name, e]));
  const resolved = res.views.get(view)?.elements;
  const added: string[] = [];
  for (const node of elements(block.view)) {
    const name = attr(node, 'name');
    if (!name) continue;
    const el = byName.get(name);
    const props = new Map(elements(node).map((c) => [c.name, entry.src.slice(c.start, c.end).replace(/^<[^>]+>|<\/[^>]+>$/g, '')]));
    if (el) {
      // Only what you changed: a value the old layout set itself belongs to that layout.
      const own = drawn(name);
      const yours = (k: string, v: string) => !own || String(own[k] ?? '') !== v;
      if (props.get('visible')?.trim() === 'false' && el.props.visible !== 'false' && yours('visible', 'false')) el.props = { ...el.props, visible: 'false' };
      // The scroll sound you picked (Sound panel) stays whatever design comes next.
      const sound = props.get('scrollSound')?.trim();
      if (sound && !sound.includes('<') && yours('scrollSound', sound)) el.props = { ...el.props, scrollSound: sound };
      if (mode !== 'layout') continue;
      // A glow moved by glowOffset is the depth's text shadow, which follows the depth, not the old block.
      const depthGlow = props.has('glowOffset');
      for (const k of STYLE_KEYS) {
        const v = props.get(k);
        if (depthGlow && (k === 'glowColor' || k === 'glowSize')) continue;
        if (v !== undefined && !v.includes('<') && yours(k, v)) el.props = { ...el.props, [k]: v };
      }
      // The background's slow zoom and the decorations' drift belong to the depth too.
      if (DEPTH_ANIMATED.includes(name)) continue;
      const r = resolved?.get(name);
      const t = r ? tuningOf(r, screenOf(view)) : null;
      if (t) Object.assign(el, { anim: t.preset.id, animAmount: t.amount, animSpeed: t.speed });
      // No animation on it now (taken off, or never had one): it stays still.
      else if (!elements(node).some((c) => c.name === 'storyboard')) el.anim = undefined;
      continue;
    }
    // Yours: not one of the design's parts, not RetroBat's own, and only defined in this block.
    const r = resolved?.get(name);
    const elsewhere = r?.defs.some((d) => d.file !== entry || !inBlock(d.node));
    if (name.startsWith('ccs_') || isNativeName(name) || elsewhere) continue;
    added.push(`  ${entry.src.slice(node.start, node.end)}`);
  }
  // The grid keeps the tile style picked for it.
  if (mode === 'layout') {
    const style = TILE_STYLES.find((t) => t.id === tileStyleOfPath(resolved?.get('default')?.props.get('backgroundImage')?.value));
    if (style && byName.has('default')) {
      for (const [n, p] of Object.entries(tileStyleProps(style))) {
        const target = n === 'imagegrid' ? [...byName.values()].find((e) => e.type === 'imagegrid') : byName.get(n);
        if (target) target.props = { ...target.props, ...p };
      }
    }
  }
  return added;
}

const VARS_MARK = 'ChannelCraft design colours';

/**
 * The design's colours as shared variables at the top of theme.xml (a marked block, replaced when
 * another design is applied). The design's parts refer to them, and RetroBat's Color set option
 * can redefine them. A file's variables are read before the rest of it, so placement is free.
 */
export function designVarsChange(project: ThemeProject, design: Design, depth: Depth = design.depth ?? 'subtle', motion?: string | null): Change {
  const entry = project.entry!;
  const root = entry.doc.root!;
  // designArtSet names the colour set whose artwork the menu options use (see menuOptions.ts);
  // designDepth is ChannelCraft's own (RetroBat ignores it), see depth.ts.
  const body = [`  <designArtSet>d-${design.id}</designArtSet>`, `  <${DEPTH_VAR}>${depth}</${DEPTH_VAR}>`, ...(motion ? [`  <${MOTION_VAR}>${motion}</${MOTION_VAR}>`] : []), ...Object.entries(designVars(design.palette)).map(([k, v]) => `  <${k}>${v}</${k}>`)];
  const markup = [`<!-- ${VARS_MARK} (${design.label}). The design's parts use these; change them in the Colours tab. -->`, '<variables>', ...body, '</variables>'].join('\n');
  const kids = root.children;
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i];
    if (n.kind !== 'comment' || !entry.src.slice(n.start, n.end).includes(VARS_MARK)) continue;
    for (let j = i + 1; j < kids.length; j++) {
      const m = kids[j];
      if (m.kind === 'text' && entry.src.slice(m.start, m.end).trim() === '') continue;
      if (m.kind === 'element' && m.name === 'variables') return { file: entry, patch: patchReplaceSpan(entry.doc, n, m, markup) };
      break;
    }
  }
  return { file: entry, patch: patchInsertChild(entry.doc, root, markup, { first: true }) };
}

/** ChannelCraft's design or layout block for a view in theme.xml (its comment and <view>), if any. */
export function designBlock(project: ThemeProject, view: string): { comment: XNode; view: XElement } | null {
  const entry = project.entry;
  return entry?.doc.root ? findBlock(entry.doc.root.children, entry.src, view) : null;
}

function findBlock(children: XNode[], src: string, view: string): { comment: XNode; view: XElement } | null {
  for (let i = 0; i < children.length; i++) {
    const n = children[i];
    if (n.kind !== 'comment' || !src.slice(n.start, n.end).includes(MARK(view))) continue;
    for (let j = i + 1; j < children.length; j++) {
      const m = children[j];
      if (m.kind === 'text' && src.slice(m.start, m.end).trim() === '') continue;
      if (m.kind === 'element' && (m.name === 'view' || m.name === 'customView') && attr(m, 'name') === view) return { comment: n, view: m };
      break;
    }
  }
  return null;
}


// ---- readability ----

const channel = (h: string, i: number) => (parseInt(h.slice(i, i + 2), 16) || 0) / 255;
/** Relative luminance of an RRGGBB colour (WCAG). */
function luminance(h: string): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(channel(h, 0)) + 0.7152 * lin(channel(h, 2)) + 0.0722 * lin(channel(h, 4));
}
/** WCAG contrast ratio between two RRGGBB colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
/** An RRGGBBAA colour laid over an RRGGBB one. */
export function over(top: string, under: string): string {
  const a = top.length >= 8 ? parseInt(top.slice(6, 8), 16) / 255 : 1;
  return mix(under, top.slice(0, 6), a);
}
/**
 * How readable a design's text is: the worse of text on the background and text on a panel.
 * Under 3 is hard to read; `text` is the better of near-black and white for that background.
 */
export function readability(c: Palette6): { ratio: number; ok: boolean; text: string; dim: string } {
  const bg = c.bg.slice(0, 6);
  const panel = over(c.surface, bg);
  const ratio = Math.min(contrast(c.text.slice(0, 6), bg), contrast(c.text.slice(0, 6), panel));
  const text = contrast('111111', bg) >= contrast('FFFFFF', bg) ? '111111' : 'FFFFFF';
  return { ratio: Math.round(ratio * 10) / 10, ok: ratio >= 3, text, dim: mix(text, bg, 0.35) };
}
