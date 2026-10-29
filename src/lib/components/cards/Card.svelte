<script lang="ts">
  // One folding card of Simple mode's Properties. Hidden while a search doesn't match it, and
  // opened when one does.
  import type { Component, Snippet } from 'svelte';
  import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
  import { cards } from '$lib/simpleCards.svelte';
  import { cardMatches } from '$lib/theme/simpleProps';

  let {
    id,
    title,
    icon: Icon,
    summary = '',
    words = '',
    openByDefault = true,
    onreset,
    children,
  }: {
    id: string;
    title: string;
    icon: Component;
    summary?: string;
    /** More words a search finds this card by (setting names inside it). */
    words?: string;
    openByDefault?: boolean;
    /** Shown as "Back to how it was" when set. */
    onreset?: (() => void) | null;
    children: Snippet;
  } = $props();

  const q = $derived(cards.query.trim());
  const hit = $derived(!!q && cardMatches(id, q, `${title} ${words}`));
  const open = $derived(q ? hit : (cards.open[id] ?? openByDefault));
</script>

{#if !q || hit}
  <details
    class="card"
    class:hit
    {open}
    ontoggle={(e) => {
      if (!q && e.currentTarget.open !== open) cards.open[id] = e.currentTarget.open;
    }}
  >
    <summary>
      <span class="ic"><Icon size={15} /></span>
      <span class="t">{title}</span>
      {#if summary}<span class="sum" title={summary}>{summary}</span>{/if}
    </summary>
    <div class="body">
      {@render children()}
      {#if onreset}
        <button class="ghost small reset" onclick={onreset} title="Put this card's settings back as they were when you picked this part">
          <RotateCcwIcon size={12} /> Back to how it was
        </button>
      {/if}
    </div>
  </details>
{/if}

<style>
  .card {
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--panel-2);
  }
  .card.hit {
    border-color: var(--brand);
  }
  summary {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
  }
  summary:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: -1px;
    border-radius: 10px;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary::after {
    content: '▾';
    color: var(--text-faint);
    transition: rotate var(--dur) var(--ease-out);
  }
  .card:not([open]) > summary::after {
    rotate: -90deg;
  }
  .ic {
    color: var(--brand);
    display: grid;
    place-items: center;
  }
  .t {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sum {
    margin-left: auto;
    min-width: 0;
    font-weight: 400;
    color: var(--text-faint);
    font-size: 12px;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .body {
    padding: 0 12px 12px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    min-width: 0;
  }
  .reset {
    justify-self: end;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--brand);
    margin-top: -4px;
  }
</style>
