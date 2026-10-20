<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import { COLOR_RE } from '$lib/theme/schema';
  import ColorInput from './ColorInput.svelte';

  let filter = $state('');
  let onlyColors = $state(false);

  const vars = $derived.by(() => {
    const r = ed.res;
    if (!r) return [];
    const q = filter.trim().toLowerCase();
    return [...r.vars.values()]
      .filter((v) => (!q || v.name.toLowerCase().includes(q) || v.value.toLowerCase().includes(q)) && (!onlyColors || COLOR_RE.test(v.value)))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
</script>

<div class="wrap">
  <p class="dim intro">Values defined in <span class="mono">&lt;variables&gt;</span> and used as <span class="mono">${'{name}'}</span>. Editing one changes every element that uses it.</p>
  <div class="head">
    <input placeholder="Filter variables…" bind:value={filter} />
    <label class="chk"><input type="checkbox" bind:checked={onlyColors} /> Colours</label>
  </div>
  {#each vars as v (v.name)}
    <div class="var">
      <div class="top">
        <span class="name mono" title={v.name}>{v.name}</span>
        {#if v.conditional}<span class="badge" title="This value only applies under a condition (for example the current system)">if</span>{/if}
        {#if (ed.res?.varHistory.get(v.name)?.length ?? 0) > 1}<span class="badge" title="Defined {ed.res?.varHistory.get(v.name)?.length} times; the last one that applies wins">×{ed.res?.varHistory.get(v.name)?.length}</span>{/if}
        <button class="src ghost small mono" title="Show in source" onclick={() => ed.showInSource(v.file, v.node.start)}>{v.file.rel}</button>
      </div>
      {#if COLOR_RE.test(v.raw)}
        <ColorInput value={v.raw} onchange={(val) => ed.setVar(v.name, val)} />
      {:else}
        <input class="mono" value={v.raw} spellcheck="false" onchange={(e) => ed.setVar(v.name, e.currentTarget.value)} />
        {#if v.raw !== v.value}<div class="faint mono resolved" title="Resolved value">= {v.value}</div>{/if}
      {/if}
    </div>
  {:else}
    <p class="faint">No variables{filter ? ' match' : ''}.</p>
  {/each}
</div>

<style>
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
