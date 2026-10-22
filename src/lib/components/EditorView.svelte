<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import { prefs, type PanelId } from '$lib/prefs.svelte';
  import MenuBar from './MenuBar.svelte';
  import OptionsBar from './OptionsBar.svelte';
  import ToolRail from './ToolRail.svelte';
  import ScreenTabs from './ScreenTabs.svelte';
  import PanelGroup from './PanelGroup.svelte';
  import ElementList from './ElementList.svelte';
  import OptionsPanel from './OptionsPanel.svelte';
  import VariablesPanel from './VariablesPanel.svelte';
  import FilesPanel from './FilesPanel.svelte';
  import Preview from './Preview.svelte';
  import PropertyPanel from './PropertyPanel.svelte';
  import SourceView from './SourceView.svelte';
  import LibraryPanel from './LibraryPanel.svelte';
  import AssetsPanel from './AssetsPanel.svelte';
  import AssetDragLayer from './AssetDragLayer.svelte';
  import PresetsPanel from './PresetsPanel.svelte';
  import HistoryPanel from './HistoryPanel.svelte';
  import ContextMenu, { type MenuItem } from './ContextMenu.svelte';

  const ws = $derived(prefs.v.workspace);

  const LABELS = $derived<Record<PanelId, { label: string; title: string; count?: number }>>({
    properties: { label: 'Properties', title: 'Settings of the selected element' },
    elements: { label: 'Layers', title: 'Everything drawn on this screen', count: [...(ed.currentView?.elements.values() ?? [])].filter((e) => e.type !== 'gameextras').length },
    library: { label: 'Add', title: 'Ready-made elements that show RetroBat’s game and system data' },
    assets: { label: 'Assets', title: 'Your own pictures, videos, sounds and fonts; drag one onto an element to use it', count: ed.library.length || undefined },
    presets: { label: 'Presets', title: 'Designs, layouts, colour palettes' },
    variables: { label: ed.simple ? 'Colours' : 'Variables', title: 'Colours and values shared across the theme' },
    options: { label: 'Options', title: 'Choices the theme offers inside RetroBat', count: ed.res?.subsets.length },
    history: { label: 'History', title: 'Every change; click one to go back to it', count: ed.history.done.length || undefined },
    files: { label: 'Files', title: 'XML files in the theme' },
  });

  const visible = (ids: PanelId[]) => ids.filter((id) => !(ed.simple && id === 'files'));
  const tabsFor = (ids: PanelId[]) => visible(ids).map((id) => ({ id, ...LABELS[id] }));

  // Which tab each group shows. Asking for a panel (e.g. the Add button) brings it forward.
  let topActive = $state<string>('properties');
  let bottomActive = $state<string>('elements');
  let topCollapsed = $state(false);
  let bottomCollapsed = $state(false);

  $effect(() => {
    ed.panelRequest;
    const want = ed.leftTab as PanelId;
    if (ws.top.includes(want)) {
      topActive = want;
      topCollapsed = false;
    } else if (ws.bottom.includes(want)) {
      bottomActive = want;
      bottomCollapsed = false;
    } else if (ws.hidden?.includes(want)) {
      prefs.movePanel(want, 'bottom');
    }
  });
  $effect(() => {
    if (!ws.top.includes(topActive as PanelId)) topActive = ws.top[0] ?? '';
    if (!ws.bottom.includes(bottomActive as PanelId)) bottomActive = ws.bottom[0] ?? '';
  });

  let dock: HTMLElement;
  function startSplit(e: PointerEvent) {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = dock.getBoundingClientRect();
      ws.split = Math.min(0.85, Math.max(0.15, (ev.clientY - r.top) / r.height));
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      prefs.save();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  }

  function startWidth(e: PointerEvent) {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const sx = e.clientX;
    const w0 = ws.dockWidth;
    const move = (ev: PointerEvent) => {
      const d = ev.clientX - sx;
      ws.dockWidth = Math.min(560, Math.max(260, ws.dockSide === 'right' ? w0 - d : w0 + d));
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      prefs.save();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  }

  let tabMenu = $state<{ x: number; y: number; id: PanelId; group: 'top' | 'bottom' } | null>(null);
  const tabMenuItems = $derived<MenuItem[]>(
    tabMenu
      ? [
          { label: tabMenu.group === 'top' ? 'Move to the lower panel' : 'Move to the upper panel', action: () => prefs.movePanel(tabMenu!.id, tabMenu!.group === 'top' ? 'bottom' : 'top') },
          { label: 'Close this panel', action: () => prefs.movePanel(tabMenu!.id, null), disabled: tabMenu.id === 'properties' },
          { separator: true },
          { label: `Dock panels on the ${ws.dockSide === 'right' ? 'left' : 'right'}`, action: () => ((ws.dockSide = ws.dockSide === 'right' ? 'left' : 'right'), prefs.save()) },
        ]
      : [],
  );

  function inField(t: EventTarget | null) {
    const el = t as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  function onkeydown(e: KeyboardEvent) {
    if (ed.showSearch || ed.showSettings || ed.showShortcuts || ed.showGuide) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const typing = inField(e.target);
    const run = (f: () => void) => {
      e.preventDefault();
      f();
    };
    if (mod && k === 's') return run(() => ed.save());
    if (mod && k === 'k') return run(() => (ed.showSearch = true));
    if (mod && k === ',') return run(() => (ed.showSettings = true));
    if (mod && !e.shiftKey && k === 'z') return run(() => ed.undo());
    if (mod && (k === 'y' || (e.shiftKey && k === 'z'))) return run(() => ed.redo());
    if (mod && k === '0') return run(() => (ed.zoom = 'fit'));
    if (mod && k === '1') return run(() => (ed.zoom = 1));
    if (mod && (k === '=' || k === '+')) return run(() => (ed.zoom = Math.min(2, (typeof ed.zoom === 'number' ? ed.zoom : 0.5) * 1.25)));
    if (mod && k === '-') return run(() => (ed.zoom = Math.max(0.1, (typeof ed.zoom === 'number' ? ed.zoom : 0.5) / 1.25)));
    if (mod && k === "'") return run(() => prefs.set('showGrid', !prefs.v.showGrid));
    if (typing) return;
    if (mod && k === 'd') return run(() => ed.duplicate());
    if (mod && k === 'c') return run(() => ed.copy());
    if (mod && k === 'v') return run(() => ed.paste());
    if (mod && k === 'a') return run(() => ed.selectAll());
    if (mod && k === 'l') return run(() => ed.selection.forEach((n) => ed.setLocked(n, !ed.locked[n])));
    if (mod && e.key === ']') return run(() => ed.arrange(e.shiftKey ? 'front' : 'forward'));
    if (mod && e.key === '[') return run(() => ed.arrange(e.shiftKey ? 'back' : 'backward'));
    if (e.key === 'Delete' || e.key === 'Backspace') return ed.selection.length ? run(() => ed.deleteSelection()) : undefined;
    if (e.key === 'PageDown') return run(() => ed.stepSystem(1));
    if (e.key === 'PageUp') return run(() => ed.stepSystem(-1));
    if (!mod && k === 'p') return run(() => (ed.playAnimations = !ed.playAnimations));
    if (e.key === '?') return run(() => (ed.showShortcuts = true));
    if (ed.selection.length && e.key.startsWith('Arrow')) {
      const step = e.shiftKey ? 0.01 : 0.001;
      const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key] ?? [0, 0];
      return run(() => ed.nudge(dx, dy));
    }
    if (e.key === 'Escape') ed.selected = null;
  }
</script>

<svelte:window {onkeydown} />

{#snippet panelBody(id: string)}
  {#if id === 'properties'}
    <PropertyPanel />
  {:else if id === 'elements'}
    <ElementList />
  {:else if id === 'library'}
    <LibraryPanel />
  {:else if id === 'assets'}
    <AssetsPanel />
  {:else if id === 'presets'}
    <PresetsPanel />
  {:else if id === 'variables'}
    <VariablesPanel />
  {:else if id === 'options'}
    <OptionsPanel />
  {:else if id === 'history'}
    <HistoryPanel />
  {:else if id === 'files'}
    <FilesPanel />
  {/if}
{/snippet}

<div
  class="editor"
  class:left-dock={ws.dockSide === 'left'}
  class:no-rail={!ws.showRail}
  class:no-opts={!ws.showOptionsBar}
  style:--dock="{ws.dockWidth}px"
>
  <MenuBar />
  {#if ws.showOptionsBar}<OptionsBar />{/if}
  {#if ws.showRail}<ToolRail />{/if}
  <main class="main" class:with-source={ed.showSource && !ed.simple}>
    <ScreenTabs />
    <div class="canvas"><Preview /></div>
    {#if ed.showSource && !ed.simple}
      <section class="source"><SourceView /></section>
    {/if}
  </main>
  <aside class="dock" bind:this={dock}>
    <div class="width-grip" role="separator" aria-orientation="vertical" title="Drag to resize the panels" onpointerdown={startWidth}></div>
    {#if visible(ws.top).length}
      <div class="slot" style:flex={topCollapsed ? 'none' : bottomCollapsed || !visible(ws.bottom).length ? '1' : `${ws.split} 1 0`}>
        <PanelGroup tabs={tabsFor(ws.top)} bind:active={topActive} bind:collapsed={topCollapsed} ontabmenu={(id, x, y) => (tabMenu = { id: id as PanelId, x, y, group: 'top' })}>
          {@render panelBody(topActive)}
        </PanelGroup>
      </div>
    {/if}
    {#if visible(ws.top).length && visible(ws.bottom).length && !topCollapsed && !bottomCollapsed}
      <div class="splitter" role="separator" aria-orientation="horizontal" title="Drag to resize" onpointerdown={startSplit}></div>
    {/if}
    {#if visible(ws.bottom).length}
      <div class="slot" style:flex={bottomCollapsed ? 'none' : topCollapsed || !visible(ws.top).length ? '1' : `${1 - ws.split} 1 0`}>
        <PanelGroup tabs={tabsFor(ws.bottom)} bind:active={bottomActive} bind:collapsed={bottomCollapsed} ontabmenu={(id, x, y) => (tabMenu = { id: id as PanelId, x, y, group: 'bottom' })}>
          {@render panelBody(bottomActive)}
        </PanelGroup>
      </div>
    {/if}
  </aside>
</div>

<AssetDragLayer />

{#if tabMenu}
  <ContextMenu x={tabMenu.x} y={tabMenu.y} items={tabMenuItems} onclose={() => (tabMenu = null)} />
{/if}

<style>
  .editor {
    height: 100vh;
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) var(--dock);
    grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas:
      'menu menu menu'
      'opts opts opts'
      'rail main dock';
    background: var(--canvas);
  }
  .editor.left-dock {
    grid-template-columns: var(--dock) minmax(0, 1fr) 44px;
    grid-template-areas:
      'menu menu menu'
      'opts opts opts'
      'dock main rail';
  }
  .editor.no-rail {
    grid-template-columns: 0 minmax(0, 1fr) var(--dock);
  }
  .editor.no-rail.left-dock {
    grid-template-columns: var(--dock) minmax(0, 1fr) 0;
  }
  .editor.no-opts {
    grid-template-rows: auto 0 minmax(0, 1fr);
  }
  .main {
    grid-area: main;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
  }
  .main.with-source {
    grid-template-rows: auto minmax(0, 1fr) minmax(150px, 32vh);
  }
  .canvas {
    min-height: 0;
    min-width: 0;
  }
  .source {
    min-height: 0;
    border-top: 1px solid var(--line);
    background: var(--panel);
  }
  .dock {
    grid-area: dock;
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    background: var(--line);
    border-left: 1px solid var(--line);
  }
  .left-dock .dock {
    border-left: none;
    border-right: 1px solid var(--line);
  }
  .width-grip {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    width: 6px;
    cursor: col-resize;
    z-index: 5;
  }
  .left-dock .width-grip {
    left: auto;
    right: -3px;
  }
  .width-grip:hover {
    background: var(--accent-soft);
  }
  .slot {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .slot > :global(.group) {
    flex: 1;
  }
  .splitter {
    height: 5px;
    flex: none;
    cursor: row-resize;
    background: var(--line);
  }
  .splitter:hover {
    background: var(--accent-strong);
  }
</style>
