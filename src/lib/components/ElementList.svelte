<script lang="ts">
  // Layers panel: every element on the screen, top layer first, like Photoshop's Layers.
  import { ask } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import { ADDABLE_TYPES, ELEMENT_LABELS } from '$lib/theme/schema';
  import { elementLabel, TYPE_LABELS, typeLabel, viewLabel } from '$lib/friendly';
  import { isVisible, zOf } from '$lib/render';
  import Icon, { TYPE_ICONS } from './Icon.svelte';

  let filter = $state('');
  let adding = $state(false);

  const list = $derived.by(() => {
    const v = ed.currentView;
    if (!v) return [];
    const q = filter.trim().toLowerCase();
    return [...v.elements.values()]
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.type.includes(q) || elementLabel(e.name).toLowerCase().includes(q))
      .sort((a, b) => zOf(b) - zOf(a) || a.order - b.order);
  });

  let listEl: HTMLUListElement;
  // Keep the selected layer in view when it's picked on the canvas.
  $effect(() => {
    const name = ed.selected;
    if (!name || !listEl) return;
    queueMicrotask(() => listEl.querySelector('li.sel')?.scrollIntoView({ block: 'nearest' }));
  });

  function add(type: string) {
    adding = false;
    ed.addElement(type);
  }

  async function remove() {
    const el = ed.selectedElement;
    if (!el) return;
    const ok = await ask(`Delete “${elementLabel(el.name)}” from ${viewLabel(ed.view)}? You can undo this with Ctrl+Z.`, { title: 'Delete element', kind: 'warning', okLabel: 'Delete', cancelLabel: 'Cancel' });
    if (!ok) return;
    const r = ed.deleteElement(el.name);
    if (!r.removed) ed.notify('This element is shared with other screens, so it can’t be deleted here. Hide it with the eye instead.', 'error');
  }
</script>

<div class="layers">
  <div class="search">
    <input placeholder="Find a layer…" bind:value={filter} />
  </div>
  <ul role="listbox" aria-label="Layers" bind:this={listEl}>
    {#each list as el (el.name)}
      {@const hidden = !isVisible(el)}
      <li class:sel={ed.selected === el.name} class:off={hidden || ed.hidden[el.name]} role="option" aria-selected={ed.selected === el.name}>
        <button
          class="eye"
          title={ed.hidden[el.name] ? 'Show in the preview' : 'Hide in the preview only (the theme is not changed)'}
          onclick={() => (ed.hidden[el.name] = !ed.hidden[el.name])}
        >
          {#if !ed.hidden[el.name]}<Icon name="eye" size={14} />{/if}
        </button>
        <button class="row" onclick={() => (ed.selected = el.name)} title={el.name}>
          <span class="thumb"><Icon name={TYPE_ICONS[el.type] ?? 'file'} size={15} /></span>
          <span class="name">
            {ed.simple ? elementLabel(el.name) : (ELEMENT_LABELS[el.name] ?? el.name)}
            {#if !ed.simple && ELEMENT_LABELS[el.name]}<span class="faint mono">{el.name}</span>{/if}
          </span>
          {#if hidden}<span class="tag" title="Hidden on this screen in the theme">hidden</span>{/if}
          {#if !ed.simple && el.conditional}<span class="tag" title="Some definitions only apply under conditions">if</span>{/if}
          {#if !ed.simple && el.unknownConditions}<span class="tag warn" title="A condition couldn't be evaluated; it's shown as if true">?</span>{/if}
          {#if !ed.simple}<span class="z mono" title="Layer (zIndex)">{zOf(el)}</span>{/if}
        </button>
      </li>
    {:else}
      <li class="empty faint">{filter ? 'No layers match.' : 'Nothing on this screen yet. Add something with the buttons below.'}</li>
    {/each}
  </ul>
  <footer>
    <span class="faint">{list.length} layer{list.length === 1 ? '' : 's'}</span>
    <div class="spacer"></div>
    <div class="add">
      <button class="ic" onclick={() => (adding = !adding)} title="Add an element to this screen"><Icon name="plus" size={15} /></button>
      {#if adding}
        <div class="menu" role="menu">
          {#each ADDABLE_TYPES as t}
            <button class="item" role="menuitem" onclick={() => add(t)} title={TYPE_LABELS[t]?.help ?? ''}>
              <Icon name={TYPE_ICONS[t] ?? 'file'} size={15} />
              <span class="txt"><span>{typeLabel(t)}</span><small>{TYPE_LABELS[t]?.help ?? ''}</small></span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
    <button class="ic" onclick={remove} disabled={!ed.selectedElement} title="Delete the selected element"><Icon name="trash" size={15} /></button>
  </footer>
</div>

<style>
  .layers {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .search {
    padding: 6px 8px;
    border-bottom: 1px solid var(--line);
  }
  .search input {
    width: 100%;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1;
    overflow: auto;
  }
  li {
    display: flex;
    align-items: center;
    height: 32px;
    border-bottom: 1px solid #262626;
  }
  li.sel {
    background: #474747;
  }
  li.off .name,
  li.off .thumb {
    opacity: 0.45;
  }
  .eye {
    width: 28px;
    height: 100%;
    padding: 0;
    display: grid;
    place-items: center;
    background: transparent;
    color: var(--text-dim);
    border-radius: 0;
    border-right: 1px solid #262626;
  }
  .row {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px;
    background: transparent;
    border-radius: 0;
    text-align: left;
    min-width: 0;
  }
  .row:hover {
    background: rgba(255, 255, 255, 0.04);
  }
  li.sel .row:hover {
    background: transparent;
  }
  .thumb {
    width: 24px;
    height: 22px;
    display: grid;
    place-items: center;
    background: var(--bg);
    border: 1px solid #4a4a4a;
    border-radius: 2px;
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
  .tag {
    font-size: 10px;
    color: var(--text-faint);
    border: 1px solid #555;
    border-radius: 3px;
    padding: 0 4px;
  }
  .tag.warn {
    color: var(--warn);
    border-color: var(--warn);
  }
  .z {
    font-size: 10.5px;
    color: var(--text-faint);
    min-width: 22px;
    text-align: right;
  }
  .empty {
    height: auto;
    padding: 14px 12px;
    border: none;
  }
  footer {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 30px;
    padding: 0 6px 0 10px;
    border-top: 1px solid var(--line);
    background: var(--frame);
    font-size: 11px;
    flex: none;
  }
  .spacer {
    flex: 1;
  }
  .ic {
    background: transparent;
    padding: 4px;
    color: var(--text-dim);
  }
  .ic:hover:not(:disabled) {
    color: var(--text);
  }
  .add {
    position: relative;
  }
  .menu {
    position: absolute;
    right: 0;
    bottom: calc(100% + 6px);
    z-index: 50;
    width: 260px;
    background: #2f2f2f;
    border: 1px solid #3f3f3f;
    border-radius: 6px;
    padding: 4px 0;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
  }
  .item {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding: 6px 12px;
    background: transparent;
    border-radius: 0;
    text-align: left;
    white-space: normal;
  }
  .item:hover {
    background: var(--accent-strong);
    color: #fff;
  }
  .txt {
    display: grid;
  }
  .txt small {
    font-size: 11px;
    opacity: 0.7;
  }
</style>
