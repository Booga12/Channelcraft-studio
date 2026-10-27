<script lang="ts">
  // Where a shadow falls: a 3 by 3 pad of arrows (the middle shows the letter it falls from).
  type Dir = { id: string; label: string; x: number; y: number };
  let { dirs, value, onpick }: { dirs: Dir[]; value: string; onpick: (id: string) => void } = $props();

  const ARROWS: Record<string, string> = { nw: '↖', n: '↑', ne: '↗', w: '←', e: '→', sw: '↙', s: '↓', se: '↘' };
  const cells = $derived(
    [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => dirs.find((d) => d.x === x && d.y === y) ?? null)),
  );
</script>

<div class="pad" role="radiogroup" aria-label="Shadow direction">
  {#each cells as d, i (i)}
    {#if d}
      <button role="radio" aria-checked={d.id === value} class:on={d.id === value} title={d.label} aria-label={d.label} onclick={() => onpick(d.id)}>{ARROWS[d.id]}</button>
    {:else}
      <span class="mid">A</span>
    {/if}
  {/each}
</div>

<style>
  .pad {
    display: grid;
    grid-template-columns: repeat(3, 24px);
    gap: 3px;
  }
  button,
  .mid {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 5px;
    font-size: 13px;
  }
  button {
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--text-dim);
    padding: 0;
  }
  button:hover {
    border-color: var(--brand);
    color: var(--text);
  }
  button.on {
    background: var(--brand);
    border-color: var(--brand);
    color: var(--brand-text, #fff);
  }
  .mid {
    font-weight: 700;
    color: var(--text-faint);
  }
</style>
