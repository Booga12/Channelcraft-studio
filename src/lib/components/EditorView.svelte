<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import { fmtNum, parsePair } from '$lib/theme/schema';
  import Toolbar from './Toolbar.svelte';
  import ElementList from './ElementList.svelte';
  import OptionsPanel from './OptionsPanel.svelte';
  import VariablesPanel from './VariablesPanel.svelte';
  import FilesPanel from './FilesPanel.svelte';
  import Preview from './Preview.svelte';
  import PropertyPanel from './PropertyPanel.svelte';
  import SourceView from './SourceView.svelte';
  import Guide from './Guide.svelte';

  const tabs = $derived(
    ed.simple
      ? ([
          { id: 'elements', label: 'Elements', title: 'Everything drawn on this screen' },
          { id: 'options', label: 'Options', title: 'Choices the theme offers in RetroBat' },
          { id: 'variables', label: 'Colours', title: 'Colours shared across the theme' },
        ] as const)
      : ([
          { id: 'elements', label: 'Elements', title: 'Everything drawn in this view' },
          { id: 'options', label: 'Options', title: 'Theme options (subsets)' },
          { id: 'variables', label: 'Variables', title: 'Theme variables' },
          { id: 'files', label: 'Files', title: 'XML files in the theme' },
        ] as const),
  );

  function inField(t: EventTarget | null) {
    const el = t as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  function onkeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      ed.save();
    } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      ed.undo();
    } else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      ed.redo();
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

<div class="editor" class:with-source={ed.showSource}>
  <Toolbar />
  <aside class="left">
    <nav class="tabs">
      {#each tabs as t}
        <button class="tab" class:on={ed.leftTab === t.id} onclick={() => (ed.leftTab = t.id)} title={t.title}>
          {t.label}
          {#if t.id === 'options' && ed.res?.subsets.length}<span class="count">{ed.res.subsets.length}</span>{/if}
        </button>
      {/each}
    </nav>
    <div class="tab-body">
      {#if ed.leftTab === 'elements'}
        <ElementList />
      {:else if ed.leftTab === 'options'}
        <OptionsPanel />
      {:else if ed.leftTab === 'variables'}
        <VariablesPanel />
      {:else}
        <FilesPanel />
      {/if}
    </div>
  </aside>
  <main class="center">
    <Preview />
  </main>
  <aside class="right">
    <PropertyPanel />
  </aside>
  {#if ed.showSource}
    <section class="bottom">
      <SourceView />
    </section>
  {/if}
</div>

{#if ed.showGuide}
  <Guide />
{/if}

<style>
  .editor {
    height: 100vh;
    display: grid;
    grid-template-columns: 270px minmax(0, 1fr) 340px;
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas:
      'top top top'
      'left center right';
  }
  .editor.with-source {
    grid-template-rows: auto minmax(0, 1fr) minmax(160px, 34vh);
    grid-template-areas:
      'top top top'
      'left center right'
      'left bottom right';
  }
  .left {
    grid-area: left;
    background: var(--panel);
    border-right: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--line);
    padding: 0 6px;
  }
  .tab {
    flex: 1;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    padding: 9px 4px 7px;
    color: var(--text-dim);
    font-size: 12px;
  }
  .tab:hover:not(:disabled) {
    background: none;
    color: var(--text);
  }
  .tab.on {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .count {
    font-size: 10px;
    color: var(--text-faint);
    margin-left: 2px;
  }
  .tab-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .center {
    grid-area: center;
    min-width: 0;
    min-height: 0;
    background: #0d0e11;
  }
  .right {
    grid-area: right;
    background: var(--panel);
    border-left: 1px solid var(--line);
    min-height: 0;
    overflow: auto;
  }
  .bottom {
    grid-area: bottom;
    border-top: 1px solid var(--line);
    min-height: 0;
    background: var(--panel);
  }
</style>
