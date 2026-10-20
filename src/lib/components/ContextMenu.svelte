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
  // Right-click menu, kept inside the window.
  let { x, y, items, onclose }: { x: number; y: number; items: MenuItem[]; onclose: () => void } = $props();

  let el: HTMLDivElement;
  let pos = $state({ x: 0, y: 0 });

  $effect(() => {
    const r = el.getBoundingClientRect();
    pos = { x: Math.min(x, window.innerWidth - r.width - 6), y: Math.min(y, window.innerHeight - r.height - 6) };
  });

  function run(it: MenuItem) {
    if (it.disabled || !it.action) return;
    onclose();
    it.action();
  }
</script>

<svelte:window onpointerdown={(e) => !el?.contains(e.target as Node) && onclose()} onkeydown={(e) => e.key === 'Escape' && onclose()} onblur={onclose} />

<div class="ctx" role="menu" tabindex="-1" bind:this={el} style:left="{pos.x}px" style:top="{pos.y}px">
  {#each items as it}
    {#if it.separator}
      <div class="sep"></div>
    {:else}
      <button class="item" class:danger={it.danger} role="menuitem" disabled={it.disabled} onclick={() => run(it)}>
        <span>{it.label}</span>
        {#if it.shortcut}<kbd>{it.shortcut}</kbd>{/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .ctx {
    position: fixed;
    z-index: 600;
    min-width: 210px;
    background: #2f2f2f;
    border: 1px solid #424242;
    border-radius: 7px;
    padding: 4px 0;
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.55);
    animation: pop 0.08s ease-out;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.98);
    }
  }
  .item {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 16px;
    background: transparent;
    border-radius: 0;
    padding: 5px 14px;
    text-align: left;
  }
  .item:hover:not(:disabled) {
    background: var(--accent-strong);
    color: #fff;
  }
  .item.danger:hover:not(:disabled) {
    background: var(--danger);
  }
  kbd {
    font: inherit;
    font-size: 11px;
    color: var(--text-faint);
  }
  .item:hover kbd {
    color: #fff;
  }
  .sep {
    height: 1px;
    background: #444;
    margin: 4px 0;
  }
</style>
