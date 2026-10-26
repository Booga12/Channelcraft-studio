// What Simple mode's property cards remember while the app is open: which cards are folded, the
// search, recent colours, a copied look, and each part's settings as they were when first picked
// (for "Back to how it was").

import type { ResolvedElement } from './theme/resolver';

/** The settings each card puts back with "Back to how it was". */
export const CARD_PROPS: Record<string, string[]> = {
  text: ['text', 'fontPath', 'fontSize', 'alignment', 'forceUppercase'],
  colour: ['color', 'glowColor', 'glowSize', 'glowOffset'],
  position: ['pos', 'size', 'maxSize', 'minSize', 'zIndex', 'opacity'],
};

/** The settings "Copy look" takes, per kind of part. */
export const LOOK_PROPS: Record<'text' | 'picture', string[]> = {
  text: ['fontPath', 'fontSize', 'color', 'glowColor', 'glowSize', 'glowOffset', 'forceUppercase', 'alignment', 'lineSpacing'],
  picture: ['color', 'opacity', 'roundCorners', 'saturation'],
};

export interface CopiedLook {
  kind: 'text' | 'picture';
  from: string;
  props: Record<string, string>;
  /** The picture's soft shadow distance, or null for none. */
  shadow: number | null;
}

class SimpleCards {
  /** Cards folded or opened by hand; the rest use their default. */
  open = $state<Record<string, boolean>>({});
  query = $state('');
  recent = $state<string[]>([]);
  copied = $state.raw<CopiedLook | null>(null);
  #first = new Map<string, Record<string, string | null>>();

  /** Remembers a colour picked by hand (RRGGBBAA), newest first. */
  remember(hex: string) {
    this.recent = [hex, ...this.recent.filter((h) => h !== hex)].slice(0, 6);
  }

  /** Notes a part's settings the first time it is picked in a theme and screen. */
  noteFirst(key: string, el: ResolvedElement) {
    if (this.#first.has(key)) return;
    const all = Object.values(CARD_PROPS).flat();
    this.#first.set(key, Object.fromEntries(all.map((p) => [p, el.props.get(p)?.raw ?? null])));
  }

  first(key: string): Record<string, string | null> | undefined {
    return this.#first.get(key);
  }

  /** The card's settings that differ from when the part was first picked. */
  changed(key: string, el: ResolvedElement, card: string): string[] {
    const was = this.#first.get(key);
    if (!was) return [];
    return (CARD_PROPS[card] ?? []).filter((p) => (el.props.get(p)?.raw ?? null) !== was[p]);
  }

  #theme = '';

  /** Forgets everything tied to the theme that was open before. */
  forTheme(dir: string) {
    if (dir === this.#theme) return;
    this.#theme = dir;
    this.#first.clear();
    this.copied = null;
    this.query = '';
  }
}

export const cards = new SimpleCards();
