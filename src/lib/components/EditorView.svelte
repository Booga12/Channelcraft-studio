<script lang="ts">
  // The editor: one bar on top, and the preview filling the rest with floating tools over it
  // (the dock and its panel on the left, the inspector on the right when something is selected).
  import { onMount, untrack } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { ed } from '$lib/editor.svelte';
  import { prefs, type PanelId } from '$lib/prefs.svelte';
  import { elementLabel, typeLabel } from '$lib/friendly';
  import TopBar from './editor/TopBar.svelte';
  import ToolDock, { PANELS } from './editor/ToolDock.svelte';
  import FloatingPanel from './editor/FloatingPanel.svelte';
  import QuickBar from './editor/QuickBar.svelte';
  import { scope } from './editor/ScopeSwitch.svelte';
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
  import SoundPanel from './SoundPanel.svelte';
  import HistoryPanel from './HistoryPanel.svelte';

  // The first time a theme is open, a short tour of the editor (after the layout has settled, and
  // not over a dialog such as recovering unsaved edits; then it waits for the next time).
  onMount(() => {
    const t = setTimeout(() => !document.querySelector('[role="dialog"], [role="alertdialog"]') && ed.firstTour(), 700);
    return () => clearTimeout(t);
  });

  /** The dock panel that is open, if any. */
  let open = $state<PanelId | null>(null);
  const info = $derived(PANELS.find((p) => p.id === open) ?? null);
  const el = $derived(ed.selectedElement);
  const inspecting = $derived(ed.selection.length > 0 && !ed.contactSheet);
  const source = $derived(ed.showSource && !ed.simple);

  // Asking for a panel (the Insert menu, search, dropping a file…) opens it.
  $effect(() => {
    ed.panelRequest;
    const want = ed.leftTab;
    if (want !== 'properties') open = want as PanelId;
  });
  $effect(() => {
    if (ed.simple && open === 'files') open = null;
  });
  // A design theme's artwork is redrawn whenever its design colours change.
  $effect(() => {
    ed.rev;
    ed.project;
    untrack(() => ed.syncDesignArt());
  });

  // The preview fits in the space the floating parts leave free.
  const GAP = 12;
  const DOCK = 64;
  const insetL = $derived(GAP + DOCK + (open ? 8 + prefs.v.panelWidth : 0) + 16);
  const insetR = $derived(inspecting ? GAP + prefs.v.inspectorWidth + 16 : 20);
  const insetB = 56;

  /** Clicking the empty area around the screen closes a panel that isn't pinned. */
  function onbackground(e: PointerEvent) {
    const t = e.target as HTMLElement;
    if (open && !prefs.v.pinPanel && t.classList.contains('host')) open = null;
  }

  function inField(t: EventTarget | null) {
    const el = t as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  let pasteWaiting = false;

  /** Ctrl+V: a picture on the clipboard becomes a new layer; otherwise copied parts are pasted. */
  function onpaste(e: ClipboardEvent) {
    if (inField(e.target) || !ed.project || ed.showSearch || ed.showSettings || ed.showShortcuts || ed.showGuide || ed.showTour) return;
    pasteWaiting = false;
    const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
    e.preventDefault();
    if (file) ed.pasteImage(file);
    else ed.paste();
  }

  function onkeydown(e: KeyboardEvent) {
    if (ed.showSearch || ed.showSettings || ed.showShortcuts || ed.showGuide || ed.showTour) return;
    // A menu or popover handles its own keys (an Escape there closes only it).
    if (document.querySelector('[data-slot$="-content"][data-state="open"]')) return;
    if ((e.target as HTMLElement | null)?.closest?.('[data-slot$="-content"]')) return;
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
    if (mod && k === 'v') {
      // Not prevented, so the browser's paste event brings a copied picture (see onpaste). When
      // no paste event comes (nothing the webview can read), copied parts are pasted as before.
      pasteWaiting = true;
      setTimeout(() => {
        if (!pasteWaiting) return;
        pasteWaiting = false;
        ed.paste();
      }, 120);
      return;
    }
    if (mod && k === 'a') return run(() => ed.selectAll());
    if (mod && k === 'l') return run(() => ed.selection.forEach((n) => ed.setLocked(n, !ed.locked[n])));
    if (mod && e.key === ']') return run(() => ed.arrange(e.shiftKey ? 'front' : 'forward'));
    if (mod && e.key === '[') return run(() => ed.arrange(e.shiftKey ? 'back' : 'backward'));
    if (e.key === 'Delete' || e.key === 'Backspace') return ed.selection.length ? run(() => ed.deleteSelection()) : undefined;
    if (e.key === 'PageDown') return run(() => ed.stepSystem(1));
    if (e.key === 'PageUp') return run(() => ed.stepSystem(-1));
    if (!mod && k === 'p') return run(() => (ed.playAnimations = !ed.playAnimations));
    if (!mod && k === 'r') return run(() => ed.replayAnimations());
    // With nothing selected, the arrows move through games (or consoles), as in RetroBat, and the animations play.
    if (!ed.selection.length && !mod && e.key.startsWith('Arrow')) {
      const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      return run(() => (ed.view === 'system' ? ed.stepSystem(dir) : ed.stepGame(dir)));
    }
    if (e.key === '?') return run(() => (ed.showShortcuts = true));
    if (ed.selection.length && e.key.startsWith('Arrow')) {
      const step = e.shiftKey ? 0.01 : 0.001;
      const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key] ?? [0, 0];
      return run(() => ed.nudge(dx, dy));
    }
    if (e.key === 'Escape') {
      // First the selection, then a panel that isn't pinned.
      if (ed.selected) ed.selected = null;
      else if (open && !prefs.v.pinPanel) open = null;
    }
  }
</script>

<svelte:window {onkeydown} {onpaste} />

{#snippet panelBody(id: PanelId)}
  {#if id === 'elements'}
    <ElementList />
  {:else if id === 'library'}
    <LibraryPanel />
  {:else if id === 'assets'}
    <AssetsPanel />
  {:else if id === 'presets'}
    <PresetsPanel />
  {:else if id === 'sound'}
    <SoundPanel />
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

<div class="flex h-screen flex-col overflow-hidden bg-[var(--canvas)]">
  <TopBar />
  <div class="relative min-h-0 flex-1">
    <main
      class="absolute inset-0 flex flex-col"
      style:--inset-l="{insetL}px"
      style:--inset-r="{insetR}px"
      style:--inset-b="{insetB}px"
      onpointerdowncapture={onbackground}
    >
      <div class="min-h-0 flex-1"><Preview /></div>
      {#if source}
        <section
          class="relative z-10 mb-3 h-[32vh] min-h-[150px] overflow-hidden rounded-2xl bg-card shadow-elev-3 ring-1 ring-foreground/8"
          style:margin-left="{insetL - 16}px"
          style:margin-right="{insetR - 16}px"
          transition:fly={{ y: 24, duration: 240, easing: cubicOut }}
        >
          <SourceView />
        </section>
      {/if}
    </main>

    <!-- Where edits go: an amber edge around the work area while edits are limited to one console or game. -->
    {#if scope.mode !== 'all'}
      <div class="pointer-events-none absolute inset-0 z-[5] rounded-[2px] shadow-[inset_0_0_0_2px_var(--scope),inset_0_0_40px_-12px_var(--scope)]" transition:fade={{ duration: 200 }}></div>
      <div class="pointer-events-none absolute top-3 z-[6] -translate-x-1/2 rounded-full bg-scope px-3 py-1 text-xs font-semibold text-black shadow-elev-2" style:left="calc(({insetL}px + 100% - {insetR}px) / 2)" transition:fly={{ y: -8, duration: 220, easing: cubicOut }}>
        Changes only go to {scope.mode === 'game' ? ed.gameName : ed.consoleName}
      </div>
    {/if}

    <div class="pointer-events-none absolute top-3 bottom-3 left-3 z-10 flex items-start gap-2">
      <div class="pointer-events-auto"><ToolDock bind:open /></div>
      {#if open && info}
        <div class="pointer-events-auto flex h-full" transition:fly={{ x: -16, duration: 220, easing: cubicOut }}>
          <FloatingPanel
            title={open === 'variables' && !ed.simple ? 'Variables' : info.label}
            subtitle={info.help}
            bind:width={prefs.v.panelWidth}
            onresized={() => prefs.save()}
            pinned={prefs.v.pinPanel}
            onpin={() => prefs.set('pinPanel', !prefs.v.pinPanel)}
            onclose={() => (open = null)}
          >
            {#key open}
              <div class="h-full" in:fade={{ duration: 150 }}>{@render panelBody(open)}</div>
            {/key}
          </FloatingPanel>
        </div>
      {/if}
    </div>

    {#if inspecting}
      <div class="absolute top-3 right-3 bottom-3 z-10 flex" transition:fly={{ x: 24, duration: 260, easing: cubicOut }}>
        <FloatingPanel
          title={ed.selection.length > 1 ? `${ed.selection.length} elements` : el ? (ed.simple ? elementLabel(el.name) : el.name) : 'Inspector'}
          subtitle={ed.selection.length > 1 ? 'Line them up, or change them together' : el ? typeLabel(el.type) : ''}
          edge="left"
          min={280}
          bind:width={prefs.v.inspectorWidth}
          onresized={() => prefs.save()}
          onclose={() => (ed.selected = null)}
        >
          <QuickBar />
          <PropertyPanel inInspector />
        </FloatingPanel>
      </div>
    {/if}
  </div>
</div>

<AssetDragLayer />
