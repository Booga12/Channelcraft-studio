<script lang="ts">
  import { ask } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import { viewLabel } from '$lib/friendly';
  import type { Ratio } from '$lib/theme/context';
  import Icon from './Icon.svelte';
  import { BUILTIN_WORKSPACES, prefs, type PanelId } from '$lib/prefs.svelte';

  interface Item {
    label?: string;
    shortcut?: string;
    action?: () => void;
    disabled?: boolean;
    checked?: boolean;
    separator?: true;
    heading?: string;
  }

  let open = $state<string | null>(null);

  const isActive = $derived(!!ed.project && ed.root?.activeTheme?.toLowerCase() === ed.project.name.toLowerCase());

  async function close() {
    if (ed.dirtyCount > 0) {
      const leave = await ask(`Close ${ed.project?.name} without saving your changes?`, {
        title: 'Unsaved changes',
        kind: 'warning',
        okLabel: 'Close without saving',
        cancelLabel: 'Keep editing',
      });
      if (!leave) return;
    }
    ed.closeTheme();
  }

  async function launch() {
    if (ed.dirtyCount > 0) {
      const go = await ask('You have unsaved changes, which RetroBat will not show. Launch anyway?', { title: 'Launch RetroBat', kind: 'warning', okLabel: 'Launch', cancelLabel: 'Cancel' });
      if (!go) return;
    }
    ed.launch();
  }

  const RATIOS: { v: Ratio; label: string }[] = [
    { v: '16/9', label: 'Widescreen TV (16:9)' },
    { v: '16/10', label: 'Laptop (16:10)' },
    { v: '4/3', label: 'Old TV (4:3)' },
  ];

  const PANELS: [PanelId, string][] = [
    ['elements', 'Layers'],
    ['library', 'Add'],
    ['presets', 'Presets'],
    ['variables', 'Colours'],
    ['options', 'Options'],
    ['history', 'History'],
    ['files', 'Files'],
  ];

  async function reload() {
    if (ed.dirtyCount) {
      const ok = await ask(`Read the theme from disk again? Your unsaved changes in ${ed.dirtyCount} file(s) will be lost.`, {
        title: 'Reload from disk',
        kind: 'warning',
        okLabel: 'Reload',
        cancelLabel: 'Keep editing',
      });
      if (!ok) return;
    }
    await ed.reloadFromDisk();
  }

  function saveWorkspace() {
    const n = prefs.v.customWorkspaces.length + 1;
    const name = `My workspace ${n}`;
    prefs.saveWorkspaceAs(name);
    ed.notify(`Saved as “${name}”. Find it in the Window menu.`);
  }

  const menus = $derived<{ id: string; label: string; items: Item[] }[]>([
    {
      id: 'file',
      label: 'File',
      items: [
        { label: 'Save', shortcut: 'Ctrl+S', action: () => ed.save(), disabled: ed.dirtyCount === 0 },
        { label: 'Export as zip…', action: () => ed.exportZip() },
        { label: 'Make preview.png from this screen', action: () => ed.makePreviewImage() },
        { separator: true },
        { label: 'RetroBat menu options…', action: () => (ed.showMenuOptions = true) },
        { label: 'Check game media…', action: () => (ed.showMediaCheck = true) },
        { label: 'Restore a backup…', action: () => (ed.showRestore = true) },
        { label: 'Reload from disk', action: reload },
        { separator: true },
        { label: isActive ? 'In use by RetroBat' : 'Use in RetroBat', action: () => ed.setActive(), disabled: isActive },
        { label: 'Launch RetroBat', action: launch },
        { separator: true },
        { label: 'Settings…', shortcut: 'Ctrl+,', action: () => (ed.showSettings = true) },
        { separator: true },
        { label: 'Close theme', action: close },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => ed.undo(), disabled: !ed.canUndo },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: () => ed.redo(), disabled: !ed.canRedo },
        { separator: true },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => ed.copy(), disabled: !ed.selection.length },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => ed.paste() },
        { label: 'Duplicate', shortcut: 'Ctrl+D', action: () => ed.duplicate(), disabled: !ed.selection.length },
        { label: 'Delete', shortcut: 'Del', action: () => ed.deleteSelection(), disabled: !ed.selection.length },
        { separator: true },
        { label: 'Select all', shortcut: 'Ctrl+A', action: () => ed.selectAll() },
        { label: 'Deselect', shortcut: 'Esc', action: () => (ed.selected = null), disabled: !ed.selected },
        { separator: true },
        { label: 'Search…', shortcut: 'Ctrl+K', action: () => (ed.showSearch = true) },
      ],
    },
    {
      id: 'insert',
      label: 'Insert',
      items: [
        { label: 'Design…', action: () => ed.showPanel('presets') },
        { label: 'Ready-made elements…', action: () => ed.showPanel('library') },
        { label: 'Layout presets…', action: () => ed.showPanel('presets') },
        { label: 'Matching game video & cover…', action: () => (ed.showFeatured = true) },
        { separator: true },
        { label: 'Picture', action: () => ed.addElement('image') },
        { label: 'Text', action: () => ed.addElement('text') },
        { label: 'Panel', action: () => ed.addElement('ninepatch') },
        { label: 'Clock', action: () => ed.addElement('clock') },
      ],
    },
    {
      id: 'arrange',
      label: 'Arrange',
      items: [
        { label: 'Bring to front', shortcut: 'Ctrl+Shift+]', action: () => ed.arrange('front'), disabled: !ed.selection.length },
        { label: 'Bring forward', shortcut: 'Ctrl+]', action: () => ed.arrange('forward'), disabled: !ed.selection.length },
        { label: 'Send backward', shortcut: 'Ctrl+[', action: () => ed.arrange('backward'), disabled: !ed.selection.length },
        { label: 'Send to back', shortcut: 'Ctrl+Shift+[', action: () => ed.arrange('back'), disabled: !ed.selection.length },
        { separator: true },
        { label: 'Align left', action: () => ed.align('left'), disabled: !ed.selection.length },
        { label: 'Align centre', action: () => ed.align('hcenter'), disabled: !ed.selection.length },
        { label: 'Align right', action: () => ed.align('right'), disabled: !ed.selection.length },
        { label: 'Align top', action: () => ed.align('top'), disabled: !ed.selection.length },
        { label: 'Align middle', action: () => ed.align('vcenter'), disabled: !ed.selection.length },
        { label: 'Align bottom', action: () => ed.align('bottom'), disabled: !ed.selection.length },
        { separator: true },
        { label: 'Space evenly across', action: () => ed.distribute('h'), disabled: ed.selection.length < 3 },
        { label: 'Space evenly down', action: () => ed.distribute('v'), disabled: ed.selection.length < 3 },
        { separator: true },
        { label: 'Lock / unlock', shortcut: 'Ctrl+L', action: () => ed.selection.forEach((n) => ed.setLocked(n, !ed.locked[n])), disabled: !ed.selection.length },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        { heading: 'Screen' },
        ...ed.screens.map((t) => ({
          label: t.file === 'splash.xml' ? 'Loading screen' : t.file === 'gamesplash.xml' ? 'Game launch screen' : viewLabel(t.view, ed.themeRes?.views.get(t.view)?.displayName),
          checked: ed.view === t.view && ed.screenFile === t.file,
          action: () => ed.showScreen(t),
        })),
        { separator: true },
        { heading: 'TV shape' },
        ...RATIOS.map((r) => ({ label: r.label, checked: ed.settings.ratio === r.v, action: () => (ed.settings.ratio = r.v) })),
        { separator: true },
        { label: 'Zoom to fit', shortcut: 'Ctrl+0', action: () => (ed.zoom = 'fit') },
        { label: 'Actual size', shortcut: 'Ctrl+1', action: () => (ed.zoom = 1) },
        { separator: true },
        { label: 'Grid', shortcut: "Ctrl+'", checked: prefs.v.showGrid, action: () => prefs.set('showGrid', !prefs.v.showGrid) },
        { label: 'TV safe area', checked: prefs.v.showSafeArea, action: () => prefs.set('showSafeArea', !prefs.v.showSafeArea) },
        { label: 'Rulers', checked: prefs.v.showRulers, action: () => prefs.set('showRulers', !prefs.v.showRulers) },
        { label: 'Snap to guides', checked: prefs.v.snap, action: () => prefs.set('snap', !prefs.v.snap) },
        { label: 'Play animations', shortcut: 'P', checked: ed.playAnimations, action: () => (ed.playAnimations = !ed.playAnimations) },
        { label: 'Six systems at once', checked: ed.contactSheet, action: () => (ed.contactSheet = !ed.contactSheet) },
        { separator: true },
        { label: 'Simple mode', checked: ed.simple, action: () => ed.setMode('simple') },
        { label: 'Advanced mode', checked: !ed.simple, action: () => ed.setMode('advanced') },
        ...(ed.simple ? [] : [{ label: 'XML source', checked: ed.showSource, action: () => (ed.showSource = !ed.showSource) }]),
      ],
    },
    {
      id: 'window',
      label: 'Window',
      items: [
        { heading: 'Workspace' },
        ...[...BUILTIN_WORKSPACES, ...prefs.v.customWorkspaces].map((w) => ({ label: w.name, checked: prefs.v.workspace.name === w.name, action: () => prefs.setWorkspace(w) })),
        { label: 'Save this workspace', action: saveWorkspace },
        ...(prefs.v.customWorkspaces.some((w) => w.name === prefs.v.workspace.name) ? [{ label: `Delete “${prefs.v.workspace.name}”`, action: () => (prefs.deleteWorkspace(prefs.v.workspace.name), prefs.setWorkspace(BUILTIN_WORKSPACES[0])) }] : []),
        { separator: true },
        { heading: 'Panels' },
        ...PANELS.map(([id, label]) => ({ label, checked: !prefs.v.workspace.hidden?.includes(id), action: () => (prefs.v.workspace.hidden?.includes(id) ? (prefs.movePanel(id, 'bottom'), ed.showPanel(id)) : prefs.movePanel(id, null)) })),
        { separator: true },
        { label: 'Tools', checked: prefs.v.workspace.showRail, action: () => ((prefs.v.workspace.showRail = !prefs.v.workspace.showRail), prefs.save()) },
        { label: 'Quick settings bar', checked: prefs.v.workspace.showOptionsBar, action: () => ((prefs.v.workspace.showOptionsBar = !prefs.v.workspace.showOptionsBar), prefs.save()) },
        { label: `Panels on the ${prefs.v.workspace.dockSide === 'right' ? 'left' : 'right'}`, action: () => ((prefs.v.workspace.dockSide = prefs.v.workspace.dockSide === 'right' ? 'left' : 'right'), prefs.save()) },
        { label: 'Reset workspace', action: () => prefs.setWorkspace(BUILTIN_WORKSPACES[0]) },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { label: 'Getting started', action: () => (ed.showGuide = true) },
        { label: 'Keyboard shortcuts', shortcut: '?', action: () => (ed.showShortcuts = true) },
        { label: 'Search for anything', shortcut: 'Ctrl+K', action: () => (ed.showSearch = true) },
      ],
    },
  ]);

  function run(item: Item) {
    if (item.disabled || !item.action) return;
    open = null;
    item.action();
  }
</script>

<svelte:window onclick={() => (open = null)} onkeydown={(e) => e.key === 'Escape' && (open = null)} />

<header class="menubar">
  <div class="mark" title="ChannelCraft Studio" aria-hidden="true"><span>Cc</span></div>
  <nav class="menus" aria-label="Menu">
    {#each menus as m}
      <div class="menu">
        <button
          class="top"
          class:open={open === m.id}
          onclick={(e) => {
            e.stopPropagation();
            open = open === m.id ? null : m.id;
          }}
          onmouseenter={() => open && (open = m.id)}>{m.label}</button
        >
        {#if open === m.id}
          <div class="drop" role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
            {#each m.items as it}
              {#if it.separator}
                <div class="sep"></div>
              {:else if it.heading}
                <div class="heading">{it.heading}</div>
              {:else}
                <button class="item" role="menuitem" disabled={it.disabled} onclick={() => run(it)}>
                  <span class="tick">{#if it.checked}<Icon name="check" size={14} />{/if}</span>
                  <span class="lbl">{it.label}</span>
                  {#if it.shortcut}<span class="kbd">{it.shortcut}</span>{/if}
                </button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </nav>

  <div class="doc" title={ed.project?.dir}>
    <div class="history-btns" role="group" aria-label="Undo and redo">
      <button onclick={() => ed.undo()} disabled={!ed.canUndo} title={ed.canUndo ? `Undo ${ed.history.done[ed.history.done.length - 1] ?? ''} (Ctrl+Z)` : 'Nothing to undo'}><Icon name="undo" size={15} /></button>
      <button onclick={() => ed.redo()} disabled={!ed.canRedo} title={ed.canRedo ? `Redo ${ed.history.undone[0] ?? ''} (Ctrl+Y)` : 'Nothing to redo'}><Icon name="redo" size={15} /></button>
    </div>
    <span class="name">{ed.project?.name}</span>
    {#if ed.dirtyCount > 0}<span class="dot" title="Unsaved changes">●</span>{/if}
    {#if isActive}<span class="badge accent">In use by RetroBat</span>{/if}
    <button class="search" onclick={() => (ed.showSearch = true)} title="Search for any command, element or setting (Ctrl+K)">
      <Icon name="zoomIn" size={13} /> Search <kbd>Ctrl K</kbd>
    </button>
  </div>

  <div class="right">
    <div class="mode" role="group" aria-label="Editor mode">
      <button class:sel={ed.simple} onclick={() => ed.setMode('simple')} title="Plain names and the most useful settings">Simple</button>
      <button class:sel={!ed.simple} onclick={() => ed.setMode('advanced')} title="Every setting, file names and the XML source">Advanced</button>
    </div>
    <button class="secondary" onclick={launch} title="Start RetroBat to see the theme for real"><Icon name="play" size={13} /> Launch</button>
    {#if !isActive}
      <button class="secondary" onclick={() => ed.setActive()} title="Make RetroBat use this theme (your RetroBat settings are backed up first)">Use in RetroBat</button>
    {/if}
    <button class="primary" onclick={() => ed.save()} disabled={ed.dirtyCount === 0 || ed.busy} title="Save your changes (Ctrl+S). A backup is made first.">
      {ed.dirtyCount ? 'Save' : 'Saved'}
    </button>
  </div>
</header>

<style>
  .menubar {
    grid-area: menu;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 10px 0 8px;
    background: var(--frame);
    border-bottom: 1px solid var(--line);
  }
  .mark {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: linear-gradient(135deg, #2680eb, #7e4bd6);
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 12px;
    color: #fff;
    letter-spacing: -0.5px;
    margin-right: 4px;
  }
  .menus {
    display: flex;
  }
  .menu {
    position: relative;
  }
  .top {
    background: transparent;
    padding: 4px 9px;
    color: var(--text-dim);
  }
  .top:hover,
  .top.open {
    background: var(--raised);
    color: var(--text);
  }
  .drop {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 230px;
    background: #2f2f2f;
    border: 1px solid #3f3f3f;
    border-radius: 6px;
    padding: 4px 0;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
    z-index: 300;
  }
  .item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border-radius: 0;
    padding: 5px 14px 5px 8px;
    text-align: left;
  }
  .item:hover:not(:disabled) {
    background: var(--accent-strong);
    color: #fff;
  }
  .tick {
    width: 16px;
    display: grid;
    place-items: center;
  }
  .lbl {
    flex: 1;
  }
  .kbd {
    color: var(--text-faint);
    font-size: 11px;
  }
  .item:hover .kbd {
    color: #fff;
  }
  .sep {
    height: 1px;
    background: #444;
    margin: 4px 0;
  }
  .heading {
    padding: 6px 14px 2px 30px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }
  .doc {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .doc .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .history-btns {
    display: flex;
    gap: 2px;
    margin-right: 6px;
  }
  .history-btns button {
    background: transparent;
    padding: 4px 6px;
    color: var(--text-dim);
  }
  .history-btns button:hover:not(:disabled) {
    background: var(--raised);
    color: var(--text);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 10px;
    background: var(--bg);
    border: 1px solid #3a3a3a;
    border-radius: 14px;
    padding: 3px 10px;
    color: var(--text-faint);
  }
  .search:hover {
    color: var(--text-dim);
    border-color: #555;
  }
  .search kbd {
    font: 10px var(--mono);
    color: var(--text-faint);
  }
  .dot {
    color: var(--text-dim);
    font-size: 9px;
  }
  .right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .right button {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .mode {
    display: flex;
    background: var(--bg);
    border-radius: 16px;
    padding: 2px;
    margin-right: 4px;
  }
  .mode button {
    background: transparent;
    border-radius: 14px;
    padding: 3px 11px;
    color: var(--text-dim);
  }
  .mode button.sel {
    background: var(--raised);
    color: var(--text);
  }
</style>
