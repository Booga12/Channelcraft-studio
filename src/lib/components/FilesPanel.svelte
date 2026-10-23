<script lang="ts">
  import { ed } from '$lib/editor.svelte';

  const files = $derived.by(() => {
    ed.rev;
    return ed.project?.xmlFiles ?? [];
  });
</script>

<div class="wrap">
  <p class="dim intro">XML files in the theme. Greyed files aren't used with the current options and system.</p>
  <ul>
    {#each files as f (f.key)}
      <li>
        <button
          class="ghost row"
          class:unused={!ed.res?.usedFiles.has(f)}
          class:cur={ed.sourceFile === f.key && ed.showSource}
          onclick={() => {
            ed.sourceFile = f.key;
            ed.sourceLine = null;
            ed.showSource = true;
          }}
        >
          <span class="mono">{f.rel}</span>
          {#if f.dirty}<span class="dot" title="Unsaved changes">●</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
  {#if ed.res?.missing.length}
    <p class="faint missing">{ed.res.missing.length} include(s) point at files that don't exist for this system; ES skips those.</p>
  {/if}
</div>

<style>
  .wrap {
    padding: 10px 8px;
  }
  .intro {
    font-size: 12px;
    margin: 0 4px 8px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .row {
    width: 100%;
    display: flex;
    gap: 6px;
    text-align: left;
    padding: 3px 6px;
  }
  .row span.mono {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11.5px;
  }
  .unused span.mono {
    color: var(--text-faint);
  }
  .cur {
    background: var(--brand-soft);
  }
  .dot {
    color: var(--warn);
    font-size: 10px;
  }
  .missing {
    font-size: 11.5px;
    margin: 10px 4px;
  }
</style>
