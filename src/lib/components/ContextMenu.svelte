<script lang="ts" module>
  export interface MenuItem {
    label?: string;
    shortcut?: string;
    action?: () => void;
    disabled?: boolean;
    danger?: boolean;
    separator?: true;
  }

  /** Where to open a menu for a contextmenu event: the pointer, or (opened from the keyboard with
   * the menu key or Shift+F10) just under the element it was opened on. */
  export function menuPoint(e: MouseEvent): { x: number; y: number } {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    return inside && (e.clientX || e.clientY) ? { x: e.clientX, y: e.clientY } : { x: r.left + 8, y: r.bottom };
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  // Right-click menu, kept inside the window. It is moved to the end of the page, so a panel it
  // opens from (whose blur or transform would hold fixed elements) can't cut it off.
  let { x, y, items, onclose }: { x: number; y: number; items: MenuItem[]; onclose: () => void } = $props();

  let el: HTMLDivElement;
  let pos = $state({ x: 0, y: 0 });
  let maxH = $state(0);

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  $effect(() => {
    // x and y are window points; the page may be zoomed (UI size), so styles use x / zoom.
    const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const r = el.getBoundingClientRect();
    const m = 6;
    maxH = (window.innerHeight - 2 * m) / z;
    const h = Math.min(r.height, window.innerHeight - 2 * m);
    const px = Math.max(m, Math.min(x, window.innerWidth - r.width - m));
    const py = Math.max(m, Math.min(y, window.innerHeight - h - m));
    pos = { x: px / z, y: py / z };
  });

  // Keyboard: the menu opens with its first item focused; Up/Down (Home/End) move, Enter runs,
  // Escape (or Tab) closes and gives focus back to what had it before.
  let opener: HTMLElement | null = null;
  onMount(() => {
    const a = document.activeElement;
    opener = a instanceof HTMLElement && a !== document.body ? a : null;
    itemsEls()[0]?.focus({ preventScroll: true });
  });

  const itemsEls = () => [...el.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')];

  function restoreFocus() {
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }

  function onkeydown(e: KeyboardEvent) {
    // Only the menu's own keys stop here (arrows would also move the selection); others, like
    // Delete or Ctrl+Z, still reach the editor's shortcuts.
    const list = itemsEls();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    const go = (n: number) => {
      e.preventDefault();
      e.stopPropagation();
      list[(n + list.length) % list.length]?.focus();
    };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i < 0 ? -1 : i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(-1);
    else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      restoreFocus();
      onclose();
    } else if (e.key === 'Enter' || e.key === ' ') {
      // The focused item's own click runs it.
      e.stopPropagation();
    }
  }

  /** Escape closes the menu wherever focus is, before the editor sees it (it would clear the selection). */
  function onescape(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    restoreFocus();
    onclose();
  }

  function run(it: MenuItem) {
    if (it.disabled || !it.action) return;
    // Focus goes back first, so an action that moves focus itself (a rename field) keeps it.
    restoreFocus();
    onclose();
    it.action();
  }
</script>

<svelte:window
  onpointerdown={(e) => !el?.contains(e.target as Node) && onclose()}
  onkeydowncapture={onescape}
  onblur={onclose}
/>

<div
  class="ui-new fixed z-50 min-w-48 origin-top-left animate-in rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-elev-3 ring-1 ring-foreground/10 duration-100 fade-in-0 zoom-in-95"
  role="menu"
  tabindex="-1"
  data-own-keys
  {onkeydown}
  bind:this={el}
  use:portal
  style:max-height="{maxH || 9999}px"
  style:overflow-y="auto"
  style:left="{pos.x}px"
  style:top="{pos.y}px"
>
  {#each items as it}
    {#if it.separator}
      <div class="-mx-1 my-1 h-px bg-border" role="separator"></div>
    {:else}
      <button
        class="flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50 {it.danger ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : ''}"
        role="menuitem"
        tabindex="-1"
        disabled={it.disabled}
        onclick={() => run(it)}
      >
        <span class="flex-1">{it.label}</span>
        {#if it.shortcut}<span class="ml-auto text-xs tracking-widest text-muted-foreground">{it.shortcut}</span>{/if}
      </button>
    {/if}
  {/each}
</div>
