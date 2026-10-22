<script lang="ts">
  // Ready-made elements for the current screen, each wired to RetroBat's own data.
  import { ed } from '$lib/editor.svelte';
  import { viewLabel } from '$lib/friendly';
  import { itemsFor, type LibraryItem } from '$lib/theme/library';
  import Icon from './Icon.svelte';

  const items = $derived(itemsFor(ed.view));
  const groups = $derived.by(() => {
    const map = new Map<string, LibraryItem[]>();
    for (const i of items) map.set(i.category, [...(map.get(i.category) ?? []), i]);
    return [...map];
  });

  function onScreen(i: LibraryItem) {
    if (!i.native) return false;
    const el = ed.currentView?.elements.get(i.name);
    if (!el) return false;
    const v = el.props.get('visible')?.value.trim().toLowerCase();
    return v !== 'false' && v !== '0';
  }
</script>

<div class="lib">
  <p class="intro dim">Click to add to <strong>{viewLabel(ed.view)}</strong>. Items marked <span class="data">RetroBat data</span> fill themselves in with each game or console.</p>
  {#if !items.length}
    <p class="faint pad">Nothing to add on this screen.</p>
  {/if}
  {#if ed.view === 'system' && ed.screenFile === 'theme.xml'}
    <h4>Featured game</h4>
    <div class="tiles">
      <button class="item" onclick={() => (ed.showFeatured = true)} title="One of your games per console: its video and its cover together">
        <span class="ic"><Icon name="video" size={18} /></span>
        <span class="txt">
          <strong>Matching game video & cover</strong>
          <small>Shows one real game per console: its video and cover side by side, always from the same game.</small>
          <span class="tags"><span class="data">RetroBat data</span>{#if Object.keys(ed.featured.pairs).length}<span class="tag">{Object.keys(ed.featured.pairs).length} consoles set</span>{/if}</span>
        </span>
      </button>
    </div>
  {/if}
  {#each groups as [cat, list]}
    <h4>{cat}</h4>
    <div class="tiles">
      {#each list as i (i.id)}
        {@const here = onScreen(i)}
        <button class="item" class:here onclick={() => ed.addLibraryItem(i)} title={i.help}>
          <span class="ic"><Icon name={i.icon} size={18} /></span>
          <span class="txt">
            <strong>{i.label}</strong>
            <small>{i.help}</small>
            <span class="tags">
              {#if i.body.includes('{game:') || i.body.includes('{system:') || i.native}<span class="data">RetroBat data</span>{/if}
              {#if here}<span class="tag">On screen</span>{/if}
            </span>
          </span>
        </button>
      {/each}
    </div>
  {/each}
</div>

<style>
  .lib {
    padding: 8px 8px 16px;
  }
  .intro {
    margin: 2px 4px 8px;
    font-size: 11.5px;
  }
  .pad {
    padding: 8px;
  }
  h4 {
    margin: 10px 4px 6px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }
  .tiles {
    display: grid;
    gap: 4px;
  }
  .item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    text-align: left;
    white-space: normal;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 8px 10px;
  }
  .item:hover {
    border-color: var(--brand);
    background: var(--bg);
  }
  .ic {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: var(--raised);
    display: grid;
    place-items: center;
    flex: none;
    color: var(--text);
  }
  .txt {
    display: grid;
    gap: 1px;
    min-width: 0;
  }
  small {
    color: var(--text-faint);
    font-size: 11px;
  }
  .tags {
    display: flex;
    gap: 4px;
    margin-top: 3px;
  }
  .data {
    font-size: 10px;
    color: var(--brand);
    background: var(--brand-soft);
    border-radius: 3px;
    padding: 0 5px;
  }
  .tag {
    font-size: 10px;
    color: var(--ok);
    border: 1px solid var(--ok);
    border-radius: 3px;
    padding: 0 4px;
  }
  .item.here {
    opacity: 0.8;
  }
</style>
