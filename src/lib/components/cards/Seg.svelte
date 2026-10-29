<script lang="ts" generics="T extends string">
  // A row of buttons where one is chosen (a segmented control).
  import type { Component } from 'svelte';

  let {
    options,
    value,
    onpick,
    label,
    followFocus = true,
  }: {
    options: { id: T; label: string; icon?: Component; title?: string }[];
    value: T | null;
    onpick: (id: T) => void;
    label: string;
    /** False when picking undoes work (the arrow keys then only move; Enter or Space picks). */
    followFocus?: boolean;
  } = $props();

  let box: HTMLDivElement;
  // One Tab stop (the chosen option, or the first); the arrow keys move along and choose, as radios do
  // (or only move, without followFocus).
  const stop = $derived(Math.max(0, options.findIndex((o) => o.id === value)));

  function onkeydown(e: KeyboardEvent, i: number) {
    const n = options.length;
    const k = e.key;
    const j = k === 'ArrowRight' || k === 'ArrowDown' ? (i + 1) % n : k === 'ArrowLeft' || k === 'ArrowUp' ? (i - 1 + n) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : -1;
    if (j < 0) return;
    // Kept from the editor's own arrow keys (they move the selected part).
    e.preventDefault();
    e.stopPropagation();
    box.querySelectorAll<HTMLButtonElement>(':scope > button')[j]?.focus();
    if (followFocus && options[j].id !== value) onpick(options[j].id);
  }
</script>

<div class="seg" role="radiogroup" aria-label={label} bind:this={box}>
  {#each options as o, i (o.id)}
    <button role="radio" aria-checked={o.id === value} aria-label={o.icon ? o.label : undefined} tabindex={i === stop ? 0 : -1} class:on={o.id === value} title={o.title ?? o.label} onclick={() => onpick(o.id)} onkeydown={(e) => onkeydown(e, i)}>
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
  /* The brand outline would vanish on the chosen (brand) option. */
  .seg button.on:focus-visible {
    outline: 2px solid var(--text);
    outline-offset: -2px;
  }
</style>
