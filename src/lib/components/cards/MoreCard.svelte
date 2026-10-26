<script lang="ts">
  // Every setting the other cards don't cover, as plain rows, and adding one.
  import SlidersIcon from '@lucide/svelte/icons/sliders-horizontal';
  import { ed } from '$lib/editor.svelte';
  import { cards } from '$lib/simpleCards.svelte';
  import { propLabel } from '$lib/friendly';
  import { SCHEMA, inferSpec, specFor, type PropSpec } from '$lib/theme/schema';
  import type { ResolvedElement } from '$lib/theme/resolver';
  import PropRow from '../PropRow.svelte';
  import Card from './Card.svelte';

  let { el, covered }: { el: ResolvedElement; covered: Set<string> } = $props();

  const rows = $derived(
    [...el.props.values()]
      .filter((d) => !covered.has(d.name))
      .map((def) => ({ def, spec: SCHEMA[el.type]?.find((s) => s.name === def.name) ?? inferSpec(def.name, def.value) })),
  );
  const q = $derived(cards.query.trim().toLowerCase());
  /** While searching, only the rows that match (the card shows when any does). */
  const shown = $derived(q ? rows.filter((r) => q.split(/\s+/).every((w) => `${propLabel(r.def.name)} ${r.def.name}`.toLowerCase().includes(w))) : rows);
  const missing = $derived((SCHEMA[el.type] ?? []).filter((s) => !el.props.has(s.name) && !covered.has(s.name)));
  let adding = $state('');

  function defaultFor(spec: PropSpec): string {
    switch (spec.kind) {
      case 'pair':
        return spec.name === 'origin' ? '0.5 0.5' : '0.2 0.1';
      case 'color':
        return 'FFFFFFFF';
      case 'bool':
        return spec.name === 'visible' ? 'true' : 'false';
      case 'float':
        return spec.name === 'lineSpacing' ? '1.2' : spec.name === 'saturation' ? '1' : '0';
      case 'alignment':
      case 'valign':
        return 'center';
      case 'enum':
        return spec.options?.[0] ?? '';
      default:
        return '';
    }
  }
  function add(name: string) {
    if (!name) return;
    ed.setProp(el.name, name, defaultFor(specFor(el.type, name)));
    adding = '';
  }
</script>

<Card id="more" title="More settings" icon={SlidersIcon} summary={rows.length ? `${rows.length} more` : ''} words={rows.map((r) => `${propLabel(r.def.name)} ${r.def.name}`).join(' ')} openByDefault={false}>
  {#if shown.length}
    <div class="rows">
      {#each shown as r (r.def.name)}
        <PropRow {el} spec={r.spec} def={r.def} />
      {/each}
    </div>
  {/if}
  {#if missing.length}
    <select bind:value={adding} onchange={() => add(adding)} aria-label="Add a setting">
      <option value="">＋ Add a setting…</option>
      {#each missing as m (m.name)}<option value={m.name} title={m.hint}>{propLabel(m.name)}</option>{/each}
    </select>
  {/if}
  <p class="note">Every setting, with its code name, is in Advanced mode.</p>
</Card>

<style>
  .rows {
    margin: 0 -12px;
    border-top: 1px solid var(--line);
  }
  select {
    width: 100%;
  }
</style>
