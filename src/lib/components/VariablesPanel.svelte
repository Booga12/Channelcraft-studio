<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import { COLOR_RE } from '$lib/theme/schema';
  import ColorInput from './ColorInput.svelte';
  import { consoleOf } from '$lib/theme/consoles';
  import { elementLabel, humanize } from '$lib/friendly';
  import { DESIGN_COLOUR_NAMES, varUse } from '$lib/theme/simpleProps';

  let filter = $state('');
  let onlyColors = $state(false);
  const colorsOnly = $derived(ed.simple || onlyColors);

  const vars = $derived.by(() => {
    const r = ed.res;
    if (!r) return [];
    const q = filter.trim().toLowerCase();
    return [...r.vars.values()]
      .filter((v) => (!q || v.name.toLowerCase().includes(q) || humanize(v.name).toLowerCase().includes(q) || v.value.toLowerCase().includes(q)) && (!colorsOnly || COLOR_RE.test(ed.simple ? v.raw : v.value)))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  // Simple mode (#28): plain names, what each colour paints, and the ones nothing uses kept apart.
  const use = $derived(ed.res ? varUse(ed.res) : { used: new Set<string>(), users: new Map<string, Set<string>>() });
  const shown = $derived(ed.simple ? vars.filter((v) => use.used.has(v.name)) : vars);
  const unused = $derived(ed.simple ? vars.filter((v) => !use.used.has(v.name)) : []);
  /** A colour's plain name: the design's own words, else its name in words. */
  const plain = (name: string) => DESIGN_COLOUR_NAMES[name] ?? humanize(name);
  /** The parts a colour paints, for the line under its name. */
  function paints(name: string): string {
    const parts = [...new Set([...(use.users.get(name) ?? [])].map((n) => elementLabel(n)))];
    if (!parts.length) return use.used.has(name) ? 'Used through another color' : '';
    return parts.length > 3 ? `${parts.slice(0, 3).join(', ')} and ${parts.length - 3} more` : parts.join(', ');
  }

  /** Theme option (e.g. "Colour set: Dark grey") a variable's file was included by, if any. */
  const optionOf = $derived.by(() => {
    const map = new Map<string, string>();
    const r = ed.res;
    if (!r) return map;
    for (const edge of r.includes) {
      if (!edge.to) continue;
      const parent = edge.node.parent;
      if (parent?.name !== 'subset') continue;
      const subset = r.subsets.find((s) => s.name === parent.attrs.find((a) => a.name === 'name')?.value);
      const opt = subset?.options.find((o) => o.name === edge.node.attrs.find((a) => a.name === 'name')?.value);
      // Some themes name their options with variables (${subset.colorset}): filled in, or left out.
      const fill = (t: string) => t.replace(/\$\{([^}]+)\}/g, (m, n: string) => r.vars.get(n.trim())?.value ?? m);
      if (!subset || !opt) continue;
      const text = fill(`${subset.displayName}: ${opt.displayName}`);
      if (!text.includes('${')) map.set(edge.to.key, text);
    }
    return map;
  });
</script>

{#snippet row(v: (typeof vars)[number])}
    <div class="var">
      <div class="top">
        {#if consoleOf(v.node) === ed.consoleTheme}
          <span class="badge accent" title="Only {ed.consoleName} uses this value">This console only</span>
        {/if}
        {#if ed.simple}
          <span class="name" title={v.name}>{plain(v.name)}</span>
          {#if v.conditional && consoleOf(v.node) !== ed.consoleTheme}<span class="badge" title="This color depends on the console being shown">per console</span>{/if}
        {:else}
          <span class="name mono" title={v.name}>{v.name}</span>
          {#if v.conditional}<span class="badge" title="This value only applies under a condition (for example the current system)">if</span>{/if}
          {#if (ed.res?.varHistory.get(v.name)?.length ?? 0) > 1}<span class="badge" title="Defined {ed.res?.varHistory.get(v.name)?.length} times; the last one that applies wins">×{ed.res?.varHistory.get(v.name)?.length}</span>{/if}
          <button class="src ghost small mono" title="Show in source" onclick={() => ed.showInSource(v.file, v.node.start)}>{v.file.rel}</button>
        {/if}
      </div>
      {#if ed.simple && paints(v.name)}
        <div class="paints faint" title="The parts that use this color">{paints(v.name)}</div>
      {/if}
      {#if ed.simple && optionOf.get(v.file.key)}
        <div class="from faint" title="Only this option changes; other color sets keep their own colors">{optionOf.get(v.file.key)}</div>
      {/if}
      {#if COLOR_RE.test(v.raw)}
        <ColorInput value={v.raw} label={ed.simple ? plain(v.name) : v.name} seeThrough={ed.simple} onchange={(val) => ed.setVar(v.name, val)} />
      {:else}
        <input class="mono" value={v.raw} spellcheck="false" aria-label={ed.simple ? humanize(v.name) : v.name} onchange={(e) => ed.setVar(v.name, e.currentTarget.value)} />
        {#if v.raw !== v.value}<div class="faint mono resolved" title="Resolved value">= {v.value}</div>{/if}
      {/if}
    </div>
{/snippet}

<div class="wrap">
  {#if ed.simple}
    <p class="dim intro">Colors used in many places at once. Change one here and every part of the theme that uses it follows.</p>
  {:else}
    <p class="dim intro">Values defined in <span class="mono">&lt;variables&gt;</span> and used as <span class="mono">${'{name}'}</span>. Editing one changes every element that uses it.</p>
  {/if}
  <div class="head">
    <input placeholder={ed.simple ? 'Find a color…' : 'Filter variables…'} aria-label={ed.simple ? 'Find a color' : 'Filter variables'} bind:value={filter} />
    {#if !ed.simple}<label class="chk"><input type="checkbox" bind:checked={onlyColors} /> Colors</label>{/if}
  </div>
  {#each shown as v (v.name)}
    {@render row(v)}
  {:else}
    <p class="faint">{ed.simple ? (unused.length ? 'No colors in use' : 'No shared colors') : 'No variables'}{filter ? ' match' : ''}.</p>
  {/each}
  {#if unused.length}
    <details class="unused">
      <summary>Not used ({unused.length})</summary>
      <p class="dim">Nothing on any screen uses these yet. Changing them changes nothing until a part uses one.</p>
      {#each unused as v (v.name)}
        {@render row(v)}
      {/each}
    </details>
  {/if}
</div>

<style>
  .paints {
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .unused {
    margin-top: 8px;
  }
  .unused summary {
    cursor: pointer;
    font-size: 12px;
    color: var(--text-faint);
  }
  .unused .dim {
    margin: 6px 0;
    font-size: 12px;
  }
  .wrap {
    padding: 10px 10px 20px;
  }
  .intro {
    font-size: 12px;
    margin: 0 0 8px;
  }
  .head {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }
  .head input:not([type]) {
    flex: 1;
  }
  .chk {
    display: flex;
    gap: 4px;
    align-items: center;
    font-size: 12px;
    color: var(--text-dim);
  }
  .var {
    display: grid;
    gap: 4px;
    padding: 7px 4px;
    border-bottom: 1px solid var(--line);
  }
  .top {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }
  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .src {
    font-size: 10.5px;
    color: var(--text-faint);
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .from {
    font-size: 11px;
    margin-top: -2px;
  }
  .var > input {
    width: 100%;
  }
  .resolved {
    font-size: 10.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
