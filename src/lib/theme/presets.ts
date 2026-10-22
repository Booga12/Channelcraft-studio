// Layout presets rearrange the elements RetroBat itself draws on a screen (game list, game
// picture, description, carousel...). A preset is written as its own <view> block at the end of
// theme.xml, marked with a comment, so it overrides the theme without touching its other files
// and can be swapped for another preset later.

import { attr, patchInsertChild, patchReplaceSpan, type XElement, type XNode } from '../xml/cst';
import { DESIGNS, designElements, designVars, elementsMarkup, isDesignExtra, type Design, type DesignContext } from './designs';
import type { Change } from './edits';
import type { ThemeProject } from './project';
import type { Resolution } from './resolver';
import { SYSTEM_LAYOUTS, systemLayout, type SystemLayout } from './systemLayouts';

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

export const LAYOUTS: LayoutPreset[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Game list on the right, picture and description on the left.',
    kind: 'game',
    diagram: [
      { x: 0.04, y: 0.04, w: 0.3, h: 0.08, role: 'logo' },
      { x: 0.05, y: 0.17, w: 0.42, h: 0.42, role: 'art' },
      { x: 0.04, y: 0.7, w: 0.44, h: 0.22, role: 'text' },
      { x: 0.52, y: 0.13, w: 0.45, h: 0.78, role: 'list' },
    ],
    elements: CLASSIC,
  },
  {
    id: 'mirrored',
    label: 'Mirrored',
    description: 'Game list on the left, picture and description on the right.',
    kind: 'game',
    diagram: [
      { x: 0.66, y: 0.04, w: 0.3, h: 0.08, role: 'logo' },
      { x: 0.53, y: 0.17, w: 0.42, h: 0.42, role: 'art' },
      { x: 0.52, y: 0.7, w: 0.44, h: 0.22, role: 'text' },
      { x: 0.03, y: 0.13, w: 0.45, h: 0.78, role: 'list' },
    ],
    elements: mirror(CLASSIC),
  },
  {
    id: 'bigpicture',
    label: 'Big picture',
    description: 'A large picture on top, the list and description underneath.',
    kind: 'game',
    diagram: [
      { x: 0.04, y: 0.04, w: 0.22, h: 0.07, role: 'logo' },
      { x: 0.15, y: 0.11, w: 0.7, h: 0.44, role: 'art' },
      { x: 0.04, y: 0.6, w: 0.44, h: 0.34, role: 'list' },
      { x: 0.52, y: 0.66, w: 0.44, h: 0.26, role: 'text' },
    ],
    elements: {
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
  },
  {
    id: 'videofocus',
    label: 'Video focus',
    description: 'A big video or picture with a narrow list on the right.',
    kind: 'game',
    diagram: [
      { x: 0.04, y: 0.04, w: 0.22, h: 0.07, role: 'logo' },
      { x: 0.04, y: 0.14, w: 0.6, h: 0.56, role: 'art' },
      { x: 0.04, y: 0.8, w: 0.6, h: 0.13, role: 'text' },
      { x: 0.68, y: 0.12, w: 0.29, h: 0.8, role: 'list' },
    ],
    elements: {
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
  },
  {
    id: 'listonly',
    label: 'Just the list',
    description: 'A centred game list and nothing else. Clean and fast.',
    kind: 'game',
    diagram: [
      { x: 0.35, y: 0.04, w: 0.3, h: 0.08, role: 'logo' },
      { x: 0.2, y: 0.16, w: 0.6, h: 0.74, role: 'list' },
    ],
    elements: {
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
  },
  ...SYSTEM_LAYOUTS.map(systemPreset),
];


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
];

export function layoutsFor(view: string): LayoutPreset[] {
  const kind = view === 'system' ? 'system' : ['menu', 'screen', 'splash'].includes(view) ? null : 'game';
  return LAYOUTS.filter((l) => l.kind === kind);
}

/** Which colours of a palette this theme has variables for. */
export function paletteCoverage(palette: Palette, res: Resolution): number {
  return Object.keys(palette.colors).filter((n) => res.vars.has(n)).length;
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

/** Changes that apply a design to the given views; `hideOwn` hides the theme's own decorations. */
export function designChanges(project: ThemeProject, res: Resolution, design: Design, ctx: DesignContext, views: string[], hideOwn: boolean, systemLayoutId = design.system): Change[] {
  const out: Change[] = [];
  const layout = systemLayout(systemLayoutId) ?? systemLayout(design.system)!;
  for (const view of views) {
    const els = designElements(design, ctx, view, layout.id);
    if (!els.length) continue;
    const names = new Set(els.map((e) => e.name));
    const extras = new Set(els.filter((e) => isDesignExtra(e.name)).map((e) => e.name));
    const body = elementsMarkup(els, extras, view);
    if (hideOwn) {
      for (const e of res.views.get(view)?.elements.values() ?? []) {
        if (e.extra && !names.has(e.name) && !isDesignExtra(e.name)) body.push(`  <${e.type} name="${e.name}" extra="${e.extra}">`, '    <visible>false</visible>', `  </${e.type}>`);
        // The theme's own game parts the design doesn't place (e.g. md_image on the video screen,
        // where the design shows md_video) would stay where the theme put them, over the design.
        else if (!e.extra && e.name.startsWith('md_') && !names.has(e.name) && isShown(e)) body.push(`  <${e.type} name="${e.name}">`, '    <visible>false</visible>', `  </${e.type}>`);
      }
    }
    const title = view === 'system' ? `design ${design.label} [design-${design.id}], layout ${layout.label} [layout:${layout.id}]` : `design ${design.label} [design-${design.id}]`;
    out.push(blockChange(project, res, view, title, body));
  }
  return out;
}

const VARS_MARK = 'ChannelCraft design colours';

/**
 * The design's colours as shared variables at the top of theme.xml (a marked block, replaced when
 * another design is applied). The design's parts refer to them, and RetroBat's Color set option
 * can redefine them. A file's variables are read before the rest of it, so placement is free.
 */
export function designVarsChange(project: ThemeProject, design: Design): Change {
  const entry = project.entry!;
  const root = entry.doc.root!;
  // designArtSet names the colour set whose artwork the menu options use (see menuOptions.ts).
  const body = [`  <designArtSet>d-${design.id}</designArtSet>`, ...Object.entries(designVars(design.palette)).map(([k, v]) => `  <${k}>${v}</${k}>`)];
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

