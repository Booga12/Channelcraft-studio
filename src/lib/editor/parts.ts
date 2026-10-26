// Copy, paste, duplicate, rename and delete elements, select them, and move, line up and layer them.
// Part of the editor (editor.svelte.ts): each function is a method of the editor (`this`),
// attached to it there, so callers use ed.<name>(...).

import type { Editor } from '../editor.svelte';
import { addElementChange, type Change } from '../theme/edits';
import { consoleScreenPath, NATIVE_BINDINGS } from '../theme/library';
import { dirname, join, relative } from '../path';
import { elementLabel } from '../friendly';
import { patchRemoveNode, patchSetAttr } from '../xml/cst';
import { fmtNum, parsePair } from '../theme/schema';
import { reorder, zIndexFor } from '../theme/layers';
import { zOf } from '../render';

/** Properties of an element as written, with relative paths made relative to theme.xml. */
export function snapshotElement(this: Editor, name: string) {
  const el = this.currentView?.elements.get(name);
  const p = this.project;
  if (!el || !p) return null;
  const props: Record<string, string> = {};
  for (const [k, def] of el.props) {
    let v = def.raw;
    if (/^\.\.?\//.test(def.value.trim()) && !v.includes('${')) v = relative(p.dir, join(dirname(def.file.abs), def.value.trim()));
    props[k] = v;
  }
  // RetroBat's own artwork elements become regular elements that read the same data.
  const binding = NATIVE_BINDINGS[name];
  if (binding && !props[binding.prop]) props[binding.prop] = binding.value;
  return { type: el.type, name: el.name, props };
}

export function copy(this: Editor) {
  const items = this.selection.map((n) => this.snapshotElement(n)).filter((x): x is NonNullable<typeof x> => !!x);
  if (!items.length) return;
  this.clipboard = items;
  this.notify(`Copied ${items.length === 1 ? elementLabel(items[0].name) : `${items.length} elements`}`);
}

/** Pastes copies a little down and to the right, as new elements on this screen. */
export function paste(this: Editor, offset = 0.02) {
  const p = this.project;
  const res = this.res;
  if (!p || !res || !this.clipboard.length) return;
  const changes: Change[] = [];
  const names: string[] = [];
  const used = new Set(this.currentView?.elements.keys() ?? []);
  for (const item of this.clipboard) {
    const base = item.name.replace(/^md_/, '').replace(/\d+$/, '') || item.type;
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base}${i}`;
    used.add(name);
    const props = { ...item.props };
    // The console screen has no current game: game artwork becomes a random game's (as RetroBat offers there).
    if (this.view === 'system' && props.path) props.path = consoleScreenPath(item.type, props.path) ?? props.path;
    const pos = parsePair(props.pos);
    if (pos) props.pos = `${fmtNum(Math.round((pos[0] + offset) * 1000) / 1000)} ${fmtNum(Math.round((pos[1] + offset) * 1000) / 1000)}`;
    const body = Object.entries(props)
      .map(([k, v]) => `<${k}>${v.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</${k}>`)
      .join('\n');
    changes.push(addElementChange(p, res, this.view, item.type, name, body));
    names.push(name);
  }
  this.commit(names.length === 1 ? `pasting ${elementLabel(names[0])}` : `pasting ${names.length} elements`, changes);
  this.selection = names;
}

export function duplicate(this: Editor) {
  const saved = this.clipboard;
  this.copy();
  this.paste();
  this.clipboard = saved;
}

/** Renames an element of this theme (RetroBat's own elements keep their names). */
export function rename(this: Editor, name: string, next: string) {
  const el = this.currentView?.elements.get(name);
  const clean = next.trim().replace(/[^\w-]+/g, '-');
  if (!el || !clean || clean === name) return;
  if (!el.extra) {
    this.notify('RetroBat’s own elements keep their names, so RetroBat can fill them in', 'error');
    return;
  }
  if (this.currentView?.elements.has(clean)) {
    this.notify(`There's already an element called “${clean}” on this screen`, 'error');
    return;
  }
  const changes: Change[] = [];
  const seen = new Set<string>();
  for (const d of el.defs) {
    const id = `${d.file.key}:${d.node.start}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const names = (d.node.attrs.find((a) => a.name === 'name')?.value ?? '').split(',').map((s) => s.trim());
    changes.push({ file: d.file, patch: patchSetAttr(d.file.doc, d.node, 'name', names.map((n) => (n === name ? clean : n)).join(', ')) });
  }
  this.commit(`renaming to ${clean}`, changes);
  this.selected = clean;
}

/** Sets several properties of one element as a single undo step. */
export function setProps(this: Editor, elementName: string, props: Record<string, string>, coalesce?: string) {
  if (this.gameEditing) return void this.gameSetMany(`changes to ${elementLabel(elementName)}`, { [elementName]: props }, coalesce);
  this.commit(`changes to ${elementLabel(elementName)}`, this.propChanges(elementName, props), coalesce);
}

/** Sets properties on several elements at once (group moves, align, distribute). */
export function setPropsMany(this: Editor, label: string, updates: Record<string, Record<string, string>>, coalesce?: string) {
  if (this.gameEditing) return void this.gameSetMany(label, updates, coalesce);
  const changes = Object.entries(updates).flatMap(([name, props]) => this.propChanges(name, props));
  this.commit(label, changes, coalesce);
}

/** Moves every selected element by (dx, dy) screen fractions from the given start positions. */
export function moveSelection(this: Editor, start: Record<string, [number, number]>, dx: number, dy: number, coalesce: string) {
  const r = (n: number) => String(Math.round(n * 1000) / 1000);
  const updates: Record<string, Record<string, string>> = {};
  for (const [name, [x, y]] of Object.entries(start)) updates[name] = { pos: `${r(x + dx)} ${r(y + dy)}` };
  this.setPropsMany(this.selection.length > 1 ? `moving ${this.selection.length} elements` : `position of ${elementLabel(this.selected ?? '')}`, updates, coalesce);
}

export function nudge(this: Editor, dx: number, dy: number) {
  const start: Record<string, [number, number]> = {};
  for (const n of this.selection) {
    const el = this.currentView?.elements.get(n);
    if (el && !this.locked[n]) start[n] = parsePair(el.props.get('pos')?.value) ?? [0, 0];
  }
  if (Object.keys(start).length) this.moveSelection(start, dx, dy, `nudge.${this.selection.join(',')}`);
}

/** Aligns the selection (one element: to the screen; several: to each other). */
export function align(this: Editor, mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') {
  const names = this.selection.filter((n) => this.rects[n] && !this.locked[n]);
  if (!names.length) return;
  const rs = names.map((n) => this.rects[n]);
  const toScreen = names.length === 1;
  const minX = toScreen ? 0 : Math.min(...rs.map((r) => r.x));
  const maxX = toScreen ? 1 : Math.max(...rs.map((r) => r.x + r.w));
  const minY = toScreen ? 0 : Math.min(...rs.map((r) => r.y));
  const maxY = toScreen ? 1 : Math.max(...rs.map((r) => r.y + r.h));
  const updates: Record<string, Record<string, string>> = {};
  for (const n of names) {
    const el = this.currentView!.elements.get(n)!;
    const r = this.rects[n];
    const [x, y] = parsePair(el.props.get('pos')?.value) ?? [0, 0];
    let nx = x;
    let ny = y;
    if (mode === 'left') nx = x + (minX - r.x);
    if (mode === 'right') nx = x + (maxX - (r.x + r.w));
    if (mode === 'hcenter') nx = x + ((minX + maxX) / 2 - (r.x + r.w / 2));
    if (mode === 'top') ny = y + (minY - r.y);
    if (mode === 'bottom') ny = y + (maxY - (r.y + r.h));
    if (mode === 'vcenter') ny = y + ((minY + maxY) / 2 - (r.y + r.h / 2));
    updates[n] = { pos: `${fmtNum(Math.round(nx * 1000) / 1000)} ${fmtNum(Math.round(ny * 1000) / 1000)}` };
  }
  this.setPropsMany('align', updates);
}

/** Spaces three or more selected elements evenly. */
export function distribute(this: Editor, axis: 'h' | 'v') {
  const names = this.selection.filter((n) => this.rects[n] && !this.locked[n]);
  if (names.length < 3) {
    this.notify('Select three or more elements to space them evenly');
    return;
  }
  const key = axis === 'h' ? 'x' : 'y';
  const size = axis === 'h' ? 'w' : 'h';
  const sorted = [...names].sort((a, b) => this.rects[a][key] - this.rects[b][key]);
  const first = this.rects[sorted[0]];
  const last = this.rects[sorted[sorted.length - 1]];
  const total = sorted.reduce((s, n) => s + this.rects[n][size], 0);
  const gap = (last[key] + last[size] - first[key] - total) / (sorted.length - 1);
  let cursor = first[key];
  const updates: Record<string, Record<string, string>> = {};
  for (const n of sorted) {
    const r = this.rects[n];
    const el = this.currentView!.elements.get(n)!;
    const [x, y] = parsePair(el.props.get('pos')?.value) ?? [0, 0];
    const d = cursor - r[key];
    updates[n] = { pos: axis === 'h' ? `${fmtNum(Math.round((x + d) * 1000) / 1000)} ${fmtNum(y)}` : `${fmtNum(x)} ${fmtNum(Math.round((y + d) * 1000) / 1000)}` };
    cursor += r[size] + gap;
  }
  this.setPropsMany('distribute', updates);
}

/** Layer order: 'front', 'back', or one step 'forward' / 'backward'. */
export function arrange(this: Editor, how: 'front' | 'back' | 'forward' | 'backward') {
  const v = this.currentView;
  if (!v || !this.selection.length) return;
  const all = [...v.elements.values()].map((e) => ({ name: e.name, z: zOf(e) }));
  const zs = all.map((a) => a.z);
  const updates: Record<string, Record<string, string>> = {};
  for (const n of this.selection) {
    const el = v.elements.get(n);
    if (!el) continue;
    const z = zOf(el);
    let nz = z;
    if (how === 'front') nz = Math.max(...zs) + 1;
    if (how === 'back') nz = Math.max(0, Math.min(...zs) - 1);
    if (how === 'forward') nz = (zs.filter((x) => x > z).sort((a, b) => a - b)[0] ?? z) + 1;
    if (how === 'backward') nz = Math.max(0, (zs.filter((x) => x < z).sort((a, b) => b - a)[0] ?? z) - 1);
    updates[n] = { zIndex: String(nz) };
  }
  this.setPropsMany('layer order', updates);
}

/**
 * Moves layers (Layers panel drag and drop) so they sit just above `before`, or at the bottom
 * when it's null, keeping their own order. One undo step.
 */
export function moveLayers(this: Editor, names: string[], before: string | null) {
  const layers = this.layers.map((e) => ({ name: e.name, z: zOf(e) }));
  const moving = layers.filter((l) => names.includes(l.name)).map((l) => l.name);
  if (!moving.length || (before !== null && moving.includes(before))) return;
  const order = reorder(layers, moving, before);
  if (order.every((l, i) => l.name === layers[i].name)) return;
  const z = zIndexFor(order, new Set(moving));
  const updates = Object.fromEntries(Object.entries(z).map(([n, v]) => [n, { zIndex: String(v) }]));
  this.setPropsMany(moving.length > 1 ? `layer order of ${moving.length} layers` : `layer order of ${elementLabel(moving[0])}`, updates);
}

/** Removes the definitions that belong to this element alone; shared blocks are left alone. */
export function deleteElement(this: Editor, elementName: string): { removed: number; kept: number } {
  const el = this.currentView?.elements.get(elementName);
  if (!el) return { removed: 0, kept: 0 };
  const own = el.defs.filter((d) => {
    const names = (d.node.attrs.find((a) => a.name === 'name')?.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const parentNames = (d.node.parent?.attrs.find((a) => a.name === 'name')?.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return names.length <= 1 && parentNames.length === 1 && parentNames[0] === this.view;
  });
  const unique = [...new Map(own.map((d) => [`${d.file.key}:${d.node.start}`, d])).values()];
  if (unique.length) {
    this.commit(
      `delete ${elementName}`,
      unique.map((d) => ({ file: d.file, patch: patchRemoveNode(d.file.doc, d.node) })),
    );
    this.selected = null;
  }
  return { removed: unique.length, kept: el.defs.length - unique.length };
}

/** Deletes every selected element's own definitions in one undo step. */
export function deleteSelection(this: Editor) {
  const v = this.currentView;
  if (!v || !this.selection.length) return;
  if (this.gameEditing) {
    // Parts only this game has are deleted; shared ones are hidden for this game.
    const own = this.gameFile;
    const mine = this.selection.filter((n) => own && v.elements.get(n)?.defs.every((d) => d.file === own));
    const hide = this.selection.filter((n) => !mine.includes(n));
    if (hide.length) this.gameSetMany(`hiding ${hide.length === 1 ? elementLabel(hide[0]) : `${hide.length} elements`}`, Object.fromEntries(hide.map((n) => [n, { visible: 'false' }])));
    if (!mine.length) return;
    this.selection = mine;
  }
  const changes: Change[] = [];
  const seen = new Set<string>();
  let kept = 0;
  for (const name of this.selection) {
    const el = v.elements.get(name);
    if (!el) continue;
    for (const d of el.defs) {
      const names = (d.node.attrs.find((a) => a.name === 'name')?.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const parentNames = (d.node.parent?.attrs.find((a) => a.name === 'name')?.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const own = names.length <= 1 && parentNames.length === 1 && parentNames[0] === this.view;
      const id = `${d.file.key}:${d.node.start}`;
      if (!own) {
        kept++;
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      changes.push({ file: d.file, patch: patchRemoveNode(d.file.doc, d.node) });
    }
  }
  if (!changes.length) {
    this.notify('These elements are shared with other screens, so they can’t be deleted here. Hide them instead.', 'error');
    return;
  }
  this.commit(this.selection.length > 1 ? `deleting ${this.selection.length} elements` : `deleting ${elementLabel(this.selection[0])}`, changes);
  this.selection = [];
  if (kept) this.notify(`Deleted. ${kept} shared definition(s) were kept; hide those if needed.`);
}

export function selectAll(this: Editor) {
  const v = this.currentView;
  if (!v) return;
  this.selection = [...v.elements.keys()].filter((n) => !this.locked[n] && this.rects[n] && !(this.rects[n].w > 0.98 && this.rects[n].h > 0.98));
}
