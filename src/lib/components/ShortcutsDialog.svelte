<script lang="ts">
  import AppDialog from './AppDialog.svelte';
  import { Button } from '$lib/components/ui/button';
  import { ed } from '$lib/editor.svelte';
  import { SHORTCUTS } from '$lib/shortcuts';
</script>

<AppDialog title="Keyboard shortcuts" onclose={() => (ed.showShortcuts = false)} class="sm:max-w-[820px]">
  {#snippet actions()}
    <Button variant="outline" size="sm" onclick={() => window.print()} title="Print this list">Print</Button>
  {/snippet}
    <div class="cols">
      {#each SHORTCUTS as g}
        <section>
          <h3>{g.group}</h3>
          {#each g.items as [keys, what]}
            <div class="row">
              <span>{what}</span>
              <kbd>{keys}</kbd>
            </div>
          {/each}
        </section>
      {/each}
    </div>
</AppDialog>

<style>
  .cols {
    columns: 2;
    column-gap: 32px;
    margin-top: 10px;
  }
  section {
    break-inside: avoid;
    margin-bottom: 14px;
  }
  h3 {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    margin: 8px 0 4px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 0;
    border-bottom: 1px solid var(--line);
  }
  kbd {
    font: 11px var(--mono);
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 1px 6px;
    white-space: nowrap;
    color: var(--text-dim);
  }
</style>
