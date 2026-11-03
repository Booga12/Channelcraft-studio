// Theme health check: things that look broken in RetroBat (missing pictures and fonts, parts off
// the screen), each with a one-click fix where one is safe. Read only; fixes are Changes the
// editor commits as one undo step.
import { basename, dirname, join, relative } from '../path';
import { attr, patchRemoveAttr, patchRemoveNode, type Patch } from '../xml/cst';
import { setTextChange, type Change } from './edits';
import type { Environment } from './context';
import type { ThemeProject } from './project';
import { resolveAsset, resolveAssetWithFallbacks, type PropDef, type ResolvedElement, type Resolution } from './resolver';
import { parsePair } from './schema';
import { zOf } from '../render';
import { contrast, over } from './presets';
import { fontName } from './fonts';
import { RETROBAT_FALLBACK_FONTS, type HasChar } from './fontChars';

export type HealthKind = 'missing-file' | 'missing-font' | 'off-screen' | 'cut-off' | 'hard-to-read' | 'missing-character' | 'covered' | 'second-clock';

export interface HealthIssue {
  kind: HealthKind;
  /** Stays the same while the theme is edited, to remember an issue you chose to ignore. */
  key: string;
  /** Plain words: what is wrong. */
  text: string;
  /** Screens it shows on (view names). */
  views: string[];
  /** One element it is on, to show it. */
  element: string;
  /** The safe fix, if there is one. */
  fix?: { label: string; changes: Change[] };
}

export const HEALTH_LABEL: Record<HealthKind, string> = {
  'missing-file': 'Missing picture or video',
  'missing-font': 'Missing font',
  'off-screen': 'Off the screen',
  'cut-off': 'Cut off at the edge',
  'hard-to-read': 'Hard to read',
  'missing-character': 'Letter the font lacks',
  covered: 'Covered by game art',
  'second-clock': 'Second clock',
};

/** Properties that name a picture, video or sound file. */
const FILE_PROPS = new Set(['path', 'default', 'filledPath', 'unfilledPath', 'selectorImagePath', 'scrollSound', 'backgroundImage', 'gameImage', 'folderImage']);

/** Values that aren't one file: bindings like {game:image}, {random}, expressions, built-in resources. */
const notAFile = (v: string) => !v.trim() || /\{[^}]*[:}]|\(|"/.test(v.replace(/\$\{[^}]*\}/g, '')) || v.trim().startsWith(':/') || /\$[a-z]/i.test(v.replace(/\$\{/g, ''));

/** Built-in variables that differ per console, game or language: a file named with them may be there for some only. */
const PER_CONSOLE = /\$\{(system|game|lang|region|screen|global)\./i;

/** Whether a value, or a variable it uses (up to a few deep), changes per console or game. */
function perConsole(raw: string, res: Resolution, depth = 0): boolean {
  if (PER_CONSOLE.test(raw)) return true;
  if (depth > 3) return false;
  for (const [, name] of raw.matchAll(/\$\{([^}]+)\}/g)) {
    const v = res.vars.get(name);
    if (v && perConsole(v.raw, res, depth + 1)) return true;
  }
  return false;
}

const shown = (el: ResolvedElement) => {
  const v = el.props.get('visible')?.value.trim().toLowerCase();
  const o = parseFloat(el.props.get('opacity')?.value ?? '1');
  return v !== 'false' && v !== '0' && !(o <= 0);
};

const r3 = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * Every check, across every screen of the resolved theme. `charsOf` tells which characters a
 * font file has (undefined while it is still being read); without it, letters aren't checked.
 */
export function checkTheme(project: ThemeProject, res: Resolution, env: Environment, charsOf?: CharsOf): HealthIssue[] {
  // One issue per definition in the files, however many screens use it.
  const issues = new Map<unknown, HealthIssue>();
  const add = (key: unknown, view: string, make: () => HealthIssue) => {
    const had = issues.get(key);
    if (had) {
      if (!had.views.includes(view)) had.views.push(view);
    } else issues.set(key, make());
  };
  // Theme files by name, to repoint a path that has a typo in its folder.
  const byName = new Map<string, string[]>();
  for (const a of project.assets) {
    const n = basename(a.rel).toLowerCase();
    byName.set(n, [...(byName.get(n) ?? []), join(project.dir, a.rel)]);
  }
  const exists = (d: PropDef) => {
    if (notAFile(d.raw) || notAFile(d.value) || perConsole(d.raw, res) || /^https?:\/\//i.test(d.value.trim())) return true;
    // resolveAsset is lenient (it also tries the folder a variable comes from): fewer false alarms.
    return !!resolveAsset(d, res, project, env);
  };

  clockCheck(res, add);
  for (const [view, v] of res.views) {
    for (const el of v.elements.values()) {
      // Parts of a grid tile or carousel item (gridtile.favorite) fall back to RetroBat's own.
      if (!shown(el) || el.name.includes('.')) continue;
      // Missing files. RetroBat uses the first file it finds among a definition's <path>s.
      for (const [prop, h] of el.history) {
        const isFont = prop === 'fontPath';
        if (!isFont && !FILE_PROPS.has(prop)) continue;
        const last = h[h.length - 1];
        const group = h.filter((d) => d.node.parent === last.node.parent);
        if (group.some(exists)) continue;
        const raw = last.value.trim();
        add(last.node, view, () => {
          const same = byName.get(basename(raw).toLowerCase()) ?? [];
          // A fix only edits the definition itself, never a ${variable} other places share.
          const own = !last.raw.includes('${');
          let fix: HealthIssue['fix'];
          if (own && same.length === 1) {
            fix = { label: 'Use the copy in the theme', changes: [setTextChange(last.file, last.node, relative(dirname(last.file.abs), same[0]))] };
          } else if (own && isFont) {
            fix = { label: 'Use the standard font', changes: [{ file: last.file, patch: patchRemoveNode(last.file.doc, last.node) }] };
          }
          return {
            kind: isFont ? 'missing-font' : 'missing-file',
            key: `missing|${last.file.rel}|${raw}`,
            text: `${isFont ? 'Font' : 'File'} “${basename(raw) || raw}” can't be found${same.length === 1 ? ', but the theme has a file with that name in another folder' : ''}.`,
            views: [view],
            element: el.name,
            fix,
          };
        });
      }

      // Off the screen, for parts the theme adds. Theme makers hide RetroBat's built-in parts by
      // moving them off it, and parts that animate in may start off it.
      if (!el.extra || el.extra === 'false') continue;
      const posDef = el.props.get('pos');
      const pos = parsePair(posDef?.value);
      if (!posDef || !pos || el.complex.some((c) => c.name === 'storyboard')) continue;
      const size = parsePair(el.props.get('size')?.value) ?? [0, 0];
      const origin = parsePair(el.props.get('origin')?.value) ?? [0, 0];
      const [w, h] = [Math.max(0, size[0]), Math.max(0, size[1])];
      const x0 = pos[0] - origin[0] * w;
      const y0 = pos[1] - origin[1] * h;
      const eps = 0.001;
      const off = w && h ? x0 + w <= eps || x0 >= 1 - eps || y0 + h <= eps || y0 >= 1 - eps : pos[0] < -eps || pos[0] > 1 + eps || pos[1] < -eps || pos[1] > 1 + eps;
      const isText = el.type === 'text' || el.type === 'datetime';
      const cut = !off && isText && w > 0 && w <= 1 && (x0 < -0.01 || x0 + w > 1.01);
      if (!off && !cut) continue;
      add(posDef.node, view, () => {
        const nx0 = w <= 1 ? Math.min(Math.max(x0, 0), 1 - w) : x0;
        const ny0 = h <= 1 ? Math.min(Math.max(y0, 0), 1 - h) : y0;
        const to = `${r3(nx0 + origin[0] * w)} ${r3(ny0 + origin[1] * h)}`;
        return {
          kind: off ? 'off-screen' : 'cut-off',
          key: `pos|${posDef.file.rel}|${el.name}`,
          text: off ? 'It is placed outside the screen, so nobody sees it.' : 'The text runs past the edge of the screen.',
          views: [view],
          element: el.name,
          fix: posDef.raw.includes('${') ? undefined : { label: 'Move it onto the screen', changes: [setTextChange(posDef.file, posDef.node, to)] },
        };
      });
    }
    textChecks(project, res, env, view, [...v.elements.values()], add, charsOf);
  }
  return [...issues.values()];
}

type CharsOf = (abs: string) => HasChar | null | undefined;
type Add = (key: unknown, view: string, make: () => HealthIssue) => void;

/**
 * A <clock name="clock"> on the Screen overlay is a second clock: RetroBat styles its own clock
 * only from a <text name="clock"> there, so its own still shows at the bottom right, cut off in
 * the button hints' font (#58). The fix turns it into that text.
 */
function clockCheck(res: Resolution, add: Add) {
  const el = res.views.get('screen')?.elements.get('clock');
  if (el?.type !== 'clock' || !shown(el)) return;
  const defs = el.defs.filter((d) => d.node.name === 'clock');
  // Only definitions of this clock alone: a shared one (name="clock, other") stays as it is.
  const own = defs.length > 0 && defs.every((d) => attr(d.node, 'name')?.trim() === 'clock');
  const changes: Change[] = [];
  if (own) {
    for (const d of defs) {
      const n = d.node;
      const patches: (Patch | null)[] = [{ start: n.start + 1, end: n.start + 1 + n.name.length, text: 'text' }, patchRemoveAttr(d.file.doc, n, 'extra')];
      if (!n.selfClosing && d.file.doc.src.startsWith(`</${n.name}`, n.closeStart)) patches.push({ start: n.closeStart + 2, end: n.closeStart + 2 + n.name.length, text: 'text' });
      for (const p of patches) if (p) changes.push({ file: d.file, patch: p });
    }
  }
  add(el, 'screen', () => ({
    kind: 'second-clock',
    key: 'second-clock|screen',
    text: 'The Screen overlay adds a second clock, so RetroBat still shows its own clock at the bottom right, cut off. RetroBat only lets a theme place and style its own clock as a text named “clock”.',
    views: ['screen'],
    element: 'clock',
    fix: own ? { label: 'Use RetroBat’s own clock', changes } : undefined,
  }));
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Where a part sits on the screen (0 to 1), or null when that can't be told without drawing it. */
function rectOf(el: ResolvedElement): Rect | null {
  const pos = parsePair(el.props.get('pos')?.value);
  if (!pos || parseFloat(el.props.get('rotation')?.value ?? '0')) return null;
  const size = parsePair(el.props.get('size')?.value) ?? parsePair(el.props.get('maxSize')?.value) ?? parsePair(el.props.get('minSize')?.value);
  if (!size) return null;
  let [w, h] = size;
  // Text sized by its content: one line high.
  if (h <= 0 && (el.type === 'text' || el.type === 'datetime')) h = parseFloat(el.props.get('fontSize')?.value ?? '') || 0.045;
  if (w <= 0 || h <= 0) return null;
  const origin = parsePair(el.props.get('origin')?.value) ?? [0, 0];
  const x0 = pos[0] - origin[0] * w;
  const y0 = pos[1] - origin[1] * h;
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

const area = (r: Rect) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
const overlap = (a: Rect, b: Rect) => area({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
/** Whether `a` is drawn after (over) `b`. */
const above = (a: ResolvedElement, b: ResolvedElement) => zOf(a) > zOf(b) || (zOf(a) === zOf(b) && a.order > b.order);

/** A game's own picture or video, which RetroBat fills in per game. */
function gameArt(el: ResolvedElement): 'video' | 'picture' | null {
  if (el.type === 'video' || el.name === 'md_video') return 'video';
  if (/^md_(image|thumbnail|marquee|fanart)$/.test(el.name)) return 'picture';
  return el.type === 'image' && /\{(game|md):/.test(el.props.get('path')?.value ?? '') ? 'picture' : null;
}

const hexOf = (c: string | undefined) => {
  const t = (c ?? '').trim().toUpperCase();
  return /^[0-9A-F]{6}$/.test(t) ? t + 'FF' : /^[0-9A-F]{8}$/.test(t) ? t : null;
};
const alphaOf = (c: string) => parseInt(c.slice(6, 8), 16) / 255;
const withAlpha = (c: string, a: number) => c.slice(0, 6) + Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, '0').toUpperCase();
const opacityOf = (el: ResolvedElement) => {
  const o = parseFloat(el.props.get('opacity')?.value ?? '1');
  return Number.isFinite(o) ? o : 1;
};

/**
 * The colour behind a point under `top` (RRGGBB), from what is drawn there: tinted panels, a
 * text's background box and a design's background. null when a picture or anything else is
 * there, whose colour can't be known without drawing it.
 */
function colourBehind(top: ResolvedElement, x: number, y: number, els: ResolvedElement[], res: Resolution): string | null {
  const under = els
    .filter((e) => e !== top && shown(e) && !e.name.includes('.') && above(top, e))
    .filter((e) => {
      const r = rectOf(e);
      return r && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
    })
    .sort((a, b) => (above(a, b) ? -1 : 1));
  // Colours from the top down, until one hides everything under it. RetroBat clears to black.
  const layers: string[] = [];
  const own = hexOf(top.props.get('backgroundColor')?.value);
  if (own && alphaOf(own) > 0) layers.push(own);
  for (const e of under) {
    if (layers.length && alphaOf(layers[layers.length - 1]) >= 1) break;
    const path = e.props.get('path')?.value ?? '';
    let c: string | null;
    // ChannelCraft's panels are a white shape tinted with their colour.
    if ((e.type === 'ninepatch' || e.type === 'image') && /(^|[\\/])panel\.svg$/i.test(path)) c = hexOf(e.props.get('color')?.value) ?? 'FFFFFFFF';
    else if (e.type === 'text' || e.type === 'datetime') c = hexOf(e.props.get('backgroundColor')?.value) ?? '00000000';
    else if (e.type === 'image' && /background\.(png|jpe?g)$/i.test(path)) c = hexOf(res.vars.get('designBackground')?.value);
    else c = null;
    if (!c) {
      // A faint picture hardly changes the colour, nor do a design's scattered decorations;
      // any other picture could be any colour.
      if (alphaOf(hexOf(e.props.get('color')?.value) ?? 'FFFFFFFF') * opacityOf(e) <= 0.2 || /(^|[\\/])deco\.png$/i.test(path)) continue;
      return null;
    }
    if (alphaOf(c) * opacityOf(e) > 0) layers.push(withAlpha(c, alphaOf(c) * opacityOf(e)));
  }
  let colour = '000000';
  for (const c of layers.reverse()) colour = over(c, colour);
  return colour;
}

/** Checks on what a text shows: letters its font lacks, game art drawn over it, colours too alike. */
function textChecks(project: ThemeProject, res: Resolution, env: Environment, view: string, els: ResolvedElement[], add: Add, charsOf?: CharsOf) {
  for (const el of els) {
    if ((el.type !== 'text' && el.type !== 'datetime') || !shown(el) || el.name.includes('.')) continue;
    // RetroBat's own clock: drawn over every screen, not this empty one, and RetroBat writes its text.
    if (view === 'screen' && el.name === 'clock') continue;

    // Letters the theme's own font doesn't have.
    const textDef = el.props.get('text');
    const font = charsOf && textDef ? resolveAssetWithFallbacks(el, 'fontPath', res, project, env) : null;
    const own = font ? charsOf!(font) : null;
    // RetroBat borrows a character from its own fonts first: only one none of them has shows
    // as a box. Until they have all been read (or without RetroBat), nothing is said.
    const spare = font && env.resourcesDir ? RETROBAT_FALLBACK_FONTS.map((f) => charsOf!(join(env.resourcesDir, f))) : [];
    const has = own && spare.length && spare.every((s) => s) ? (cp: number) => own(cp) || spare.some((s) => s!(cp)) : null;
    if (font && has && textDef) {
      const kase = `${el.props.get('letterCase')?.value ?? ''} ${el.props.get('forceUppercase')?.value ?? ''}`.toLowerCase();
      let t = textDef.value.replace(/\{[^}]*\}/g, '');
      if (/upper|true|1/.test(kase)) t = t.toUpperCase();
      else if (/lower/.test(kase)) t = t.toLowerCase();
      const lacks = [...new Set([...t].filter((ch) => /\S/.test(ch) && !has(ch.codePointAt(0)!)))];
      if (lacks.length) {
        const key = `chars|${textDef.file.rel}|${el.name}|${lacks.join('')}`;
        const list = lacks.slice(0, 5).map((c) => `“${c}”`);
        const words = list.length > 1 ? `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}` : list[0];
        add(key, view, () => ({
          kind: 'missing-character',
          key,
          text: `The font ${fontName(font)} has no ${words}${lacks.length > 5 ? ' and more' : ''}, and neither do RetroBat's own fonts, so RetroBat shows an empty box for ${lacks.length > 1 ? 'them' : 'it'}.`,
          views: [view],
          element: el.name,
        }));
      }
    }

    const box = rectOf(el);
    if (!box) continue;

    // A game's picture or video drawn over the text hides it for games that have one.
    for (const m of els) {
      const kind = gameArt(m);
      const r = kind && shown(m) && !m.name.includes('.') && above(m, el) ? rectOf(m) : null;
      if (!r) continue;
      // A picture fitted into a maxSize box may not fill it: only a big overlap counts then.
      const size = parsePair(m.props.get('size')?.value);
      const fitted = !size || size.some((n) => n <= 0);
      if (overlap(box, r) < area(box) * (fitted ? 0.3 : 0.1)) continue;
      const key = `covered|${el.name}|${m.name}`;
      add(key, view, () => ({
        kind: 'covered',
        key,
        text: `The game's ${kind} is drawn over part of this text, so the text is hidden for games that have one.`,
        views: [view],
        element: el.name,
      }));
      break;
    }

    // Text colour against what's behind it. Text in the design's text colour is in the
    // theme-wide check too (the editor adds that one), which fixes the whole palette.
    const colDef = el.props.get('color');
    const col = hexOf(colDef?.value);
    if (!colDef || !col || !alphaOf(col) || colDef.raw.trim() === '${designText}') continue;
    const behind = colourBehind(el, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, els, res);
    if (!behind) continue;
    const ratio = contrast(col.slice(0, 6), behind);
    if (ratio >= 3) continue;
    const key = `contrast|${colDef.file.rel}|${el.name}`;
    add(key, view, () => {
      // The nearest readable design colour: accent text keeps an accent, if its text shade reads.
      const reads = (n: string) => {
        const c = hexOf(res.vars.get(n)?.value);
        return !!c && contrast(c.slice(0, 6), behind) >= 3;
      };
      const to = colDef.raw.trim() === '${designAccent}' && reads('designAccentText') ? '${designAccentText}' : reads('designText') ? '${designText}' : contrast('111111', behind) >= contrast('FFFFFF', behind) ? '111111' : 'FFFFFF';
      return {
        kind: 'hard-to-read',
        key,
        text: `Its color is too close to what's behind it (contrast ${Math.floor(ratio * 10) / 10}:1; 3 or more reads well).`,
        views: [view],
        element: el.name,
        fix: { label: to === '${designAccentText}' ? 'Use the readable accent' : to === '${designText}' ? 'Use the text color' : 'Make it readable', changes: [setTextChange(colDef.file, colDef.node, to)] },
      };
    });
  }
}
