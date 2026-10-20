<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import { SHORTCUTS } from '$lib/shortcuts';
  import Icon from './Icon.svelte';
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (ed.showShortcuts = false)} />

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (ed.showShortcuts = false)}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
    <header>
      <h2>Keyboard shortcuts</h2>
      <button class="ghost" onclick={() => window.print()} title="Print this list">Print</button>
      <button class="ghost" onclick={() => (ed.showShortcuts = false)} aria-label="Close"><Icon name="close" size={16} /></button>
    </header>
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
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: grid;
    place-items: center;
    z-index: 400;
  }
  .dialog {
    width: min(820px, 94vw);
    max-height: 88vh;
    overflow: auto;
    background: var(--panel);
    border: 1px solid #3a3a3a;
    border-radius: 12px;
    padding: 18px 24px 22px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
  }
  header {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  h2 {
    flex: 1;
    margin: 0;
    font-size: 16px;
  }
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
    border-bottom: 1px solid #383838;
  }
  kbd {
    font: 11px var(--mono);
    background: var(--bg);
    border: 1px solid #4a4a4a;
    border-radius: 4px;
    padding: 1px 6px;
    white-space: nowrap;
    color: var(--text-dim);
  }
</style>
