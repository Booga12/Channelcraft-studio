<script lang="ts">
  // Layers panel: every element on the screen, top layer first.
  import { ed } from '$lib/editor.svelte';
  import { ADDABLE_TYPES, ELEMENT_LABELS } from '$lib/theme/schema';
  import { elementLabel, TYPE_LABELS, typeLabel } from '$lib/friendly';
  import { isVisible, zOf } from '$lib/render';
  import { BUILT_IN_SPLASH, isSplashExtra } from '$lib/theme/splash';
  import Icon, { TYPE_ICONS } from './Icon.svelte';
  import ContextMenu, { type MenuItem } from './ContextMenu.svelte';

  let filter = $state('');
  let adding = $state(false);
  let renaming = $state<string | null>(null);
  let renameText = $state('');
  // Dragging layers to reorder them. Pointer events rather than HTML drag and drop, which the
  // desktop app turns off on Windows (it handles files dropped from Explorer itself).
  let press: { name: string; x: number; y: number; id: number } | null = null;
  let drag = $state<{ names: string[]; x: number; y: number } | null>(null);
  /** Where the dragged layers would land: above this layer, or at the bottom (null). */
  let dropBefore = $state<string | null | undefined>(undefined);
  let lineY = $state(0);
  let justDragged = false;
  let scrollTimer: ReturnType<typeof setInterval> | null = null;
  let menuAt = $state<{ x: number; y: number } | null>(null);

  const list = $derived.by(() => {
    const v = ed.currentView;
    if (!v) return [];
    const q = filter.trim().toLowerCase();
    return [...v.elements.values()]
      .filter((e) => e.type !== 'gameextras')
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.type.includes(q) || elementLabel(e.name).toLowerCase().includes(q))
      .sort((a, b) => zOf(b) - zOf(a) || b.order - a.order);
  });

  /** On a loading screen, RetroBat draws only its built-in parts and extras. */
  const notDrawn = (e: { name: string; type: string; extra: string | null }) => ed.screenFile !== 'theme.xml' && !BUILT_IN_SPLASH.has(e.name) && !isSplashExtra(e as Parameters<typeof isSplashExtra>[0]);

  let listEl: HTMLUListElement;
  // Keep the selected layer in view when it's picked on the canvas.
  $effect(() => {
    const name = ed.selected;
    if (!name || !listEl) return;
    queueMicrotask(() => listEl.querySelector('li.primary')?.scrollIntoView({ block: 'nearest' }));
  });

  function rowDown(e: PointerEvent, name: string) {
    if (e.button !== 0 || renaming === name || (e.target as HTMLElement).closest('.ico')) return;
    press = { name, x: e.clientX, y: e.clientY, id: e.pointerId };
  }

  /** The drop spot under the pointer: above the row whose top half it's over, else the bottom. */
  function spotAt(y: number) {
    const rows = [...listEl.querySelectorAll<HTMLElement>('li[data-layer]')];
    const top = listEl.getBoundingClientRect().top - listEl.scrollTop;
    for (const r of rows) {
      const b = r.getBoundingClientRect();
      if (y < b.top + b.height / 2) return { before: r.dataset.layer!, y: b.top - top };
    }
    const last = rows.at(-1)?.getBoundingClientRect();
    return { before: null, y: last ? last.bottom - top : 0 };
  }

  function onmove(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    if (!drag) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) return;
      if (!ed.isSelected(press.name)) ed.select(press.name, 'only');
      const picked = new Set(ed.selection.length ? ed.selection : [press.name]);
      drag = { names: list.filter((l) => picked.has(l.name)).map((l) => l.name), x: e.clientX, y: e.clientY };
      // Scroll the list while the pointer is near its top or bottom edge.
      scrollTimer = setInterval(() => {
        if (!drag) return;
        const b = listEl.getBoundingClientRect();
        const edge = 28;
        const d = drag.y < b.top + edge ? -1 : drag.y > b.bottom - edge ? 1 : 0;
        if (!d) return;
        listEl.scrollTop += d * 10;
        place(drag.y);
      }, 16);
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
    place(e.clientY);
  }

  function place(y: number) {
    const spot = spotAt(y);
    dropBefore = spot.before;
    lineY = spot.y;
  }

  function onup(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    press = null;
    if (scrollTimer) clearInterval(scrollTimer);
    scrollTimer = null;
    if (!drag) return;
    const names = drag.names;
    const before = dropBefore;
    drag = null;
    dropBefore = undefined;
    // The click that follows the release isn't a selection.
    justDragged = true;
    setTimeout(() => (justDragged = false), 0);
    if (before !== undefined && !names.includes(before ?? '')) ed.moveLayers(names, before);
  }

  function cancelDrag(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !drag) return;
    e.stopPropagation();
    press = null;
    drag = null;
    dropBefore = undefined;
    if (scrollTimer) clearInterval(scrollTimer);
    scrollTimer = null;
  }

  function click(e: MouseEvent, name: string) {
    if (justDragged) return;
    if (e.shiftKey && ed.selected) {
      // Range select between the last selected layer and this one.
      const names = list.map((x) => x.name);
      const a = names.indexOf(ed.selected);
      const b = names.indexOf(name);
      const [from, to] = a < b ? [a, b] : [b, a];
      ed.selection = [...new Set([...ed.selection, ...names.slice(from, to + 1)])].filter((n) => !ed.locked[n]);
      ed.select(name, 'add');
    } else if (e.ctrlKey || e.metaKey) ed.select(name, 'toggle');
    else ed.select(name, 'only');
  }

  function startRename(name: string) {
    const el = ed.currentView?.elements.get(name);
    if (!el?.extra) {
      ed.notify('RetroBat’s own elements keep their names, so RetroBat can fill them in');
      return;
    }
    renaming = name;
    renameText = name;
  }

  function finishRename() {
    if (renaming && renameText.trim() && renameText !== renaming) ed.rename(renaming, renameText);
    renaming = null;
  }

  function add(type: string) {
    adding = false;
    ed.addElement(type);
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === 'F2' && ed.selected) {
      e.preventDefault();
      startRename(ed.selected);
    }
  }

  const menuItems = $derived<MenuItem[]>([
    { label: 'Rename', shortcut: 'F2', action: () => ed.selected && startRename(ed.selected), disabled: ed.selection.length !== 1 },
    { label: 'Duplicate', shortcut: 'Ctrl+D', action: () => ed.duplicate() },
    { separator: true },
    { label: 'Bring to front', action: () => ed.arrange('front') },
    { label: 'Send to back', action: () => ed.arrange('back') },
    { separator: true },
    { label: ed.selection.every((n) => ed.locked[n]) ? 'Unlock' : 'Lock', shortcut: 'Ctrl+L', action: () => ed.selection.forEach((n) => ed.setLocked(n, !ed.locked[n])) },
    { label: 'Hide on this screen', action: () => ed.selection.forEach((n) => ed.setProp(n, 'visible', 'false')) },
    { label: 'Show on this screen', action: () => ed.selection.forEach((n) => ed.setProp(n, 'visible', 'true')) },
    { separator: true },
    { label: 'Delete', shortcut: 'Del', danger: true, action: () => ed.deleteSelection() },
  ]);
</script>

<svelte:window onkeydown={onkey} onkeydowncapture={cancelDrag} onpointermove={onmove} onpointerup={onup} onpointercancel={onup} />

<div class="layers">
  <div class="search">
    <input placeholder="Find a layer…" bind:value={filter} />
  </div>
  <ul role="listbox" aria-label="Layers" aria-multiselectable="true" bind:this={listEl}>
    {#each list as el (el.name)}
      {@const hidden = !isVisible(el)}
      {@const locked = !!ed.locked[el.name]}
      <li
        class:sel={ed.isSelected(el.name)}
        class:primary={ed.selected === el.name}
        class:off={hidden || ed.hidden[el.name]}
        class:dragging={drag?.names.includes(el.name)}
        role="option"
        data-layer={el.name}
        aria-selected={ed.isSelected(el.name)}
        onpointerdown={(e) => rowDown(e, el.name)}
        oncontextmenu={(e) => {
          e.preventDefault();
          if (!ed.isSelected(el.name)) ed.select(el.name, 'only');
          menuAt = { x: e.clientX, y: e.clientY };
        }}
      >
        <button class="ico" title={ed.hidden[el.name] ? 'Show in the preview' : 'Hide in the preview only (the theme is not changed)'} onclick={() => (ed.hidden[el.name] = !ed.hidden[el.name])}>
          {#if !ed.hidden[el.name]}<Icon name="eye" size={14} />{/if}
        </button>
        <button class="row" onclick={(e) => click(e, el.name)} ondblclick={() => startRename(el.name)} title="{el.name} · double-click to rename, drag up or down to change the order">
          <span class="thumb"><Icon name={TYPE_ICONS[el.type] ?? 'file'} size={15} /></span>
          {#if renaming === el.name}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="rename"
              bind:value={renameText}
              autofocus
              onclick={(e) => e.stopPropagation()}
              onkeydown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') finishRename();
                if (e.key === 'Escape') renaming = null;
              }}
              onblur={finishRename}
            />
          {:else}
            <span class="name">
              {ed.simple ? elementLabel(el.name) : (ELEMENT_LABELS[el.name] ?? el.name)}
              {#if !ed.simple && ELEMENT_LABELS[el.name]}<span class="faint mono">{el.name}</span>{/if}
            </span>
          {/if}
          {#if hidden}<span class="tag" title="Hidden on this screen in the theme">hidden</span>{/if}
          {#if notDrawn(el)}<span class="tag warn" title="RetroBat doesn't draw this on a loading screen. Mark it extra=&quot;true&quot; (in Advanced mode) to have it drawn.">not drawn</span>{/if}
          {#if !ed.simple && el.conditional}<span class="tag" title="Some definitions only apply under conditions">if</span>{/if}
          {#if el.complex.some((c) => c.name === 'storyboard')}<span class="tag anim" title="Animated">✦</span>{/if}
          {#if !ed.simple}<span class="z mono" title="Layer (zIndex)">{zOf(el)}</span>{/if}
        </button>
        <button class="ico lock" class:on={locked} title={locked ? 'Unlock' : 'Lock so it can’t be moved on the canvas'} onclick={() => ed.setLocked(el.name, !locked)}>
          <Icon name="lock" size={13} />
        </button>
      </li>
    {:else}
      <li class="empty faint">{filter ? 'No layers match.' : 'Nothing on this screen yet. Add something with the buttons below.'}</li>
    {/each}
    {#if drag && dropBefore !== undefined}
      <li class="drop-line" aria-hidden="true" style:top="{lineY - 1}px"></li>
    {/if}
  </ul>
  <footer>
    <span class="faint">{ed.selection.length > 1 ? `${ed.selection.length} selected` : `${list.length} layer${list.length === 1 ? '' : 's'}`}</span>
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
          <button class="item more" role="menuitem" onclick={() => ((adding = false), ed.showPanel('library'))}>
            <Icon name="sparkle" size={15} />
            <span class="txt"><span>Ready-made elements…</span><small>Box art, game info and more, filled in by RetroBat</small></span>
          </button>
        </div>
      {/if}
    </div>
    <button class="ic" onclick={() => ed.duplicate()} disabled={!ed.selection.length} title="Duplicate (Ctrl+D)"><Icon name="copy" size={15} /></button>
    <button class="ic" onclick={() => ed.deleteSelection()} disabled={!ed.selection.length} title="Delete (Del)"><Icon name="trash" size={15} /></button>
  </footer>
</div>

{#if drag}
  <div class="drag-ghost" style:left="{drag.x + 14}px" style:top="{drag.y + 10}px">
    {drag.names.length === 1 ? elementLabel(drag.names[0]) : `${drag.names.length} layers`}
  </div>
{/if}

{#if menuAt}
  <ContextMenu x={menuAt.x} y={menuAt.y} items={menuItems} onclose={() => (menuAt = null)} />
{/if}

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
    position: relative;
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
    border-bottom: 1px solid var(--line);
  }
  li.sel {
    background: var(--raised);
  }
  li.primary {
    background: var(--hover);
  }
  li.dragging {
    opacity: 0.45;
  }
  li.drop-line {
    position: absolute;
    left: 6px;
    right: 6px;
    height: 2px;
    padding: 0;
    border: 0;
    border-radius: 2px;
    background: var(--brand);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand) 25%, transparent);
    pointer-events: none;
  }
  .drag-ghost {
    position: fixed;
    z-index: 80;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--brand);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    box-shadow: var(--elev-3);
    pointer-events: none;
    white-space: nowrap;
  }
  li.off .name,
  li.off .thumb {
    opacity: 0.45;
  }
  .ico {
    width: 28px;
    height: 100%;
    padding: 0;
    display: grid;
    place-items: center;
    background: transparent;
    color: var(--text-dim);
    border-radius: 0;
  }
  .ico:first-child {
    border-right: 1px solid var(--line);
  }
  .lock {
    color: transparent;
  }
  li:hover .lock {
    color: var(--text-faint);
  }
  .lock.on,
  li:hover .lock.on {
    color: var(--warn);
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
    background: color-mix(in srgb, var(--text) 5%, transparent);
  }
  .thumb {
    width: 24px;
    height: 22px;
    display: grid;
    place-items: center;
    background: var(--bg);
    border: 1px solid var(--line-strong);
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
  .rename {
    flex: 1;
    padding: 2px 5px;
    min-width: 0;
  }
  .tag {
    font-size: 10px;
    color: var(--text-faint);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  .tag.warn {
    color: var(--warn);
    border-color: color-mix(in srgb, var(--warn) 40%, transparent);
  }
  .tag.anim {
    color: var(--brand);
    border-color: transparent;
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
    width: 270px;
    background: var(--popover);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 4px 0;
    box-shadow: var(--highlight), var(--elev-3);
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
    background: var(--brand-strong);
    color: #fff;
  }
  .item.more {
    border-top: 1px solid var(--line);
  }
  .txt {
    display: grid;
  }
  .txt small {
    font-size: 11px;
    opacity: 0.7;
  }
</style>
