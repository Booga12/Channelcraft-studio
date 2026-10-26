<script lang="ts" module>
  export interface MenuItem {
    label?: string;
    shortcut?: string;
    action?: () => void;
    disabled?: boolean;
    danger?: boolean;
    separator?: true;
  }
</script>

<script lang="ts">
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

  function run(it: MenuItem) {
    if (it.disabled || !it.action) return;
    onclose();
    it.action();
  }
</script>

<svelte:window onpointerdown={(e) => !el?.contains(e.target as Node) && onclose()} onkeydown={(e) => e.key === 'Escape' && onclose()} onblur={onclose} />

<div
  class="ui-new fixed z-50 min-w-48 origin-top-left animate-in rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-elev-3 ring-1 ring-foreground/10 duration-100 fade-in-0 zoom-in-95"
  role="menu"
  tabindex="-1"
  bind:this={el}
  use:portal
  style:max-height="{maxH || 9999}px"
  style:overflow-y="auto"
  style:left="{pos.x}px"
  style:top="{pos.y}px"
>
  {#each items as it}
    {#if it.separator}
      <div class="-mx-1 my-1 h-px bg-border"></div>
    {:else}
      <button
        class="flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50 {it.danger ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : ''}"
        role="menuitem"
        disabled={it.disabled}
        onclick={() => run(it)}
      >
        <span class="flex-1">{it.label}</span>
        {#if it.shortcut}<span class="ml-auto text-xs tracking-widest text-muted-foreground">{it.shortcut}</span>{/if}
      </button>
    {/if}
  {/each}
</div>
