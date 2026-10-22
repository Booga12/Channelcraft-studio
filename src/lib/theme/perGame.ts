// Writing a game's own look: RetroBat's per-game files (see PerGameInfo in resolver.ts). The theme
// gets one <gameextras> element per game-list screen, pointing at games/<console>/, and each game's
// changes go to games/<console>/<rom name>/theme.xml, as partial element definitions RetroBat lays
// over the theme while that game is in focus.

import { applyPatch, attr, elements, parse, patchInsertChild, type XElement } from '../xml/cst';
import { dirname, join, relative } from '../path';
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

/**
 * Theme variables that are true only while a game has no file of its own, such as Hyperbat's
 * `!exists(".../" + stem({game:rom}) + "/theme.xml")`. Shared default looks use them to hide parts
 * once a game has its own file.
 */
export function ownFileGuards(res: Resolution): string[] {
  return [...res.vars.values()].filter((v) => /!\s*exists\s*\(/i.test(v.raw) && /stem\(\s*\{game:(rom|path)\}\s*\)|\{game:stem\}/i.test(v.raw)).map((v) => v.name);
}

/**
 * A game's own file made from a shared default look, so the game looks the same until it is
 * changed: relative paths are rewritten for the new folder, and own-file guards (see
 * ownFileGuards) become `true`, since the parts they hide are now this game's own.
 */
export function copyOfShared(src: string, fromDir: string, toDir: string, guards: string[]): string {
  let out = src;
  for (const g of guards) out = out.split('${' + g + '}').join('true');
  const rebase = (p: string) => relative(toDir, join(fromDir, p));
  // Paths as element text (<path>./x.png</path>, <include>./theme.xml</include>) and in quoted
  // expression strings ("./x.png"). ~/ and absolute paths stay as they are.
  out = out.replace(/>(\s*)(\.\.?\/[^<]*?)(\s*)</g, (_m, a: string, p: string, b: string) => `>${a}${rebase(p)}${b}<`);
  out = out.replace(/"(\.\.?\/[^"<>]*)"/g, (m, p: string, offset: number) => (/=\s*$/.test(out.slice(Math.max(0, offset - 3), offset)) ? m : `"${rebase(p)}"`));
  const note = `<!-- This game's own look, made by ChannelCraft Studio from ${relative(toDir, fromDir)}/ (a copy, so changes here affect only this game). -->`;
  const at = out.search(/<theme[\s>]/);
  return at < 0 ? out : `${out.slice(0, at)}${note}\n${out.slice(at)}`;
}

/** Applies changes computed on `src` (as gameEditChanges returns them) and returns the new text. */
export function applyToText(src: string, changes: Change[]): string {
  return changes
    .map((c) => c.patch)
    .sort((a, b) => b.start - a.start)
    .reduce((text, p) => applyPatch(text, p), src);
}

/** A stand-in file for computing edits on text that isn't in the project yet. */
export function draftFile(file: ThemeFile, src: string): ThemeFile {
  return { ...file, src, doc: parse(src) };
}

/** Whether a game file has nothing in it (so it needn't be written). */
export function isEmptyGameFile(file: ThemeFile): boolean {
  return !!file.doc.root && file.doc.root.name === 'theme' && elements(file.doc.root).length === 0;
}
