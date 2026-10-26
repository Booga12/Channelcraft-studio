<script lang="ts">
  // Filter chips for the design pickers: All, or one style group (Professional, Cute...).
  import { DESIGNS, DESIGN_GROUPS, type DesignGroup } from '$lib/theme/designs';

  let { group = $bindable<DesignGroup | 'all'>('all') }: { group?: DesignGroup | 'all' } = $props();

  // Follows the list: "My designs" shows up once you save one.
  const chips = $derived([{ id: 'all' as const, label: 'All', count: DESIGNS.length }, ...DESIGN_GROUPS.map((g) => ({ ...g, count: DESIGNS.filter((d) => d.group === g.id).length }))]);
</script>

<div class="chips" role="radiogroup" aria-label="Design style">
  {#each chips as c (c.id)}
    <button type="button" role="radio" aria-checked={group === c.id} class:on={group === c.id} onclick={() => (group = c.id)}>
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
