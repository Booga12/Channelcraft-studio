// Resolves a theme the way EmulationStation reads it: includes, subsets (theme options),
// variables and conditions are applied in document order, and later definitions of an
// element merge into earlier ones property by property. Every resolved value remembers the
// XML node it came from, so the editor can write changes back to the right place.

import { basename, dirname, isAbsolute, join } from '../path';
import { attr, elements, hasElementChildren, textOf, type XElement } from '../xml/cst';
import { ARCH, bindingValue, builtinVar, type Environment } from './context';
import { evalCondition, evaluate, type ExprEnv } from './expr';
import type { ThemeFile, ThemeProject } from './project';

export interface Source {
  node: XElement;
  file: ThemeFile;
}

export interface PropDef extends Source {
  name: string;
  /** Text as written in the file (entities decoded, trimmed). */
  raw: string;
  /** With `${...}` variables substituted. */
  value: string;
  /** The property node itself carries a condition. */
  conditional: boolean;
}

export interface ResolvedElement {
  name: string;
  type: string;
  extra: string | null;
  /** Element definitions that applied, in order. */
  defs: Source[];
  /** Winning value per property. */
  props: Map<string, PropDef>;
  /** Every applied definition per property, in order (the last one wins). */
  history: Map<string, PropDef[]>;
  /** Children with nested elements, such as <storyboard> or <itemTemplate>. */
  complex: PropDef[];
  conditional: boolean;
  unknownConditions: number;
  order: number;
}

export interface ResolvedView {
  name: string;
  custom: boolean;
  inherits: string | null;
  displayName: string | null;
  elements: Map<string, ResolvedElement>;
  defs: Source[];
}

export interface SubsetOption {
  name: string;
  displayName: string;
}

export interface SubsetInfo {
  name: string;
  displayName: string;
  options: SubsetOption[];
  selected: string;
  /** No explicit choice was made; `selected` is the theme's default. */
  isDefault: boolean;
  source: Source | null;
}

export interface VarDef extends Source {
  name: string;
  raw: string;
  value: string;
  conditional: boolean;
}

export interface IncludeEdge {
  from: ThemeFile;
  to: ThemeFile | null;
  path: string;
  node: XElement;
}

export interface Resolution {
  views: Map<string, ResolvedView>;
  subsets: SubsetInfo[];
  vars: Map<string, VarDef>;
  varHistory: Map<string, VarDef[]>;
  includes: IncludeEdge[];
  usedFiles: Set<ThemeFile>;
  missing: string[];
  unknownConditions: number;
  /** Conditions that couldn't be decided (treated as passing). */
  unknownExpressions: Set<string>;
  defaultView: string | null;
  /** Per game-list screen: where RetroBat looks for this game's own file, and the file if there is one. */
  perGame: Map<string, PerGameInfo>;
  /** Parts of a game's own file that RetroBat doesn't apply (see perGameApplies). */
  perGameIgnored: { view: string; name: string }[];
  /** Files read as the current game's per-game file (with what they include). */
  perGameFiles: Set<ThemeFile>;
}

/**
 * RetroBat's per-game look (DetailedContainer::loadThemedExtras): a game-list screen with a
 * `<gameextras name="gameextras"><path>folder</path></gameextras>` element reads, for the game in
 * focus, `folder/<rom name>.xml` or `folder/<rom name>/theme.xml` (also by CRC32, not used here)
 * and lays it over the theme for that game only.
 */
export interface PerGameInfo {
  view: string;
  /** The folder per-game files are looked up in, when the path names a folder. */
  root: string | null;
  /** The game's ROM file name without its extension. */
  stem: string;
  /** The file RetroBat lays over the theme for this game: its own, or a shared fallback. */
  file: ThemeFile | null;
  /** The path is an expression evaluated per game (a `{game:...}` binding, e.g. firstfile(...)). */
  binding: boolean;
  /** Files RetroBat tries for this game, in order (absolute). */
  candidates: string[];
}

/** Whether a per-game path is this game's own: a folder or file named after its ROM. */
export function isOwnGamePath(path: string, stem: string): boolean {
  const parts = path.split(/[\\/]+/).map((x) => x.toLowerCase());
  const s = stem.toLowerCase();
  return parts.slice(0, -1).includes(s) || parts[parts.length - 1] === `${s}.xml`;
}

/** Screens that show one game at a time (they use RetroBat's DetailedContainer). */
export const GAME_LIST_VIEWS = new Set(['detailed', 'video', 'grid', 'gamecarousel']);

/** Whether a screen (or the custom screen it is based on) shows one game at a time. */
export function isGameListView(res: Resolution, name: string): boolean {
  for (let n: string | null = name, i = 0; n && i < 10; i++) {
    if (GAME_LIST_VIEWS.has(n)) return true;
    n = res.views.get(n)?.inherits ?? null;
  }
  return false;
}

/** A ROM path's file name without the extension, as RetroBat names per-game files. */
export function romStem(romPath: string): string {
  const b = basename(romPath.replace(/[\\/]+$/, ''));
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(0, i) : b;
}

const ACTIVATE_EVENTS = new Set(['activate', 'activateNext', 'activatePrev']);

/**
 * Whether RetroBat re-applies an element from a game's own file. Only the game parts (md_*) and
 * extras with an appear animation are rebuilt per game; extras the game's file adds itself need
 * extra="true". Everything else is drawn once for the whole list, so a game's file can't change it.
 */
export function perGameApplies(existing: ResolvedElement | undefined, name: string, hasExtraAttr: boolean): boolean {
  if (name.startsWith('md_')) return true;
  if (!existing) return hasExtraAttr;
  // extra="true" on a name the theme already uses makes RetroBat draw a per-game copy of it.
  return hasExtraAttr || (!!existing.extra && existing.extra !== 'false' && hasActivateStoryboard(existing));
}

export function hasActivateStoryboard(el: ResolvedElement): boolean {
  return el.complex.some((c) => c.name === 'storyboard' && ACTIVATE_EVENTS.has(attr(c.node, 'event') ?? ''));
}

const COND_ATTRS = new Set(['if', 'ifSubset', 'lang', 'region', 'tinyScreen', 'verticalScreen', 'ifHelpPrompts', 'ifArch', 'ifNotArch', 'ifCheevos', 'ifNetwork']);

/** Element-level attributes that are not conditions. */
const NON_COND_ATTRS = new Set(['name', 'extra', 'displayName', 'subset', 'inherits', 'appliesTo', 'onclick', 'path', 'supported']);

export function splitNames(s: string | undefined): string[] {
  return (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function hasConditions(el: XElement): boolean {
  return el.attrs.some((a) => COND_ATTRS.has(a.name) || (a.name.startsWith('if') && !NON_COND_ATTRS.has(a.name)));
}

/**
 * Resolves a theme from `entryRel` (default: the project's current entry file). RetroBat reads the
 * loading screen from splash.xml and the game launch screen from gamesplash.xml, separately from
 * theme.xml (es-core/src/Splash.cpp).
 */
export function resolveTheme(project: ThemeProject, env: Environment, entryRel?: string): Resolution {
  // ES knows every theme option's value before it reads the views, so `ifSubset` can refer to
  // options declared further down. A first pass collects the defaults for the second.
  const first = resolvePass(project, env, entryRel);
  const subsets = { ...env.settings.subsets };
  for (const info of first.subsets) if (subsets[info.name] === undefined) subsets[info.name] = info.selected;
  const res = resolvePass(project, { ...env, settings: { ...env.settings, subsets } }, entryRel);
  // Report what the theme would pick on its own, not the seeded values.
  for (const info of res.subsets) info.isDefault = env.settings.subsets[info.name] === undefined;
  return res;
}

function resolvePass(project: ThemeProject, env: Environment, entryRel?: string): Resolution {
  const s = env.settings;
  const out: Resolution = {
    views: new Map(),
    subsets: [],
    vars: new Map(),
    varHistory: new Map(),
    includes: [],
    usedFiles: new Set(),
    missing: [],
    unknownConditions: 0,
    unknownExpressions: new Set(),
    defaultView: null,
    perGame: new Map(),
    perGameIgnored: [],
    perGameFiles: new Set(),
  };
  /** While a game's own file is read: the screens it applies to. */
  let perGameViews: Set<string> | null = null;
  const subsetSel = new Map<string, string>();
  const subsetInfo = new Map<string, SubsetInfo>();
  const stack: ThemeFile[] = [];
  let order = 0;

  const exprEnv: ExprEnv = {
    binding: (name) => bindingValue(name, env, subsetSel),
    exists: (p) => assetExists(p, project, env),
  };

  const lookupVar = (name: string): string | undefined => out.vars.get(name)?.value ?? builtinVar(name, env, project.dir, subsetSel);

  /** Substitutes `${var}` (and the legacy `$system`) in plain text. */
  const subst = (text: string): string =>
    text
      .replace(/\$\{([^}]+)\}/g, (m, n: string) => lookupVar(n.trim()) ?? m)
      .replace(/\$system(?![\w.{])/g, s.system.theme);

  /** Substitutes variables inside an expression, quoting plain values so they compare as strings. */
  const substExpr = (text: string): string =>
    text.replace(/\$\{([^}]+)\}/g, (m, n: string, offset: number) => {
      const v = lookupVar(n.trim());
      if (v === undefined) return m;
      const prev = text[offset - 1];
      if (prev === "'" || prev === '"') return v;
      const t = v.trim();
      if (/^-?\d+(\.\d+)?$/.test(t) || /^(true|false)$/i.test(t)) return t;
      if (/==|!=|&&|\|\||[<>!]|\(/.test(t)) return `(${t})`;
      return t.includes("'") ? `"${t}"` : `'${t}'`;
    });

  const subsetPass = (spec: string): { pass: boolean; unknown: boolean } => {
    // "a:x|y, b:z" — every comma part must match; any of the | options may match.
    let unknown = false;
    for (const part of spec.split(',')) {
      const [name, opts = ''] = part.split(':').map((x) => x.trim());
      if (!name) continue;
      const sel = subsetSel.get(name) ?? s.subsets[name];
      if (sel === undefined) {
        unknown = true;
        continue;
      }
      const allowed = opts.split('|').map((o) => o.trim().toLowerCase());
      if (!allowed.includes(sel.toLowerCase())) return { pass: false, unknown: false };
    }
    return { pass: true, unknown };
  };

  const listMatch = (spec: string, value: string) => {
    const v = value.toLowerCase();
    return spec
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .some((x) => x === v || (x.length >= 2 && v.startsWith(x + '_')) || (v.length >= 2 && x.startsWith(v + '_')));
  };

  /** Evaluates every condition attribute on a node. */
  const conds = (el: XElement): { pass: boolean; conditional: boolean; unknown: boolean } => {
    let conditional = false;
    let unknown = false;
    for (const a of el.attrs) {
      let r: { pass: boolean; unknown: boolean } | null = null;
      switch (a.name) {
        case 'if':
          r = evalCondition(substExpr(a.value), exprEnv);
          break;
        case 'ifSubset':
          r = subsetPass(a.value);
          break;
        case 'lang':
          r = { pass: listMatch(a.value, s.lang), unknown: false };
          break;
        case 'region':
          r = { pass: listMatch(a.value, s.region), unknown: false };
          break;
        case 'tinyScreen':
          r = { pass: (a.value.toLowerCase() === 'true') === s.tinyScreen, unknown: false };
          break;
        case 'verticalScreen':
          r = { pass: (a.value.toLowerCase() === 'true') === s.verticalScreen, unknown: false };
          break;
        case 'ifHelpPrompts':
          r = { pass: (a.value.toLowerCase() === 'true') === s.helpPrompts, unknown: false };
          break;
        case 'ifCheevos':
          r = { pass: (a.value.toLowerCase() === 'true') === s.cheevos, unknown: false };
          break;
        case 'ifArch':
          r = { pass: a.value.split(',').some((x) => ARCH.includes(x.trim().toLowerCase())), unknown: false };
          break;
        case 'ifNotArch':
          r = { pass: !a.value.split(',').some((x) => ARCH.includes(x.trim().toLowerCase())), unknown: false };
          break;
        default:
          if (a.name.startsWith('if') && !NON_COND_ATTRS.has(a.name)) r = { pass: true, unknown: true };
      }
      if (!r) continue;
      conditional = true;
      if (r.unknown) {
        unknown = true;
        out.unknownConditions++;
        out.unknownExpressions.add(`${a.name}="${a.value}"`);
      }
      if (!r.pass) return { pass: false, conditional, unknown };
    }
    return { pass: true, conditional, unknown };
  };

  const resolveIncludePath = (p: string, from: ThemeFile) => resolvePath(p, dirname(from.abs), project.dir, env);

  const includeFile = (path: string, from: ThemeFile, node: XElement) => {
    const abs = resolveIncludePath(path, from);
    const f = project.file(abs) ?? null;
    out.includes.push({ from, to: f, path, node });
    if (!f) {
      out.missing.push(abs);
      return;
    }
    if (stack.includes(f) || stack.length > 40) return;
    processFile(f);
  };

  const registerOption = (subset: string, option: SubsetOption, displayName?: string, source?: Source) => {
    let info = subsetInfo.get(subset);
    if (!info) {
      info = { name: subset, displayName: displayName || subset, options: [], selected: '', isDefault: true, source: source ?? null };
      subsetInfo.set(subset, info);
      out.subsets.push(info);
    }
    if (option.name && !info.options.some((o) => o.name === option.name)) info.options.push(option);
    if (!subsetSel.has(subset)) {
      const chosen = s.subsets[subset];
      subsetSel.set(subset, chosen ?? option.name);
    }
    info.selected = subsetSel.get(subset)!;
    return info.selected;
  };

  const processElement = (view: ResolvedView, el: XElement, file: ThemeFile) => {
    const c = conds(el);
    if (!c.pass) return;
    const names = splitNames(attr(el, 'name'));
    if (!names.length) names.push(el.name);
    for (const name of names) {
      let re = view.elements.get(name);
      if (perGameViews && !perGameApplies(re, name, attr(el, 'extra') !== undefined)) {
        out.perGameIgnored.push({ view: view.name, name });
        continue;
      }
      if (!re) {
        re = { name, type: el.name, extra: null, defs: [], props: new Map(), history: new Map(), complex: [], conditional: false, unknownConditions: 0, order: order++ };
        view.elements.set(name, re);
      }
      // <control name="a, b"> changes shared settings of elements without changing their type
      // (ThemeData::parseElement); it only names the type when nothing else has defined it yet.
      if (el.name !== 'control' || re.type === 'control') re.type = el.name;
      re.defs.push({ node: el, file });
      const extra = attr(el, 'extra');
      if (extra !== undefined) re.extra = extra;
      if (c.conditional) re.conditional = true;
      if (c.unknown) re.unknownConditions++;
      for (const child of elements(el)) {
        const cc = conds(child);
        if (!cc.pass) continue;
        const raw = textOf(file.doc, child).trim();
        const def: PropDef = { name: child.name, raw, value: subst(raw), node: child, file, conditional: cc.conditional };
        if (child.name === 'storyboard') {
          // RetroBat keeps one storyboard per event: a later one replaces it, an empty one removes it
          // (ThemeData::parseElement).
          const event = attr(child, 'event') ?? '';
          re.complex = re.complex.filter((c) => c.name !== 'storyboard' || (attr(c.node, 'event') ?? '') !== event);
          if (hasElementChildren(child)) re.complex.push(def);
          continue;
        }
        if (hasElementChildren(child)) {
          re.complex.push(def);
          continue;
        }
        re.props.set(child.name, def);
        const h = re.history.get(child.name);
        if (h) h.push(def);
        else re.history.set(child.name, [def]);
      }
    }
  };

  const getView = (name: string, custom = false, inherits: string | null = null, displayName: string | null = null): ResolvedView => {
    let v = out.views.get(name);
    if (!v) {
      v = { name, custom, inherits, displayName, elements: new Map(), defs: [] };
      if (inherits) {
        const base = out.views.get(inherits);
        if (base) for (const [k, e] of base.elements) v.elements.set(k, cloneElement(e));
      }
      out.views.set(name, v);
    }
    return v;
  };

  const processThemeChild = (el: XElement, file: ThemeFile) => {
    switch (el.name) {
      case 'variables': {
        if (!conds(el).pass) return;
        for (const v of elements(el)) {
          const c = conds(v);
          if (!c.pass) continue;
          const raw = textOf(file.doc, v).trim();
          const def: VarDef = { name: v.name, raw, value: subst(raw), node: v, file, conditional: c.conditional };
          out.vars.set(v.name, def);
          const h = out.varHistory.get(v.name);
          if (h) h.push(def);
          else out.varHistory.set(v.name, [def]);
        }
        return;
      }
      case 'include': {
        const legacySubset = attr(el, 'subset');
        if (legacySubset) {
          const name = attr(el, 'name') ?? '';
          const selected = registerOption(legacySubset, { name, displayName: attr(el, 'displayName') ?? name }, undefined, { node: el, file });
          if (name !== selected) return;
        }
        if (!conds(el).pass) return;
        const path = subst(textOf(file.doc, el).trim());
        if (path) includeFile(path, file, el);
        return;
      }
      case 'subset': {
        const name = attr(el, 'name');
        if (!name) return;
        const options = elements(el).filter((e) => e.name === 'include');
        if (!subsetSel.has(name) && s.subsets[name] === undefined) {
          // Default: the first option whose own condition passes (e.g. a detected aspect ratio).
          const first = options.find((o) => conds(o).pass) ?? options[0];
          if (first) subsetSel.set(name, attr(first, 'name') ?? '');
        }
        let selected = '';
        for (const o of options) {
          const oname = attr(o, 'name') ?? '';
          selected = registerOption(name, { name: oname, displayName: attr(o, 'displayName') ?? oname }, attr(el, 'displayName'), { node: el, file });
        }
        if (!conds(el).pass) return;
        // Several includes may share a name (e.g. one per detected ratio): the first passing one is used.
        for (const o of options) {
          if ((attr(o, 'name') ?? '') !== selected) continue;
          if (!conds(o).pass) continue;
          const path = subst(textOf(file.doc, o).trim());
          if (path) includeFile(path, file, o);
          break;
        }
        return;
      }
      case 'view': {
        if (!conds(el).pass) return;
        for (const name of splitNames(attr(el, 'name'))) {
          if (perGameViews && !perGameViews.has(name)) continue;
          const view = getView(name);
          view.defs.push({ node: el, file });
          for (const child of elements(el)) processElement(view, child, file);
        }
        return;
      }
      case 'customView': {
        if (!conds(el).pass) return;
        for (const name of splitNames(attr(el, 'name'))) {
          if (perGameViews && !perGameViews.has(name)) continue;
          const view = getView(name, true, attr(el, 'inherits') ?? null, attr(el, 'displayName') ?? null);
          view.defs.push({ node: el, file });
          for (const child of elements(el)) processElement(view, child, file);
        }
        return;
      }
      case 'feature':
        if (!conds(el).pass) return;
        for (const child of elements(el)) processThemeChild(child, file);
        return;
    }
  };

  const processFile = (file: ThemeFile) => {
    const root = file.doc.root;
    if (!root || root.name !== 'theme') return;
    stack.push(file);
    out.usedFiles.add(file);
    if (perGameViews) out.perGameFiles.add(file);
    if (stack.length === 1) out.defaultView = attr(root, 'defaultView') ?? null;
    // Like RetroBat (ThemeData::appendFile), a file's <variables> are read before anything else in it.
    const children = elements(root);
    for (const child of children) if (child.name === 'variables') processThemeChild(child, file);
    for (const child of children) if (child.name !== 'variables') processThemeChild(child, file);
    stack.pop();
  };

  const entry = entryRel ? project.fileAt(entryRel) : project.entry;
  if (entry) processFile(entry);
  // The game in focus: its own file, if the theme has one for it, goes over the theme.
  if (env.game?.path && entry?.rel === 'theme.xml') {
    const stem = romStem(env.game.path);
    // A file emptied in the editor is deleted on save, so it counts as missing here.
    const live = (abs: string) => {
      const f = project.file(abs);
      return f && f.src.trim() ? f : null;
    };
    const byFile = new Map<ThemeFile, Set<string>>();
    for (const [name, v] of out.views) {
      const ge = v.elements.get('gameextras');
      if (!ge || !isGameListView(out, name)) continue;
      const def = ge.props.get('path_binding') ?? ge.props.get('path');
      const base = def ? dirname(def.file.abs) : project.dir;
      const raw = def?.value.trim() ?? '';
      // Like ThemeData: a path with a {x:y} binding is an expression evaluated for each game.
      const binding = !!ge.props.get('path_binding') || /\{[^{}]*:[^{}]*\}/.test(raw);
      const asked: string[] = [];
      let target = raw;
      if (binding) {
        const askEnv: ExprEnv = {
          ...exprEnv,
          exists: (p) => {
            const abs = resolvePath(p, base, project.dir, env);
            if (!asked.includes(abs)) asked.push(abs);
            return /\.xml$/i.test(abs) ? !!live(abs) : exprEnv.exists(p);
          },
        };
        try {
          target = String(evaluate(raw, askEnv) ?? '');
        } catch {
          target = '';
        }
      }
      const abs = target ? resolvePath(target, base, project.dir, env) : null;
      const isFile = !!abs && /\.xml$/i.test(abs);
      const root = abs && !isFile ? abs : null;
      const candidates = root ? [join(root, `${stem}.xml`), join(root, stem, 'theme.xml')] : asked.filter((a) => /\.xml$/i.test(a));
      if (isFile && !candidates.includes(abs!)) candidates.push(abs!);
      const file = isFile ? live(abs!) : (candidates.map(live).find(Boolean) ?? null);
      out.perGame.set(name, { view: name, root, stem, file, binding, candidates });
      if (file) byFile.set(file, (byFile.get(file) ?? new Set()).add(name));
    }
    for (const [file, views] of byFile) {
      perGameViews = views;
      processFile(file);
      perGameViews = null;
    }
  }
  for (const info of out.subsets) info.selected = subsetSel.get(info.name) ?? info.selected;
  return out;
}

function cloneElement(e: ResolvedElement): ResolvedElement {
  return {
    ...e,
    defs: [...e.defs],
    props: new Map(e.props),
    history: new Map([...e.history].map(([k, v]) => [k, [...v]])),
    complex: [...e.complex],
  };
}

/**
 * Resolves a theme path to an absolute path the way RetroBat does (FileSystemUtil::
 * resolveRelativePath): `./x` (and `./../x`) from the file's folder, `~/x` from .emulationstation,
 * `:/x` from its resources. Anything else relative, such as `../x` or `art/x.png`, is left to the
 * working folder of emulationstation.exe, so it is not found in the theme.
 */
export function resolvePath(p: string, baseDir: string, themeDir: string, env: Environment): string {
  const t = p.trim();
  if (t.startsWith(':/')) return join(env.resourcesDir, t.slice(2));
  if (t.startsWith('~/') || t.startsWith('~\\')) return join(env.esHome, t.slice(2));
  if (isAbsolute(t)) return join(t);
  if (t === '.' || /^\.[\\/]/.test(t)) return join(baseDir || themeDir, t);
  return env.esHome ? join(env.esHome, '..', t) : join(themeDir, t);
}

export function assetExists(p: string, project: ThemeProject, env: Environment): boolean {
  if (!p) return false;
  const abs = resolvePath(p, project.dir, project.dir, env);
  if (project.isInside(abs)) return project.hasFile(abs);
  // Files outside the theme (built-in resources) are assumed to exist.
  return p.startsWith(':/') || p.startsWith('~/');
}

/**
 * Absolute path for an asset property. ES resolves relative paths against the file that sets
 * them, but themes often keep paths in variables defined elsewhere, so a few bases are tried.
 */
export function resolveAsset(def: PropDef | undefined, res: Resolution, project: ThemeProject, env: Environment): string | null {
  if (!def || !def.value) return null;
  const v = def.value.trim();
  if (!v || v.includes('{') || v.includes('(')) return null;
  const bases = [dirname(def.file.abs), project.dir];
  const m = def.raw.match(/^\$\{([^}]+)\}/);
  const varDef = m ? res.vars.get(m[1]) : undefined;
  if (varDef) bases.unshift(dirname(varDef.file.abs));
  for (const b of bases) {
    const abs = resolvePath(v, b, project.dir, env);
    if (!project.isInside(abs) || project.hasFile(abs)) return abs;
  }
  return null;
}

/** All assets referenced by a property's applied definitions, first existing one wins (ES `<path>` fallbacks). */
export function resolveAssetWithFallbacks(el: ResolvedElement, prop: string, res: Resolution, project: ThemeProject, env: Environment): string | null {
  const h = el.history.get(prop) ?? [];
  const last = h[h.length - 1];
  if (!last) return null;
  // Fallback <path> siblings live in the same element definition as the winner.
  const siblings = h.filter((d) => d.node.parent === last.node.parent);
  for (const d of siblings) {
    const a = resolveAsset(d, res, project, env);
    if (a) return a;
  }
  return null;
}
