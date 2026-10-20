<script lang="ts">
  import { fmtNum, parsePair } from '$lib/theme/schema';

  let {
    value,
    onchange,
    labels = ['x', 'y'],
    step = 0.001,
    percent = false,
  }: {
    value: string;
    onchange: (v: string) => void;
    labels?: [string, string];
    step?: number;
    /** Show and edit as percentages of the screen (stored as fractions). */
    percent?: boolean;
  } = $props();

  const pair = $derived(parsePair(value));
  let raw = $state('');
  $effect(() => {
    raw = value;
  });

  const shown = (n: number) => (percent ? Math.round(n * 1000) / 10 : n);

  function set(i: 0 | 1, n: number) {
    if (!pair || Number.isNaN(n)) return;
    const next: [number, number] = [...pair];
    next[i] = percent ? n / 100 : n;
    onchange(`${fmtNum(next[0])} ${fmtNum(next[1])}`);
  }
</script>

{#if pair}
  <div class="pair" class:percent>
    {#each [0, 1] as const as i}
      <label>
        <span>{labels[i]}</span>
        <input type="number" step={percent ? 0.1 : step} value={shown(pair[i])} oninput={(e) => set(i, e.currentTarget.valueAsNumber)} />
        {#if percent}<em>%</em>{/if}
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
    min-width: 10px;
    white-space: nowrap;
  }
  .percent label {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 4px;
  }
  .percent span {
    grid-column: 1 / -1;
  }
  em {
    font-style: normal;
    color: var(--text-faint);
    font-size: 11px;
  }
  input {
    width: 100%;
    min-width: 0;
  }
  .raw {
    width: 100%;
  }
</style>
