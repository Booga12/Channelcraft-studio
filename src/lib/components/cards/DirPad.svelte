<script lang="ts">
  // Where a shadow falls: a 3 by 3 pad of arrows (the middle shows the letter it falls from).
  type Dir = { id: string; label: string; x: number; y: number };
  let { dirs, value, onpick }: { dirs: Dir[]; value: string; onpick: (id: string) => void } = $props();

  const ARROWS: Record<string, string> = { nw: '↖', n: '↑', ne: '↗', w: '←', e: '→', sw: '↙', s: '↓', se: '↘' };
  const cells = $derived(
    [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => dirs.find((d) => d.x === x && d.y === y) ?? null)),
  );
  // One Tab stop (the chosen direction, or the first); the arrow keys move round the pad and choose.
  const stop = $derived(dirs.some((d) => d.id === value) ? value : dirs[0]?.id);
  let pad: HTMLDivElement;

  function onkeydown(e: KeyboardEvent, d: Dir) {
    if (e.key === 'Home' || e.key === 'End') {
      // The first or last arrow on the pad, in reading order.
      const order = cells.filter((c): c is Dir => !!c);
      const t = e.key === 'Home' ? order[0] : order[order.length - 1];
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      pad.querySelector<HTMLButtonElement>(`[data-dir="${t.id}"]`)?.focus();
      if (t.id !== value) onpick(t.id);
      return;
    }
    const [dx, dy] = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key] ?? [0, 0];
    if (!dx && !dy) return;
    // Kept from the editor's own arrow keys (they move the selected part).
    e.preventDefault();
    e.stopPropagation();
    // Jumps over the middle letter.
    const at = (k: number) => dirs.find((x) => x.x === d.x + dx * k && x.y === d.y + dy * k);
    const t = at(1) ?? at(2);
    if (!t) return;
    pad.querySelector<HTMLButtonElement>(`[data-dir="${t.id}"]`)?.focus();
    if (t.id !== value) onpick(t.id);
  }
</script>

<div class="pad" role="radiogroup" aria-label="Shadow direction" bind:this={pad}>
  {#each cells as d, i (i)}
    {#if d}
      <button role="radio" aria-checked={d.id === value} tabindex={d.id === stop ? 0 : -1} data-dir={d.id} class:on={d.id === value} title={d.label} aria-label={d.label} onclick={() => onpick(d.id)} onkeydown={(e) => onkeydown(e, d)}>{ARROWS[d.id]}</button>
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
  /* The brand outline would vanish on the chosen (brand) arrow. */
  button.on:focus-visible {
    outline: 2px solid var(--text);
    outline-offset: 1px;
  }
  .mid {
    font-weight: 700;
    color: var(--text-faint);
  }
</style>
