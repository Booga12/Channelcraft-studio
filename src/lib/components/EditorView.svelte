<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import { fmtNum, parsePair } from '$lib/theme/schema';
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
  import PresetsPanel from './PresetsPanel.svelte';

  const bottomTabs = $derived([
    { id: 'elements', label: 'Layers', title: 'Everything drawn on this screen', count: ed.currentView?.elements.size },
    { id: 'library', label: 'Add', title: 'Ready-made elements that show RetroBat’s game and system data' },
    { id: 'presets', label: 'Presets', title: 'Layouts for this screen and colour palettes' },
    { id: 'variables', label: ed.simple ? 'Colours' : 'Variables', title: 'Colours and values shared across the theme' },
    { id: 'options', label: 'Options', title: 'Choices the theme offers inside RetroBat', count: ed.res?.subsets.length },
    ...(ed.simple ? [] : [{ id: 'files', label: 'Files', title: 'XML files in the theme' }]),
  ]);

  let propTab = $state('properties');
  let propCollapsed = $state(false);
  let bottomCollapsed = $state(false);

  // Height of the Properties panel as a share of the dock; drag the divider to change it.
  let split = $state(0.56);
  let dock: HTMLElement;
  function startSplit(e: PointerEvent) {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = dock.getBoundingClientRect();
      split = Math.min(0.85, Math.max(0.2, (ev.clientY - r.top) / r.height));
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  }

  function inField(t: EventTarget | null) {
    const el = t as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  function onkeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 's') {
      e.preventDefault();
      ed.save();
    } else if (mod && !e.shiftKey && k === 'z') {
      e.preventDefault();
      ed.undo();
    } else if (mod && (k === 'y' || (e.shiftKey && k === 'z'))) {
      e.preventDefault();
      ed.redo();
    } else if (mod && k === '0') {
      e.preventDefault();
      ed.zoom = 'fit';
    } else if (mod && k === '1') {
      e.preventDefault();
      ed.zoom = 1;
    } else if (!inField(e.target) && ed.selectedElement && e.key.startsWith('Arrow')) {
      // Nudge the selected element; Shift moves ten times further.
      const pos = parsePair(ed.selectedElement.props.get('pos')?.value) ?? [0, 0];
      const step = e.shiftKey ? 0.01 : 0.001;
      const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key] ?? [0, 0];
      e.preventDefault();
      ed.setProp(ed.selectedElement.name, 'pos', `${fmtNum(pos[0] + dx)} ${fmtNum(pos[1] + dy)}`, { coalesce: `nudge.${ed.selectedElement.name}` });
    } else if (e.key === 'Escape' && ed.showGuide) {
      ed.closeGuide();
    } else if (!inField(e.target) && e.key === 'Escape') {
      ed.selected = null;
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="editor">
  <MenuBar />
  <OptionsBar />
  <ToolRail />
  <main class="main" class:with-source={ed.showSource && !ed.simple}>
    <ScreenTabs />
    <div class="canvas"><Preview /></div>
    {#if ed.showSource && !ed.simple}
      <section class="source"><SourceView /></section>
    {/if}
  </main>
  <aside class="dock" bind:this={dock}>
    <div class="slot" style:flex={propCollapsed ? 'none' : bottomCollapsed ? '1' : `${split} 1 0`}>
      <PanelGroup tabs={[{ id: 'properties', label: 'Properties' }]} bind:active={propTab} bind:collapsed={propCollapsed}>
        <PropertyPanel />
      </PanelGroup>
    </div>
    {#if !propCollapsed && !bottomCollapsed}
      <div class="splitter" role="separator" aria-orientation="horizontal" title="Drag to resize" onpointerdown={startSplit}></div>
    {/if}
    <div class="slot" style:flex={bottomCollapsed ? 'none' : propCollapsed ? '1' : `${1 - split} 1 0`}>
      <PanelGroup tabs={bottomTabs} bind:active={ed.leftTab} bind:collapsed={bottomCollapsed}>
        {#if ed.leftTab === 'elements'}
          <ElementList />
        {:else if ed.leftTab === 'library'}
          <LibraryPanel />
        {:else if ed.leftTab === 'presets'}
          <PresetsPanel />
        {:else if ed.leftTab === 'options'}
          <OptionsPanel />
        {:else if ed.leftTab === 'variables'}
          <VariablesPanel />
        {:else}
          <FilesPanel />
        {/if}
      </PanelGroup>
    </div>
  </aside>
</div>

<style>
  .editor {
    height: 100vh;
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 330px;
    grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas:
      'menu menu menu'
      'opts opts opts'
      'rail main dock';
    background: var(--canvas);
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
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--line);
    border-left: 1px solid var(--line);
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
