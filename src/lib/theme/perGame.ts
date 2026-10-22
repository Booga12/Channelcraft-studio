// Writing a game's own look: RetroBat's per-game files (see PerGameInfo in resolver.ts). The theme
// gets one <gameextras> element per game-list screen, pointing at games/<console>/, and each game's
// changes go to games/<console>/<rom name>/theme.xml, as partial element definitions RetroBat lays
// over the theme while that game is in focus.

import { attr, elements, patchInsertChild, type XElement } from '../xml/cst';
import { setTextChange, type Change } from './edits';
import type { ThemeFile } from './project';
import { isGameListView, splitNames, type Resolution } from './resolver';

/** Folder written into new <gameextras> elements, relative to theme.xml. */
export const GAMES_PATH = './games/${system.name}';

export const EMPTY_GAME_FILE = '<theme>\n</theme>\n';

export interface GameEdit {
  name: string;
  type: string;
  props: Record<string, string>;
  /** A new element only this game has (written with extra="true"). */
  extra?: boolean;
  /** Extra markup for a new element (e.g. a starter body), used when the element isn't in the file yet. */
  body?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;');

/** The game-list screens of a theme that have no <gameextras> yet. */
export function screensWithoutGameExtras(res: Resolution): string[] {
  return [...res.views.keys()].filter((v) => isGameListView(res, v) && !res.views.get(v)!.elements.has('gameextras'));
}

/** Adds <gameextras> to those screens, at the end of theme.xml so it comes after everything else. */
export function gameExtrasChange(entry: ThemeFile, views: string[]): Change | null {
  if (!views.length || !entry.doc.root) return null;
  const xml = `<view name="${escAttr(views.join(', '))}">\n  <gameextras name="gameextras">\n    <path>${esc(GAMES_PATH)}</path>\n  </gameextras>\n</view>`;
  return { file: entry, patch: patchInsertChild(entry.doc, entry.doc.root, xml) };
}

function lastWhere(parent: XElement, ok: (e: XElement) => boolean): XElement | undefined {
  return elements(parent).filter(ok).pop();
}

const noCondition = (e: XElement) => !e.attrs.some((a) => a.name.startsWith('if') || a.name === 'lang' || a.name === 'region');

function elementMarkup(e: GameEdit): string {
  const props = Object.entries(e.props).map(([k, v]) => `<${k}>${esc(v)}</${k}>`);
  const body = [...(e.body ? e.body.split('\n') : []), ...props].map((l) => '  ' + l).join('\n');
  return `<${e.type} name="${escAttr(e.name)}"${e.extra ? ' extra="true"' : ''}>\n${body}\n</${e.type}>`;
}

/**
 * Changes that set properties in a game's own file: an existing value is replaced, a missing one
 * added to the element, a missing element added to the screen's <view>, a missing <view> added.
 */
export function gameEditChanges(file: ThemeFile, view: string, edits: GameEdit[], opts: { prelude?: string[]; custom?: boolean } = {}): Change[] {
  const prelude = opts.prelude ?? [];
  const root = file.doc.root;
  if (!root || !edits.length) return [];
  const doc = file.doc;
  const viewNode = lastWhere(root, (e) => (e.name === 'view' || e.name === 'customView') && noCondition(e) && splitNames(attr(e, 'name')).join() === view);
  const changes: Change[] = [];
  const newElements: string[] = [];
  // RetroBat themes (and their per-game files) name custom screens with <customView>.
  const tag = opts.custom ? 'customView' : 'view';
  for (const e of edits) {
    const node = viewNode && lastWhere(viewNode, (c) => noCondition(c) && splitNames(attr(c, 'name')).includes(e.name));
    if (!node) {
      newElements.push(elementMarkup(e));
      continue;
    }
    const add: string[] = [];
    for (const [prop, value] of Object.entries(e.props)) {
      const p = lastWhere(node, (c) => c.name === prop && noCondition(c));
      if (p) changes.push(setTextChange(file, p, value));
      else add.push(`<${prop}>${esc(value)}</${prop}>`);
    }
    if (add.length) changes.push({ file, patch: patchInsertChild(doc, node, add.join('\n')) });
  }
  if (newElements.length) {
    const xml = newElements.join('\n');
    if (viewNode) changes.push({ file, patch: patchInsertChild(doc, viewNode, xml) });
    else changes.push({ file, patch: patchInsertChild(doc, root, [...prelude, `<${tag} name="${escAttr(view)}">\n${xml.split('\n').map((l) => '  ' + l).join('\n')}\n</${tag}>`].join('\n')) });
  }
  return changes;
}

/** Whether a game file has nothing in it (so it needn't be written). */
export function isEmptyGameFile(file: ThemeFile): boolean {
  return !!file.doc.root && file.doc.root.name === 'theme' && elements(file.doc.root).length === 0;
}
