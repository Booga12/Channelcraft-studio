// Dragging an asset (from the Assets panel or from Explorer) onto an element. Pointer-based, so it
// works alongside Tauri's own file-drop handling, which turns off HTML drag and drop on Windows.

import { ed } from './editor.svelte';
import { prefs } from './prefs.svelte';
import { extname } from './path';
import { dropFit, dropPropLabel, type AssetKind, type DropFit } from './theme/assetDrop';
import { elementLabel, propLabel } from './friendly';

export interface DropTarget {
  element: string;
  /** A property row was hit: only that property. */
  prop?: string;
  fit: DropFit;
  /** Where to draw the highlight, in CSS pixels of the page. */
  rect: { x: number; y: number; w: number; h: number };
}

export interface DragItem {
  path: string;
  kind: AssetKind;
  name: string;
}

const EXT_KIND: Record<string, AssetKind> = {
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.svg': 'image', '.webp': 'image', '.bmp': 'image',
  '.mp4': 'video', '.m4v': 'video', '.mov': 'video', '.mkv': 'video', '.webm': 'video', '.avi': 'video', '.mpg': 'video', '.mpeg': 'video',
  '.wav': 'sound', '.ogg': 'sound', '.mp3': 'sound', '.flac': 'sound',
  '.ttf': 'font', '.otf': 'font',
};

export function kindOfFile(path: string): AssetKind | null {
  return EXT_KIND[extname(path)] ?? null;
}

/** The page's CSS zoom (UI size), so screen points and rects line up with what is drawn. */
const zoom = () => prefs.v.uiScale || 1;

function rectOf(n: Element) {
  const r = n.getBoundingClientRect();
  const z = zoom();
  return { x: r.left / z, y: r.top / z, w: r.width / z, h: r.height / z };
}

/**
 * The element under a point (viewport CSS pixels): a property row, a layer row, or the topmost
 * element in the preview that takes this kind (else the topmost one, to say why it doesn't fit).
 */
export function targetAt(x: number, y: number, kind: AssetKind): DropTarget | null {
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

/** What a drop here will do, for the label by the pointer. */
export function describe(t: DropTarget | null, item: DragItem): string {
  if (!t) return `Drop on an element to use this ${item.kind === 'image' ? 'picture' : item.kind}`;
  if (!t.fit.ok) return t.fit.hint;
  return `Set ${dropPropLabel(t.fit.prop, item.kind, propLabel)} of ${elementLabel(t.element)}${t.fit.note ? ` (${t.fit.note})` : ''}`;
}

class AssetDrag {
  item = $state.raw<DragItem | null>(null);
  /** Pointer position in CSS pixels of the page. */
  x = $state(0);
  y = $state(0);
  target = $state.raw<DropTarget | null>(null);
  /** Files dragged in from Explorer (no single item yet). */
  external = $state(false);

  start(item: DragItem, external = false) {
    this.item = item;
    this.external = external;
    this.target = null;
  }

  /** `cx`, `cy`: viewport point as events report it. */
  move(cx: number, cy: number) {
    if (!this.item) return;
    const z = zoom();
    this.x = cx / z;
    this.y = cy / z;
    this.target = targetAt(cx, cy, this.item.kind);
  }

  cancel() {
    this.item = null;
    this.target = null;
    this.external = false;
  }

  /** Links the item to the element under the pointer, if it fits. Returns whether something was hit. */
  async drop(): Promise<boolean> {
    const item = this.item;
    const t = this.target;
    this.cancel();
    if (!item || !t) return false;
    if (!t.fit.ok) {
      ed.notify(t.fit.hint, 'error');
      return true;
    }
    await ed.linkAsset(item.path, item.kind, t.element, t.prop);
    return true;
  }
}

export const assetDrag = new AssetDrag();
