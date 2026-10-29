<script lang="ts">
  // Filter chips for the design pickers: All, or one style group (Professional, Cute...).
  import { DESIGNS, DESIGN_GROUPS, type DesignGroup } from '$lib/theme/designs';

  let { group = $bindable<DesignGroup | 'all'>('all') }: { group?: DesignGroup | 'all' } = $props();

  // Follows the list: "My designs" shows up once you save one.
  const chips = $derived([{ id: 'all' as const, label: 'All', count: DESIGNS.length }, ...DESIGN_GROUPS.map((g) => ({ ...g, count: DESIGNS.filter((d) => d.group === g.id).length }))]);

  /** Arrow keys (and Home/End) move to the next chip and pick it; the group is one Tab stop. */
  function keys(ev: KeyboardEvent) {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const step = steps[ev.key];
    if (!step && ev.key !== 'Home' && ev.key !== 'End') return;
    const items = [...(ev.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    ev.preventDefault();
    const n = ev.key === 'Home' ? 0 : ev.key === 'End' ? items.length - 1 : (i + (step ?? 0) + items.length) % items.length;
    items[n].focus();
    items[n].click();
  }
</script>

<div class="chips" role="radiogroup" aria-label="Design style" tabindex="-1" onkeydown={keys}>
  {#each chips as c, i (c.id)}
    <button type="button" role="radio" aria-checked={group === c.id} tabindex={group === c.id || (i === 0 && !chips.some((x) => x.id === group)) ? 0 : -1} class:on={group === c.id} onclick={() => (group = c.id)}>
      {c.label}<span class="n">{c.count}</span>
    </button>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 8px;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg);
    color: var(--text-dim);
    font-size: 11.5px;
    font-weight: 600;
  }
  button:hover {
    color: var(--text);
    border-color: var(--brand);
  }
  button.on {
    background: var(--brand);
    border-color: var(--brand);
    color: #fff;
  }
  .n {
    font-size: 10px;
    opacity: 0.7;
  }
</style>
