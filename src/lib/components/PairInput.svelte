<script lang="ts">
  import { fmtNum, parsePair } from '$lib/theme/schema';

  let { value, onchange, labels = ['x', 'y'], step = 0.001 }: { value: string; onchange: (v: string) => void; labels?: [string, string]; step?: number } = $props();

  const pair = $derived(parsePair(value));
  let raw = $state('');
  $effect(() => {
    raw = value;
  });

  function set(i: 0 | 1, n: number) {
    if (!pair || Number.isNaN(n)) return;
    const next: [number, number] = [...pair];
    next[i] = n;
    onchange(`${fmtNum(next[0])} ${fmtNum(next[1])}`);
  }
</script>

{#if pair}
  <div class="pair">
    {#each [0, 1] as const as i}
      <label>
        <span>{labels[i]}</span>
        <input type="number" {step} value={pair[i]} oninput={(e) => set(i, e.currentTarget.valueAsNumber)} />
      </label>
    {/each}
  </div>
{:else}
  <input class="mono raw" bind:value={raw} spellcheck="false" onchange={() => onchange(raw.trim())} />
{/if}

<style>
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  span {
    color: var(--text-faint);
    font-size: 11px;
    width: 10px;
  }
  input {
    width: 100%;
    min-width: 0;
  }
  .raw {
    width: 100%;
  }
</style>
