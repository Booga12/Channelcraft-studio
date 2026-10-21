<script lang="ts">
  // Chooses whether edits change every console or only the console shown in the preview.
  import { ed } from '$lib/editor.svelte';
  import { elementLabel, humanize, propLabel } from '$lib/friendly';

  let open = $state(false);
  const own = $derived(ed.consoleValues);
</script>

<div class="scope" class:on={ed.consoleOnly}>
  <div class="seg" role="radiogroup" aria-label="Where changes go">
    <button role="radio" aria-checked={!ed.consoleOnly} class:sel={!ed.consoleOnly} onclick={() => (ed.consoleOnly = false)}>All consoles</button>
    <button role="radio" aria-checked={ed.consoleOnly} class:sel={ed.consoleOnly} onclick={() => (ed.consoleOnly = true)} title="Only changes the console shown in the preview. Pick another console in the toolbar to give it its own look.">Only {ed.consoleName}</button>
  </div>
  {#if ed.consoleOnly}
    <p class="hint">Colours, pictures and settings you change now apply only to {ed.consoleName}. Every other console keeps the shared ones.</p>
  {/if}
  {#if own.length}
    <button class="ghost small count" onclick={() => (open = !open)}>{ed.consoleName} has {own.length} own value{own.length === 1 ? '' : 's'} {open ? '▴' : '▾'}</button>
    {#if open}
      <ul>
        {#each own as v (`${v.kind}:${v.element ?? ''}:${v.name}`)}
          <li>
            <span>{v.kind === 'var' ? humanize(v.name) : `${elementLabel(v.element ?? '')}: ${propLabel(v.name)}`}</span>
            <span class="mono faint">{v.def.raw}</span>
            <button class="ghost small" title="Use the shared value again" onclick={() => ed.clearConsoleValues([v])}>Reset</button>
          </li>
        {/each}
      </ul>
      <button class="secondary small" onclick={() => ed.clearConsoleValues(own)}>Reset all of {ed.consoleName}</button>
    {/if}
  {/if}
</div>

<style>
  .scope {
    display: grid;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
  }
  .scope.on {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .seg {
    display: flex;
    border: 1px solid #3a3a3a;
    border-radius: 7px;
    overflow: hidden;
  }
  .seg button {
    flex: 1;
    border: 0;
    border-radius: 0;
    background: transparent;
    font-size: 12px;
    padding: 4px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .seg button.sel {
    background: var(--accent);
    color: #fff;
  }
  .hint {
    margin: 0;
    font-size: 11px;
    color: var(--text-dim, #bbb);
  }
  .count {
    justify-self: start;
    font-size: 11px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
    font-size: 11px;
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 6px;
    align-items: center;
  }
  li span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
