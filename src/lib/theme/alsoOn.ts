// "Also show on" (#30): a part you added to one game list, shown on the other game lists too.
// RetroBat applies a `<view name="detailed, video">` block to each screen it names, so the part
// moves into a block naming every screen it should be on. It stays one part: changing it on one
// game list changes it on all of them.

import { attr, patchInsertChild, patchRemoveNode, patchReplaceSpan, type XElement } from '../xml/cst';
import type { ThemeProject } from './project';
import { splitNames, type Resolution } from './resolver';
import type { Change } from './edits';

/** RetroBat's own game list screens, the ones a `<view>` block can name (ThemeData sSupportedViews). */
export const GAME_LIST_VIEWS = ['detailed', 'video', 'basic', 'grid', 'gamecarousel'] as const;

export interface AlsoOnScreen {
  view: string;
  /** on: it's there and can be taken off; off: it can be added; with: it comes with another screen; taken: the name is used there. */
  state: 'on' | 'off' | 'with' | 'taken';
  /** For 'with': the screen it comes with. */
  from?: string;
}

export interface AlsoOn {
  /** The other game list screens and the part's state on each. */
  screens: AlsoOnScreen[];
  /** Why the part can't be shared, when it can't (shown instead of the ticks). */
  why?: string;
}

/** The block a part is defined in, when it's defined once, directly in a `<view>` of theme.xml. */
function soleDef(project: ThemeProject, res: Resolution, view: string, name: string): { node: XElement; block: XElement } | string {
  const el = res.views.get(view)?.elements.get(name);
  if (!el) return 'not found';
  const entry = project.entry;
  if (el.defs.length !== 1 || el.defs[0].file !== entry) return 'It comes from more than one place in the theme, so it can only be shared in Advanced mode.';
  const node = el.defs[0].node;
  const block = node.parent;
  if (!block || block.name !== 'view' || block.parent !== entry?.doc.root) return 'It sits inside another part of the theme, so it can only be shared in Advanced mode.';
  if (splitNames(attr(node, 'name')).length !== 1) return 'It shares its settings with other parts, so it can only be shared in Advanced mode.';
  return { node, block };
}

/** Whether `view` is a game list (RetroBat's own, or a custom screen based on one). */
export function isGameList(res: Resolution, view: string): boolean {
  for (let n: string | null = view, i = 0; n && i < 10; i++) {
    if ((GAME_LIST_VIEWS as readonly string[]).includes(n)) return true;
    n = res.views.get(n)?.inherits ?? null;
  }
  return false;
}

/**
 * Where the part `name` on game list `view` is shown, and where it could be: one entry per other
 * game list in the theme. Empty when `view` isn't a game list or the theme has no other.
 */
export function alsoOn(project: ThemeProject, res: Resolution, view: string, name: string): AlsoOn {
  if (!isGameList(res, view)) return { screens: [] };
  const others = [...res.views.keys()].filter((v) => v !== view && isGameList(res, v));
  if (!others.length) return { screens: [] };
  const def = soleDef(project, res, view, name);
  const node = typeof def === 'string' ? null : def.node;
  const names = typeof def === 'string' ? [view] : splitNames(attr(def.block, 'name'));
  const screens = others.map((v): AlsoOnScreen => {
    const there = res.views.get(v)?.elements.get(name);
    if (names.includes(v)) return { view: v, state: 'on' };
    if (there && node && there.defs.some((d) => d.node === node)) {
      // A custom screen gets what its base screen has.
      const from = res.views.get(v)?.inherits ?? undefined;
      return { view: v, state: 'with', from };
    }
    if (there) return { view: v, state: 'taken' };
    return { view: v, state: 'off' };
  });
  // Only RetroBat's own screens can be ticked; custom ones only show what they come with.
  const shown = screens.filter((s) => (GAME_LIST_VIEWS as readonly string[]).includes(s.view) || s.state === 'with');
  return typeof def === 'string' ? { screens: shown, why: def } : { screens: shown };
}

/** The part's markup with its own indent taken off, ready to go into another block. */
function markupOf(src: string, node: XElement): string {
  const lineStart = src.lastIndexOf('\n', node.start - 1) + 1;
  const indent = /^[ \t]*/.exec(src.slice(lineStart, node.start))?.[0] ?? '';
  return src
    .slice(node.start, node.end)
    .split(/\r?\n/)
    .map((l, i) => (i && indent && l.startsWith(indent) ? l.slice(indent.length) : l))
    .join('\n');
}

/**
 * Shows the part `name` on game list `target` too (`on`), or takes it off there. The part moves to
 * a `<view>` block naming exactly the screens it's on (made at the end of theme.xml if there's
 * none); a block left empty goes. Null when it can't be done (see alsoOn's `why`).
 */
export function alsoOnChanges(project: ThemeProject, res: Resolution, view: string, name: string, target: string, on: boolean): Change[] | null {
  const def = soleDef(project, res, view, name);
  if (typeof def === 'string') return null;
  const entry = project.entry!;
  const { node, block } = def;
  const now = splitNames(attr(block, 'name'));
  const next = on ? [...new Set([...now, target])] : now.filter((v) => v !== target);
  if (!next.length || next.length === now.length) return null;
  // Keep RetroBat's own order, so the same screens always make the same block name.
  const order = (v: string) => {
    const i = (GAME_LIST_VIEWS as readonly string[]).indexOf(v);
    return i < 0 ? 99 : i;
  };
  next.sort((a, b) => order(a) - order(b));
  const key = [...next].sort().join(',');
  const root = entry.doc.root!;
  const into = root.children.find(
    (c): c is XElement => c.kind === 'element' && c !== block && c.name === 'view' && [...splitNames(attr(c, 'name'))].sort().join(',') === key,
  );
  const markup = markupOf(entry.src, node);
  const rest = block.children.filter((c) => c !== node && !(c.kind === 'text' && !entry.src.slice(c.start, c.end).trim()));
  const body = markup
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n');
  const fresh = `<view name="${next.join(', ')}">\n${body}\n</view>`;
  // Left empty and no block to join: the block itself becomes the new one, where it was.
  if (!rest.length && !into) return [{ file: entry, patch: patchReplaceSpan(entry.doc, block, block, fresh) }];
  const changes: Change[] = [{ file: entry, patch: patchRemoveNode(entry.doc, rest.length ? node : block) }];
  changes.push({ file: entry, patch: into ? patchInsertChild(entry.doc, into, markup) : patchInsertChild(entry.doc, root, fresh) });
  return changes;
}
