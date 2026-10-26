<script lang="ts" generics="T extends string">
  // A row of buttons where one is chosen (a segmented control).
  import type { Component } from 'svelte';

  let {
    options,
    value,
    onpick,
    label,
  }: {
    options: { id: T; label: string; icon?: Component; title?: string }[];
    value: T | null;
    onpick: (id: T) => void;
    label: string;
  } = $props();
</script>

<div class="seg" role="radiogroup" aria-label={label}>
  {#each options as o (o.id)}
    <button role="radio" aria-checked={o.id === value} class:on={o.id === value} title={o.title ?? o.label} onclick={() => onpick(o.id)}>
      {#if o.icon}<o.icon size={14} />{/if}
      {#if !o.icon}{o.label}{/if}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: flex;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    padding: 2px;
    gap: 2px;
  }
  .seg button {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    padding: 4px 4px;
    border-radius: 6px;
    color: var(--text-dim);
    font-size: 12px;
    display: inline-flex;
    justify-content: center;
    align-items: center;
  }
  .seg button:hover:not(.on) {
    background: var(--hover);
  }
  .seg button.on {
    background: var(--brand-strong);
    color: #fff;
  }
</style>
