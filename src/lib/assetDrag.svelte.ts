// Dragging an asset (from the Assets panel or from Explorer) into the editor. A picture or video
// dropped on the preview becomes a new element there; with Shift held, or dropped on a layer or a
// property row, it replaces that element's file instead. Pointer-based, so it works alongside
// Tauri's own file-drop handling, which turns off HTML drag and drop on Windows.

import { ed } from './editor.svelte';
import { prefs } from './prefs.svelte';
import { addsAsNew, ASSET_KIND_LABEL, dropFit, dropPropLabel, kindOfFile, type AssetKind, type DropFit } from './theme/assetDrop';
import { elementLabel, propLabel } from './friendly';

export interface DropTarget {
  element: string;
  /** A property row was hit: only that property. */
  prop?: string;
  fit: DropFit;
  /** Where to draw the highlight, in CSS pixels of the page. */
  rect: { x: number; y: number; w: number; h: number };
  /** Add as a new element centred here (0–1 of the screen). `element` is then the one under it, if any. */
  add?: { x: number; y: number };
}

export interface DragItem {
  path: string;
  kind: AssetKind;
  name: string;
}

export { kindOfFile };

/** The page's CSS zoom (UI size), so screen points and rects line up with what is drawn. */
const zoom = () => prefs.v.uiScale || 1;

function rectOf(n: Element) {
  const r = n.getBoundingClientRect();
  const z = zoom();
  return { x: r.left / z, y: r.top / z, w: r.width / z, h: r.height / z };
}

/** Shift is held: a drop on the preview replaces instead of adding. */
let shift = false;
if (typeof window !== 'undefined') {
  const track = (e: KeyboardEvent | PointerEvent) => {
    if (shift === e.shiftKey) return;
    shift = e.shiftKey;
    if (e instanceof KeyboardEvent) assetDrag.refresh();
  };
  window.addEventListener('keydown', track, true);
  window.addEventListener('keyup', track, true);
  window.addEventListener('pointermove', track, true);
  window.addEventListener('blur', () => (shift = false));
}

/** The element in the preview under a point that takes this kind (else the topmost one, to say why not). */
function previewElementAt(stack: Element[], kind: AssetKind): DropTarget | null {
  const view = ed.currentView;
  if (!view) return null;
  const seen = new Set<string>();
  let first: DropTarget | null = null;
  for (const n of stack) {
    const hit = (n as HTMLElement).closest?.<HTMLElement>('.stage .el[data-name]');
    const name = hit?.dataset.name;
    if (!hit || !name || seen.has(name) || ed.locked[name] || ed.hidden[name]) continue;
    seen.add(name);
    const el = view.elements.get(name);
    if (!el) continue;
    const t: DropTarget = { element: name, fit: dropFit(el.type, el.name, kind), rect: rectOf(hit) };
    if (t.fit.ok) return t;
    first ??= t;
  }
  return first;
}

/**
 * What a drop at a point (viewport CSS pixels) does: a property row or layer row sets that
 * element's file; on the preview a picture or video is added as a new element (Shift: replaces
 * the element under it); a sound or font goes on the element under it.
 */
export function targetAt(x: number, y: number, kind: AssetKind, replace = shift): DropTarget | null {
  const view = ed.currentView;
  if (!view) return null;
  const stack = document.elementsFromPoint(x, y);
  const top = stack[0] as HTMLElement | undefined;
  const propRow = top?.closest<HTMLElement>('[data-asset-prop]');
  if (propRow) {
    const el = view.elements.get(propRow.dataset.assetElement ?? '');
    if (el) return { element: el.name, prop: propRow.dataset.assetProp, fit: dropFit(el.type, el.name, kind, propRow.dataset.assetProp), rect: rectOf(propRow) };
  }
  const layer = top?.closest<HTMLElement>('[data-layer]');
  if (layer) {
    const el = view.elements.get(layer.dataset.layer ?? '');
    if (el) return { element: el.name, fit: dropFit(el.type, el.name, kind), rect: rectOf(layer) };
  }
  const under = previewElementAt(stack, kind);
  const stage = stack.find((n) => n.classList?.contains('stage'));
  if (!addsAsNew(kind) || replace || !stage) return under;
  // Adding: centred on the pointer, in a box the size the new element will fit in.
  const r = stage.getBoundingClientRect();
  const at = { x: (x - r.left) / r.width, y: (y - r.top) / r.height };
  const box = kind === 'image' ? 0.3 : 0.4;
  const cx = Math.min(1 - box / 2, Math.max(box / 2, at.x));
  const cy = Math.min(1 - box / 2, Math.max(box / 2, at.y));
  const s = rectOf(stage);
  const rect = { x: s.x + (cx - box / 2) * s.w, y: s.y + (cy - box / 2) * s.h, w: box * s.w, h: box * s.h };
  return { element: under?.fit.ok ? under.element : '', fit: { ok: true, prop: 'path' }, rect, add: at };
}

/** What a drop here will do, for the label by the pointer. */
export function describe(t: DropTarget | null, item: DragItem, count = 1): string {
  const what = ASSET_KIND_LABEL[item.kind];
  if (t?.add) {
    const adding = count > 1 ? `Add ${count} new layers here` : `Add as a new ${what} here`;
    return t.element ? `${adding} · hold Shift to replace ${elementLabel(t.element)}` : adding;
  }
  if (!t) return addsAsNew(item.kind) ? `Drop on the preview to add this ${what}` : `Drop on an element to use this ${what}`;
  if (!t.fit.ok) return t.fit.hint;
  return `Replace ${dropPropLabel(t.fit.prop, item.kind, propLabel)} of ${elementLabel(t.element)}${t.fit.note ? ` (${t.fit.note})` : ''}`;
}

class AssetDrag {
  item = $state.raw<DragItem | null>(null);
  /** Pointer position in CSS pixels of the page. */
  x = $state(0);
  y = $state(0);
  target = $state.raw<DropTarget | null>(null);
  /** Files dragged in from Windows Explorer (no single item yet). */
  external = $state(false);
  /** Every file being dragged, when it's more than the one item (ticked files in the Explorer tab). */
  paths = $state.raw<string[]>([]);

  start(item: DragItem, external = false, paths: string[] = []) {
    this.item = item;
    this.external = external;
    this.paths = paths;
    this.target = null;
  }

  /** `cx`, `cy`: viewport point as events report it. */
  private cx = 0;
  private cy = 0;

  move(cx: number, cy: number) {
    if (!this.item) return;
    this.cx = cx;
    this.cy = cy;
    const z = zoom();
    this.x = cx / z;
    this.y = cy / z;
    this.target = targetAt(cx, cy, this.item.kind);
  }

  /** Looks again at what's under the pointer (Shift pressed or let go). */
  refresh() {
    if (this.item) this.move(this.cx, this.cy);
  }

  cancel() {
    this.item = null;
    this.target = null;
    this.external = false;
    this.paths = [];
  }

  /**
   * Adds the item (or all `paths`, from Explorer) as new elements, or links it to the element under
   * the pointer. Returns whether something was hit.
   */
  async drop(paths?: string[], placed?: string[]): Promise<boolean> {
    const item = this.item;
    const t = this.target;
    const many = paths?.length ? paths : this.paths;
    this.cancel();
    if (!item || !t) return false;
    if (!t.fit.ok) {
      ed.notify(t.fit.hint, 'error');
      return true;
    }
    if (t.add) {
      const files = (many.length ? many : [item.path]).map((path) => ({ path, kind: kindOfFile(path) })).filter((f): f is { path: string; kind: AssetKind } => !!f.kind);
      await ed.addAssets(files, t.add, placed);
      return true;
    }
    await ed.linkAsset(item.path, item.kind, t.element, t.prop);
    return true;
  }
}

export const assetDrag = new AssetDrag();
