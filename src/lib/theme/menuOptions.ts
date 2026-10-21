// RetroBat's Theme Configuration menu lists a theme's options (<subset> blocks). This writes a
// ChannelCraft theme's choices as such options, so they can be switched in RetroBat itself:
//
//   System view style  subset "systemview"   one console-screen layout per choice
//   Gamelist view style subset "gamelistview" one design per choice (RetroBat: per console too)
//   Color set          subset "colorset"     a palette per choice, recolouring the designs
//   Motion             subset "motion"       On, or Off (empty storyboards remove animations)
//
// Files, all in _inc/ccs/:
//   options.xml                the subsets (and a JSON record of the choices, in a comment)
//   options/system-<id>.xml    a console-screen layout      (views: system)
//   options/games-<id>.xml     a design's game screens       (views: basic, detailed, video)
//   options/colors-<key>.xml   a palette's shared colours    (variables only)
//   options/motion-*.xml       motion on / off
//   art/<design>-<key>/        a design's artwork in a palette's colours
//
// Designs refer to their colours as variables (designText, ...), and to their artwork as
// ../art/<design>-${designArtSet}/, so a colour set swaps both. RetroBat reads a file's
// variables first, and the colour set is included near the top of theme.xml, before the
// options include, so every element sees the chosen colours.
//
// The layout and design the theme has now move into their option files exactly as they are,
// edits included; only paths are adjusted to the new folder and fixed design colours become the
// shared ones. Parts the user added (extras that aren't ChannelCraft's) stay in theme.xml, so
// every style shows them.

import { attr, elements, patchInsertChild, patchRemoveNode, patchReplaceSpan, type XElement } from '../xml/cst';
import { ANIMATIONS, presetEvents, screenOf } from './animations';
import { DESIGNS, designElements, designVars, elementsMarkup, isDesignExtra, type Design, type DesignContext, type Palette6 } from './designs';
import type { Change } from './edits';
import { PALETTES, designBlock, designVarsChange } from './presets';
import type { ThemeProject } from './project';
import type { Resolution } from './resolver';
import { SYSTEM_LAYOUTS, systemLayout } from './systemLayouts';

export const OPTIONS_FILE = '_inc/ccs/options.xml';
const DIR = '_inc/ccs/options';
const ART = '_inc/ccs/art';
const GAME_VIEWS = ['basic', 'detailed', 'video'];
const MARK = 'ChannelCraft RetroBat menu options';
const OWN_MARK = 'ChannelCraft: your own parts';

export interface MenuChoices {
  /** System layout ids, the first is RetroBat's default. */
  systemViews: string[];
  /** Design ids for the game screens, the first is the default. */
  gameDesigns: string[];
  /** Colour set keys: `d-<design>` (a design's own colours) or `p-<palette>`; the first is the default. */
  colorSets: string[];
  motion: boolean;
}

export interface MenuState extends MenuChoices {
  version: 1;
  /** The design whose screens the theme had when options were first made. */
  design: string;
}

// ---- colour sets ---------------------------------------------------------------------------

function mix(a: string, b: string, t: number): string {
  const ch = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  return [0, 2, 4].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export interface ColorSet {
  key: string;
  label: string;
  palette: Palette6;
}

/** Every colour set offered: each design's own colours, then the general palettes. */
export function colorSets(): ColorSet[] {
  const fromDesigns = DESIGNS.map((d) => ({ key: `d-${d.id}`, label: `${d.label} colours`, palette: d.palette }));
  const fromPalettes = PALETTES.map((p) => {
    const c = p.colors;
    const bg = c.bgColor.slice(0, 6);
    const text = c.textColor.slice(0, 6);
    return { key: `p-${p.id}`, label: p.label, palette: { bg, bg2: mix(bg, text, 0.08), surface: c.panelColor, text, dim: c.dimTextColor.slice(0, 6), accent: c.accentColor.slice(0, 6), accentText: c.selectedTextColor.slice(0, 6) } };
  });
  return [...fromDesigns, ...fromPalettes];
}

export function colorSet(key: string): ColorSet | undefined {
  return colorSets().find((c) => c.key === key);
}

/**
 * The starter theme's own colour names (and the palettes'), for the ones this theme has, so the
 * theme's own parts follow a colour set too and none is left undefined.
 */
function starterVars(p: Palette6, res: Resolution): Record<string, string> {
  const ff = (c: string) => (c.length === 6 ? `${c}FF` : c);
  const all: Record<string, string> = { bgColor: ff(p.bg), panelColor: ff(p.surface), textColor: ff(p.text), dimTextColor: ff(p.dim), accentColor: ff(p.accent), selectedTextColor: ff(p.accentText) };
  return Object.fromEntries(Object.entries(all).filter(([k]) => res.vars.has(k)));
}

// ---- reading -------------------------------------------------------------------------------

export function readMenuState(project: ThemeProject): MenuState | null {
  const src = project.fileAt(OPTIONS_FILE)?.src;
  const m = src?.match(/<!--\s*channelcraft-menu-options\s*([\s\S]*?)-->/);
  if (!m) return null;
  try {
    const s = JSON.parse(m[1].replace(/\\u002d/g, '-')) as MenuState;
    return s.version === 1 ? s : null;
  } catch {
    return null;
  }
}

// ---- paths ---------------------------------------------------------------------------------

/** Relative path from folder `from` to `to` (both theme-relative, forward slashes). */
function relPath(from: string, to: string): string {
  const a = from.split('/').filter(Boolean);
  const b = to.split('/').filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i].toLowerCase() === b[i].toLowerCase()) i++;
  return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/') || '.';
}

/** Theme-relative form of a path written in a file of folder `dir` (`./x`, `../x`). */
function fromDir(dir: string, p: string): string {
  const out = dir.split('/').filter(Boolean);
  for (const part of p.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/** Moves the relative paths in markup written for theme.xml so they work from `_inc/ccs/options/`. */
function rebase(markup: string, design: string | null): string {
  return markup.replace(/(^|[>\s,(])(\.{1,2}\/[^\s,()<>"']*)/g, (_m, pre: string, p: string) => {
    const rel = fromDir('', p);
    // The design's own artwork moves to its colour-set folder.
    if (design && rel.toLowerCase().startsWith(`_inc/ccs/${design}/`)) return `${pre}../art/${design}-\${designArtSet}/${rel.slice(`_inc/ccs/${design}/`.length)}`;
    const r = relPath(DIR, rel);
    return `${pre}${r.startsWith('.') ? r : `./${r}`}`;
  });
}

/** Fixed colours that are exactly a design colour become that shared colour. */
function linkColours(markup: string, d: Design): string {
  const vars = designVars(d.palette);
  const byValue = new Map<string, string[]>();
  for (const [k, v] of Object.entries(vars)) byValue.set(v.toUpperCase(), [...(byValue.get(v.toUpperCase()) ?? []), k]);
  // When two design colours have the same value, the property's role decides.
  const prefer: Record<string, string> = { primaryColor: 'designText', selectedColor: 'designSelectedText', selectorColor: 'designAccent', secondaryColor: 'designAccent', unfilledColor: 'designRatingOff', textColor: 'designDimText', iconColor: 'designDimText', glowColor: 'designGlow' };
  return markup.replace(/<(\w*[cC]olor\w*)>([0-9A-Fa-f]{8})<\/\1>/g, (m, prop: string, value: string) => {
    const names = byValue.get(value.toUpperCase());
    if (!names) return m;
    const name = names.includes(prefer[prop]) ? prefer[prop] : names[0];
    return `<${prop}>\${${name}}</${prop}>`;
  });
}

// ---- building ------------------------------------------------------------------------------

export interface MenuPlan {
  /** Whole files to write (theme-relative path → XML). Existing option files that stay are left out. */
  files: Record<string, string>;
  /** Artwork folders needed: design × colour set. */
  art: { dir: string; design: Design; palette: Palette6 }[];
  /** Fonts each design needs (catalog ids). */
  fonts: string[];
  /** Changes to theme.xml (and option files that already exist). */
  changes: (project: ThemeProject) => Change[];
}

export interface FontPaths {
  /** Theme-relative font file per catalog font id, once downloaded. */
  [id: string]: string | null;
}

function contextFor(project: ThemeProject, d: Design, fonts: FontPaths): DesignContext {
  const has = (dir: string) => project.assets.some((a) => a.rel.toLowerCase().startsWith(`${dir}/`));
  const f = (id: string | undefined) => (id && fonts[id] ? relPath(DIR, fonts[id]!) : null);
  return {
    vars: true,
    art: `../art/${d.id}-\${designArtSet}`,
    font: f(d.font),
    titleFont: f(d.titleFont),
    logos: has('_inc/systems/logos') ? relPath(DIR, '_inc/systems/logos') : null,
    consoles: has('_inc/systems/consoles') ? relPath(DIR, '_inc/systems/consoles') : null,
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function themeFile(comment: string, body: string[]): string {
  return [`<!-- ${comment} -->`, '<theme>', ...body.map((l) => `  ${l}`), '</theme>', ''].join('\n');
}

/** Splits the current design block of a view into the design's part and the user's own parts. */
function splitBlock(project: ThemeProject, view: string): { design: string[]; own: string[] } | null {
  const b = designBlock(project, view);
  if (!b) return null;
  const src = project.entry!.src;
  const design: string[] = [];
  const own: string[] = [];
  for (const el of elements(b.view)) {
    const raw = src.slice(el.start, el.end);
    // Continuation lines are indented for theme.xml; make them relative to the element.
    const ls = src.lastIndexOf('\n', el.start - 1) + 1;
    const indent = src.slice(ls, el.start);
    const lines = raw.split(/\r?\n/).map((l, i) => (i > 0 && l.startsWith(indent) ? l.slice(indent.length) : l));
    const kids = elements(el);
    const hideOnly = kids.length === 1 && kids[0].name === 'visible' && /false/i.test(src.slice(kids[0].openEnd, kids[0].closeStart));
    const mine = attr(el, 'extra') !== undefined && !isDesignExtra(attr(el, 'name') ?? '') && !hideOnly;
    (mine ? own : design).push(...lines);
  }
  return { design, own };
}

function storyboardsOff(project: ThemeProject, res: Resolution, generated: Map<string, Set<string>>): string[] {
  // Every element with an animation, on each screen, in the theme now or in an option file.
  const out: string[] = [];
  for (const view of ['system', ...GAME_VIEWS]) {
    const found = new Map<string, { type: string; events: Set<string> }>();
    for (const el of res.views.get(view)?.elements.values() ?? []) {
      for (const c of el.complex.filter((x) => x.name === 'storyboard')) {
        const e = found.get(el.name) ?? { type: el.type, events: new Set<string>() };
        e.events.add(attr(c.node, 'event') ?? '');
        found.set(el.name, e);
      }
    }
    for (const key of generated.get(view) ?? []) {
      const [type, name, event] = key.split('|');
      const e = found.get(name) ?? { type, events: new Set<string>() };
      e.events.add(event);
      found.set(name, e);
    }
    if (!found.size) continue;
    out.push(`<view name="${view}">`);
    for (const [name, e] of found) {
      out.push(`  <${e.type} name="${name}">`);
      for (const ev of e.events) out.push(ev ? `    <storyboard event="${esc(ev)}" />` : '    <storyboard />');
      out.push(`  </${e.type}>`);
    }
    out.push('</view>');
  }
  return out;
}

/**
 * Everything needed to give the theme these RetroBat menu options. `design` is the design the
 * theme's screens have now (ChannelCraft's), `systemLayoutNow` the console-screen layout.
 */
export function planMenuOptions(project: ThemeProject, res: Resolution, choices: MenuChoices, design: Design, systemLayoutNow: string, fonts: FontPaths): MenuPlan {
  const prev = readMenuState(project);
  // An empty file (left by an older version after an undo) counts as missing, so it is made again.
  const exists = (rel: string) => !!project.fileAt(rel)?.src.trim();
  const files: Record<string, string> = {};
  const generatedAnims = new Map<string, Set<string>>();
  const noteAnims = (view: string, els: { type: string; name: string; anim?: string }[]) => {
    const set = generatedAnims.get(view) ?? new Set<string>();
    for (const e of els) {
      const p = e.anim ? ANIMATIONS.find((a) => a.id === e.anim) : undefined;
      if (p) for (const ev of presetEvents(p, screenOf(view))) set.add(`${e.type}|${e.name}|${ev}`);
    }
    generatedAnims.set(view, set);
  };
  const hides = (view: string) => {
    // The theme's own extras the current design hides stay hidden in every style.
    const b = designBlock(project, view);
    if (!b) return [];
    const out: string[] = [];
    for (const el of elements(b.view)) {
      const kids = elements(el);
      if (attr(el, 'extra') !== undefined && kids.length === 1 && kids[0].name === 'visible') out.push(`  <${el.name} name="${esc(attr(el, 'name') ?? '')}" extra="true">`, '    <visible>false</visible>', `  </${el.name}>`);
    }
    return out;
  };

  // System view styles: the current layout as it is, the others built fresh.
  const systemViews = choices.systemViews.length ? choices.systemViews : [systemLayoutNow];
  const systemHides = hides('system');
  for (const id of systemViews) {
    const rel = `${DIR}/system-${id}.xml`;
    const layout = systemLayout(id);
    if (!layout) continue;
    if (exists(rel)) continue;
    const now = id === systemLayoutNow && !prev ? splitBlock(project, 'system') : null;
    const body = now
      ? ['<view name="system">', ...linkColours(rebase(now.design.join('\n'), design.id), design).split('\n').map((l) => `  ${l}`), '</view>']
      : (() => {
          const els = designElements(design, contextFor(project, design, fonts), 'system', id);
          noteAnims('system', els);
          const extras = new Set(els.filter((e) => isDesignExtra(e.name)).map((e) => e.name));
          return ['<view name="system">', ...elementsMarkup(els, extras, 'system'), ...systemHides, '</view>'];
        })();
    files[rel] = themeFile(`ChannelCraft: console screen "${layout.label}" in the ${design.label} style. Picked in RetroBat under System view style.`, body);
  }

  // Gamelist view styles: one design each for the three game screens.
  const gameDesigns = choices.gameDesigns.length ? choices.gameDesigns : [design.id];
  const gameHides = new Map(GAME_VIEWS.map((v) => [v, hides(v)]));
  const fontIds = new Set<string>();
  for (const id of gameDesigns) {
    const d = DESIGNS.find((x) => x.id === id);
    if (!d) continue;
    fontIds.add(d.font);
    if (d.titleFont) fontIds.add(d.titleFont);
    const rel = `${DIR}/games-${id}.xml`;
    if (exists(rel)) continue;
    const body: string[] = [];
    for (const view of GAME_VIEWS) {
      if (!res.views.has(view)) continue;
      const now = id === design.id && !prev ? splitBlock(project, view) : null;
      if (now) {
        body.push(`<view name="${view}">`, ...linkColours(rebase(now.design.join('\n'), design.id), design).split('\n').map((l) => `  ${l}`), '</view>');
      } else {
        const els = designElements(d, contextFor(project, d, fonts), view);
        noteAnims(view, els);
        const extras = new Set(els.filter((e) => isDesignExtra(e.name)).map((e) => e.name));
        body.push(`<view name="${view}">`, ...elementsMarkup(els, extras, view), ...(gameHides.get(view) ?? []), '</view>');
      }
    }
    files[rel] = themeFile(`ChannelCraft: game screens in the ${d.label} style. Picked in RetroBat under Gamelist view style.`, body);
  }
  fontIds.add(design.font);
  if (design.titleFont) fontIds.add(design.titleFont);

  // Colour sets: the shared colours of each, and the artwork they need.
  const sets = choices.colorSets.map((k) => colorSet(k)).filter((c): c is ColorSet => !!c);
  for (const c of sets) {
    const rel = `${DIR}/colors-${c.key}.xml`;
    const vars = Object.entries({ ...starterVars(c.palette, res), ...designVars(c.palette) }).map(([k, v]) => `  <${k}>${v}</${k}>`);
    files[rel] = themeFile(`ChannelCraft: the "${c.label}" colour set. Picked in RetroBat under Color set.`, ['<variables>', `  <designArtSet>${c.key}</designArtSet>`, ...vars, '</variables>']);
  }
  const allDesigns = [...new Set([design.id, ...gameDesigns])].map((id) => DESIGNS.find((d) => d.id === id)!).filter(Boolean);
  const allKeys = [...new Set([`d-${design.id}`, ...sets.map((c) => c.key)])];
  const art = allDesigns.flatMap((d) => allKeys.map((k) => ({ dir: `${ART}/${d.id}-${k}`, design: d, palette: colorSet(k)!.palette })));

  // Motion.
  if (choices.motion) {
    files[`${DIR}/motion-on.xml`] = themeFile('ChannelCraft: motion on (the theme as it is).', []);
    files[`${DIR}/motion-off.xml`] = themeFile('ChannelCraft: motion off. An empty storyboard removes an animation in RetroBat.', storyboardsOff(project, res, generatedAnims));
  }

  // options.xml: the subsets (a single choice is included without a menu entry).
  const state: MenuState = { version: 1, design: prev?.design ?? design.id, systemViews, gameDesigns, colorSets: sets.map((c) => c.key), motion: choices.motion };
  const opt: string[] = [];
  const subset = (name: string, display: string, items: { id: string; label: string; rel: string }[]) => {
    if (items.length === 1) {
      opt.push(`<include>./${relPath('_inc/ccs', items[0].rel)}</include>`);
      return;
    }
    opt.push(`<subset name="${name}" displayName="${esc(display)}">`);
    for (const it of items) opt.push(`  <include name="${esc(it.id)}" displayName="${esc(it.label)}">./${relPath('_inc/ccs', it.rel)}</include>`);
    opt.push('</subset>');
  };
  subset('systemview', 'System view style', systemViews.filter((id) => systemLayout(id)).map((id) => ({ id, label: systemLayout(id)!.label, rel: `${DIR}/system-${id}.xml` })));
  subset('gamelistview', 'Gamelist view style', gameDesigns.filter((id) => DESIGNS.some((d) => d.id === id)).map((id) => ({ id, label: DESIGNS.find((d) => d.id === id)!.label, rel: `${DIR}/games-${id}.xml` })));
  if (choices.motion) subset('motion', 'Motion', [{ id: 'on', label: 'On', rel: `${DIR}/motion-on.xml` }, { id: 'off', label: 'Off', rel: `${DIR}/motion-off.xml` }]);
  files[OPTIONS_FILE] = [`<!-- channelcraft-menu-options ${JSON.stringify(state).replace(/-/g, '\\u002d')} -->`, '<!-- Theme options RetroBat shows in its Theme Configuration menu. Made by ChannelCraft Studio. -->', '<theme>', ...opt.map((l) => `  ${l}`), '</theme>', ''].join('\n');

  return {
    files,
    art,
    fonts: [...fontIds],
    changes: (p) => {
      const entry = p.entry!;
      const root = entry.doc.root!;
      const out: Change[] = [designVarsChange(p, DESIGNS.find((d) => d.id === state.design) ?? design)];
      // Colour sets go into the theme's Color set option (first = default), before the screens.
      const colorset = elements(root).find((e) => e.name === 'subset' && attr(e, 'name') === 'colorset');
      const incs = sets.map((c) => `<include name="ccs-${c.key}" displayName="${esc(c.label)}">./${DIR}/colors-${c.key}.xml</include>`);
      const kids = colorset ? elements(colorset) : [];
      if (colorset && kids.length) {
        // One edit for the whole list (ours first, the theme's own after): separate removals and
        // inserts at the same spot would overlap.
        const keep = kids.filter((k) => !(attr(k, 'name') ?? '').startsWith('ccs-')).map((k) => entry.src.slice(k.start, k.end));
        const lines = [...incs, ...keep];
        if (lines.length) out.push({ file: entry, patch: patchReplaceSpan(entry.doc, kids[0], kids[kids.length - 1], lines.join('\n')) });
      } else if (incs.length) {
        if (colorset) out.push({ file: entry, patch: patchInsertChild(entry.doc, colorset, incs.join('\n')) });
        else out.push({ file: entry, patch: patchInsertChild(entry.doc, root, ['<subset name="colorset" displayName="Color set">', ...incs.map((x) => `  ${x}`), '</subset>'].join('\n'), { first: true }) });
      }
      if (prev) return out;
      // First time: the design blocks make way for the options include, the user's parts stay.
      const include = [`<!-- ${MARK}: system view style, gamelist view style${choices.motion ? ', motion' : ''}. -->`, `<include>./${OPTIONS_FILE}</include>`];
      let placed = false;
      for (const view of ['video', 'detailed', 'basic', 'system']) {
        const b = designBlock(p, view);
        const split = splitBlock(p, view);
        if (!b || !split) continue;
        const own = split.own.length ? [`<!-- ${OWN_MARK} on the ${view} screen, shown with every style. -->`, `<view name="${view}">`, ...split.own.map((l) => `  ${l}`), '</view>'] : [];
        const markup = [...(placed ? [] : include), ...own];
        placed = true;
        out.push({ file: entry, patch: markup.length ? patchReplaceSpan(entry.doc, b.comment, b.view, markup.join('\n')) : patchRemoveNode(entry.doc, b.view) });
        if (!markup.length) out.push({ file: entry, patch: patchRemoveNode(entry.doc, b.comment) });
      }
      if (!placed) out.push({ file: entry, patch: patchInsertChild(entry.doc, root, include.join('\n')) });
      return out;
    },
  };
}

/** Choices that match the theme now: its layout, its design, its own colours, motion on. */
export function defaultChoices(design: Design, systemLayoutNow: string): MenuChoices {
  return { systemViews: [systemLayoutNow], gameDesigns: [design.id], colorSets: [`d-${design.id}`], motion: true };
}

export { SYSTEM_LAYOUTS };
