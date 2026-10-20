// Layout presets rearrange the elements RetroBat itself draws on a screen (game list, game
// picture, description, carousel...). A preset is written as its own <view> block at the end of
// theme.xml, marked with a comment, so it overrides the theme without touching its other files
// and can be swapped for another preset later.

import { attr, patchInsertChild, patchReplaceSpan, type XNode } from '../xml/cst';
import { designElements, elementsMarkup, isDesignExtra, type Design, type DesignContext } from './designs';
import type { Change } from './edits';
import type { ThemeProject } from './project';
import type { Resolution } from './resolver';

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
  {
    id: 'carousel-middle',
    label: 'Carousel in the middle',
    description: 'A row of console logos across the middle of the screen.',
    kind: 'system',
    diagram: [
      { x: 0, y: 0.38, w: 1, h: 0.24, role: 'carousel' },
      { x: 0.3, y: 0.65, w: 0.4, h: 0.05, role: 'info' },
    ],
    elements: {
      systemcarousel: { type: 'horizontal', pos: '0 0.38', size: '1 0.24', logoSize: '0.24 0.16', maxLogoCount: '3' },
      systemInfo: { pos: '0 0.64', size: '1 0.05', alignment: 'center' },
    },
  },
  {
    id: 'wheel-right',
    label: 'Wheel on the right',
    description: 'Console logos on a wheel down the right side, like an arcade cabinet.',
    kind: 'system',
    diagram: [
      { x: 0.6, y: 0, w: 0.4, h: 1, role: 'carousel' },
      { x: 0.04, y: 0.88, w: 0.4, h: 0.05, role: 'info' },
    ],
    elements: {
      systemcarousel: { type: 'vertical_wheel', pos: '0.6 0', size: '0.4 1', logoSize: '0.3 0.13', maxLogoCount: '5' },
      systemInfo: { pos: '0.04 0.88', size: '0.5 0.05', alignment: 'left' },
    },
  },
  {
    id: 'carousel-bottom',
    label: 'Carousel at the bottom',
    description: 'Small logos along the bottom, leaving room for artwork above.',
    kind: 'system',
    diagram: [
      { x: 0, y: 0.7, w: 1, h: 0.22, role: 'carousel' },
      { x: 0.3, y: 0.93, w: 0.4, h: 0.04, role: 'info' },
    ],
    elements: {
      systemcarousel: { type: 'horizontal', pos: '0 0.7', size: '1 0.22', logoSize: '0.18 0.12', maxLogoCount: '5' },
      systemInfo: { pos: '0 0.93', size: '1 0.04', alignment: 'center' },
    },
  },
  {
    id: 'list-left',
    label: 'Logo list on the left',
    description: 'A vertical list of console logos down the left side.',
    kind: 'system',
    diagram: [
      { x: 0, y: 0, w: 0.34, h: 1, role: 'carousel' },
      { x: 0.4, y: 0.9, w: 0.5, h: 0.05, role: 'info' },
    ],
    elements: {
      systemcarousel: { type: 'vertical', pos: '0 0', size: '0.34 1', logoSize: '0.26 0.1', maxLogoCount: '7' },
      systemInfo: { pos: '0.4 0.9', size: '0.55 0.05', alignment: 'left' },
    },
  },
];

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
  const entry = project.entry;
  if (!entry?.doc.root) return null;
  for (const n of entry.doc.root.children) {
    if (n.kind !== 'comment') continue;
    const text = entry.src.slice(n.start, n.end);
    if (text.includes(MARK(view))) return text.match(/\[([\w-]+)\]/)?.[1] ?? null;
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

/** Changes that apply a design to the given views; `hideOwn` hides the theme's own decorations. */
export function designChanges(project: ThemeProject, res: Resolution, design: Design, ctx: DesignContext, views: string[], hideOwn: boolean): Change[] {
  const out: Change[] = [];
  for (const view of views) {
    const els = designElements(design, ctx, view);
    if (!els.length) continue;
    const names = new Set(els.map((e) => e.name));
    const extras = new Set(els.filter((e) => isDesignExtra(e.name)).map((e) => e.name));
    const body = elementsMarkup(els, extras);
    if (hideOwn) {
      for (const e of res.views.get(view)?.elements.values() ?? []) {
        if (e.extra && !names.has(e.name) && !isDesignExtra(e.name)) body.push(`  <${e.type} name="${e.name}" extra="${e.extra}">`, '    <visible>false</visible>', `  </${e.type}>`);
      }
    }
    out.push(blockChange(project, res, view, `design ${design.label} [design-${design.id}]`, body));
  }
  return out;
}

function findBlock(children: XNode[], src: string, view: string) {
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

