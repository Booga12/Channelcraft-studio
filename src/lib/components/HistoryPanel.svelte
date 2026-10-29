<script lang="ts">
  // Every change in order; click one to go back (or forward) to that point.
  import { ed } from '$lib/editor.svelte';
  import Icon from './Icon.svelte';

  const h = $derived(ed.history);
</script>

<div class="hist">
  <button class="step" class:cur={h.done.length === 0} aria-current={h.done.length === 0 ? 'step' : undefined} onclick={() => ed.jumpTo(0)}>
    <Icon name="file" size={13} />
    <span>Opened theme</span>
  </button>
  {#each h.done as label, i}
    <button class="step" class:cur={i === h.done.length - 1} aria-current={i === h.done.length - 1 ? 'step' : undefined} onclick={() => ed.jumpTo(i + 1)}>
      <span class="n">{i + 1}</span>
      <span>{label[0].toUpperCase() + label.slice(1)}</span>
    </button>
  {/each}
  {#each h.undone as label, i}
    <button class="step undone" onclick={() => ed.jumpTo(h.done.length + i + 1)} title="Undone. Click to redo up to here.">
      <span class="n">{h.done.length + i + 1}</span>
      <span>{label[0].toUpperCase() + label.slice(1)}</span>
    </button>
  {/each}
  {#if !h.done.length && !h.undone.length}
    <p class="faint empty">Changes you make show up here. Click one to go back to it.</p>
  {/if}
</div>

<style>
  .hist {
    display: grid;
    padding: 4px 0;
  }
  .step {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border-radius: 0;
    text-align: left;
    padding: 6px 12px;
    color: var(--text-dim);
  }
  .step:hover {
    background: color-mix(in srgb, var(--text) 5%, transparent);
  }
  .step.cur {
    background: var(--hover);
    color: var(--text);
  }
  .step.undone {
    opacity: 0.45;
    font-style: italic;
  }
  .n {
    width: 22px;
    font-size: 10.5px;
    color: var(--text-faint);
    text-align: right;
  }
  .empty {
    padding: 8px 14px;
  }
</style>
