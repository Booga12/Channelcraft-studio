<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import { ADDABLE_TYPES, ELEMENT_LABELS } from '$lib/theme/schema';
  import { isVisible, TYPE_ICON, zOf } from '$lib/render';

  let filter = $state('');
  let adding = $state(false);

  const list = $derived.by(() => {
    const v = ed.currentView;
    if (!v) return [];
    const q = filter.trim().toLowerCase();
    return [...v.elements.values()]
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.type.includes(q) || (ELEMENT_LABELS[e.name] ?? '').toLowerCase().includes(q))
      .sort((a, b) => zOf(b) - zOf(a) || a.order - b.order);
  });

  function add(type: string) {
    adding = false;
    ed.addElement(type);
  }
</script>

<div class="wrap">
  <div class="head">
    <input placeholder="Filter elements…" bind:value={filter} />
    <div class="add">
      <button class="small" onclick={() => (adding = !adding)} title="Add an element to this view">＋ Add</button>
      {#if adding}
        <div class="menu" role="menu">
          {#each ADDABLE_TYPES as t}
            <button class="ghost" role="menuitem" onclick={() => add(t)}><span class="ic">{TYPE_ICON[t] ?? '•'}</span>{t}</button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  {#if !list.length}
    <p class="faint empty">No elements in this view.</p>
  {/if}
  <ul>
    {#each list as el (el.name)}
      <li class:sel={ed.selected === el.name} class:off={!isVisible(el) || ed.hidden[el.name]}>
        <button
          class="eye ghost"
          title={ed.hidden[el.name] ? 'Show in preview' : 'Hide in preview (does not change the theme)'}
          onclick={() => (ed.hidden[el.name] = !ed.hidden[el.name])}>{ed.hidden[el.name] ? '◌' : '●'}</button
        >
        <button class="row ghost" onclick={() => (ed.selected = el.name)}>
          <span class="ic" title={el.type}>{TYPE_ICON[el.type] ?? '•'}</span>
          <span class="name">
            {ELEMENT_LABELS[el.name] ?? el.name}
            {#if ELEMENT_LABELS[el.name]}<span class="faint mono">{el.name}</span>{/if}
          </span>
          {#if el.conditional}<span class="badge" title="Some definitions only apply under conditions">if</span>{/if}
          {#if el.unknownConditions}<span class="badge warn" title="A condition couldn't be evaluated; it's shown as if true">?</span>{/if}
          {#if !isVisible(el)}<span class="badge" title="visible is false">hidden</span>{/if}
          <span class="z faint mono" title="zIndex">{zOf(el)}</span>
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .wrap {
    padding: 8px 6px;
  }
  .head {
    display: flex;
    gap: 6px;
    padding: 0 4px 8px;
  }
  .head input {
    flex: 1;
  }
  .add {
    position: relative;
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 20;
    background: var(--panel-2);
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    padding: 4px;
    display: grid;
    min-width: 150px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  }
  .menu button {
    text-align: left;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    border-radius: 5px;
  }
  li.sel {
    background: var(--accent-soft);
  }
  li.off .name {
    color: var(--text-faint);
  }
  .eye {
    padding: 3px 5px;
    font-size: 9px;
    color: var(--text-faint);
  }
  .row {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    text-align: left;
    padding: 4px 6px;
    min-width: 0;
  }
  li.sel .row {
    color: var(--text);
  }
  .ic {
    width: 16px;
    text-align: center;
    color: var(--text-dim);
    flex: none;
  }
  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name .mono {
    font-size: 10.5px;
    margin-left: 4px;
  }
  .z {
    font-size: 10.5px;
    min-width: 20px;
    text-align: right;
  }
  .empty {
    padding: 10px;
  }
</style>
