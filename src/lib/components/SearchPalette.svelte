<script lang="ts">
  // Ctrl+K: type to find any command, element, screen, ready-made element, preset or console.
  import { ed } from '$lib/editor.svelte';
  import { prefs } from '$lib/prefs.svelte';
  import { elementLabel, viewLabel } from '$lib/friendly';
  import { itemsFor } from '$lib/theme/library';
  import { layoutsFor } from '$lib/theme/presets';
  import { DESIGNS } from '$lib/theme/designs';
  import { ANIMATIONS } from '$lib/theme/animations';
  import Icon, { TYPE_ICONS } from './Icon.svelte';

  interface Entry {
    group: string;
    label: string;
    hint?: string;
    icon: string;
    run: () => void;
  }

  let q = $state('');
  let index = $state(0);
  let input: HTMLInputElement;

  $effect(() => {
    input?.focus();
  });

  const entries = $derived.by<Entry[]>(() => {
    const out: Entry[] = [
      { group: 'Commands', label: 'Save', hint: 'Ctrl+S', icon: 'save', run: () => ed.save() },
      { group: 'Commands', label: 'Undo', hint: 'Ctrl+Z', icon: 'undo', run: () => ed.undo() },
      { group: 'Commands', label: 'Redo', hint: 'Ctrl+Y', icon: 'redo', run: () => ed.redo() },
      { group: 'Commands', label: 'Duplicate selection', hint: 'Ctrl+D', icon: 'copy', run: () => ed.duplicate() },
      { group: 'Commands', label: 'Delete selection', hint: 'Del', icon: 'trash', run: () => ed.deleteSelection() },
      { group: 'Commands', label: 'Select all', hint: 'Ctrl+A', icon: 'move', run: () => ed.selectAll() },
      { group: 'Commands', label: 'Centre on screen', icon: 'fit', run: () => (ed.align('hcenter'), ed.align('vcenter')) },
      { group: 'Commands', label: 'Bring to front', icon: 'layers', run: () => ed.arrange('front') },
      { group: 'Commands', label: 'Send to back', icon: 'layers', run: () => ed.arrange('back') },
      { group: 'Commands', label: 'Use in RetroBat', icon: 'monitor', run: () => ed.setActive() },
      { group: 'Commands', label: 'Launch RetroBat', icon: 'play', run: () => ed.launch() },
      { group: 'Commands', label: 'Export theme as zip…', icon: 'folder', run: () => ed.exportZip() },
      { group: 'Commands', label: 'Make preview.png from this screen', icon: 'image', run: () => ed.makePreviewImage() },
      { group: 'Commands', label: 'Show six systems at once', icon: 'grid', run: () => (ed.contactSheet = true) },
      { group: 'Commands', label: ed.playAnimations ? 'Stop animations' : 'Play animations', hint: 'P', icon: 'play', run: () => (ed.playAnimations = !ed.playAnimations) },
      { group: 'Commands', label: prefs.v.showGrid ? 'Hide grid' : 'Show grid', icon: 'grid', run: () => prefs.set('showGrid', !prefs.v.showGrid) },
      { group: 'Commands', label: prefs.v.showSafeArea ? 'Hide TV safe area' : 'Show TV safe area', icon: 'monitor', run: () => prefs.set('showSafeArea', !prefs.v.showSafeArea) },
      { group: 'Commands', label: 'Settings', hint: 'Ctrl+,', icon: 'settings', run: () => (ed.showSettings = true) },
      { group: 'Commands', label: 'Keyboard shortcuts', hint: '?', icon: 'help', run: () => (ed.showShortcuts = true) },
      { group: 'Commands', label: ed.simple ? 'Switch to Advanced mode' : 'Switch to Simple mode', icon: 'sliders', run: () => ed.setMode(ed.simple ? 'advanced' : 'simple') },
    ];
    for (const el of ed.currentView?.elements.values() ?? []) out.push({ group: 'Elements on this screen', label: elementLabel(el.name), hint: el.name, icon: TYPE_ICONS[el.type] ?? 'file', run: () => ed.select(el.name) });
    for (const t of ed.screens)
      out.push({
        group: 'Screens',
        label: t.file === 'splash.xml' ? 'Loading screen' : t.file === 'gamesplash.xml' ? 'Game launch screen' : viewLabel(t.view, ed.themeRes?.views.get(t.view)?.displayName),
        icon: 'monitor',
        run: () => ed.showScreen(t),
      });
    for (const i of itemsFor(ed.view)) out.push({ group: 'Add', label: `Add ${i.label.toLowerCase()}`, hint: i.help, icon: i.icon, run: () => ed.addLibraryItem(i) });
    for (const d of DESIGNS) out.push({ group: 'Designs', label: `Design: ${d.label}`, hint: d.description, icon: 'sparkle', run: () => (ed.showPanel('presets'), ed.applyDesign(d)) });
    for (const l of layoutsFor(ed.view)) out.push({ group: 'Layouts', label: `Layout: ${l.label}`, hint: l.description, icon: 'grid', run: () => ed.applyLayout(l, [ed.view]) });
    if (ed.selected) for (const a of ANIMATIONS) out.push({ group: 'Animations', label: `Animate: ${a.label}`, hint: a.help, icon: 'sparkle', run: () => ed.setAnimation(ed.selected!, a.id) });
    for (const s of ed.previewSystems) out.push({ group: 'Preview as', label: s.fullName, hint: ed.gameSystems.includes(s.name) ? 'your games' : s.manufacturer, icon: 'monitor', run: () => ed.setSystem(s) });
    return out;
  });

  /** Words in any order; each must appear in the label or hint. */
  const shown = $derived.by(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = words.length ? entries.filter((e) => words.every((w) => `${e.label} ${e.hint ?? ''} ${e.group}`.toLowerCase().includes(w))) : entries.filter((e) => e.group === 'Commands' || e.group === 'Elements on this screen');
    return list.slice(0, 60);
  });

  $effect(() => {
    q;
    index = 0;
  });

  function run(e: Entry) {
    ed.showSearch = false;
    e.run();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') ed.showSearch = false;
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      index = Math.min(shown.length - 1, index + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      index = Math.max(0, index - 1);
    } else if (e.key === 'Enter' && shown[index]) {
      e.preventDefault();
      run(shown[index]);
    }
  }
</script>

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (ed.showSearch = false)}>
  <div class="palette" role="dialog" aria-modal="true" aria-label="Search">
    <div class="field">
      <Icon name="zoomIn" size={16} />
      <input bind:this={input} bind:value={q} {onkeydown} placeholder="Search commands, elements, screens, designs, consoles…" spellcheck="false" />
      <kbd>Esc</kbd>
    </div>
    <div class="list" role="listbox">
      {#each shown as e, i}
        {#if i === 0 || shown[i - 1].group !== e.group}
          <div class="group">{e.group}</div>
        {/if}
        <button class="entry" class:on={i === index} role="option" aria-selected={i === index} onmouseenter={() => (index = i)} onclick={() => run(e)}>
          <Icon name={e.icon} size={15} />
          <span class="lbl">{e.label}</span>
          {#if e.hint}<span class="hint">{e.hint}</span>{/if}
        </button>
      {:else}
        <p class="faint none">Nothing matches “{q}”.</p>
      {/each}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 500;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 12vh;
  }
  .palette {
    width: min(620px, 92vw);
    background: #2b2b2b;
    border: 1px solid #444;
    border-radius: 12px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }
  .field {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid #3c3c3c;
    color: var(--text-faint);
  }
  .field input {
    flex: 1;
    background: transparent;
    border: none;
    font-size: 15px;
    padding: 2px 0;
    color: var(--text);
  }
  .field input:focus {
    outline: none;
  }
  kbd {
    font: 10.5px var(--mono);
    border: 1px solid #4a4a4a;
    border-radius: 4px;
    padding: 1px 5px;
  }
  .list {
    max-height: 55vh;
    overflow: auto;
    padding: 4px 0 8px;
  }
  .group {
    padding: 8px 16px 3px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }
  .entry {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 16px;
    background: transparent;
    border-radius: 0;
    text-align: left;
    color: var(--text-dim);
  }
  .entry.on {
    background: var(--accent-strong);
    color: #fff;
  }
  .lbl {
    white-space: nowrap;
  }
  .hint {
    margin-left: auto;
    font-size: 11px;
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 50%;
  }
  .none {
    padding: 12px 16px;
  }
</style>
