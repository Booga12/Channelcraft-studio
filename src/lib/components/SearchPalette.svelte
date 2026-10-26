<script lang="ts">
  // Ctrl+K: type to find any command, element, screen, ready-made element, preset or console.
  import * as Command from '$lib/components/ui/command';
  import { ed, SPLASH_FILES } from '$lib/editor.svelte';
  import { prefs } from '$lib/prefs.svelte';
  import { elementLabel } from '$lib/friendly';
  import { itemsFor } from '$lib/theme/library';
  import { layoutsFor } from '$lib/theme/presets';
  import { DESIGNS } from '$lib/theme/designs';
  import { ANIMATIONS } from '$lib/theme/animations';
  import Icon, { TYPE_ICONS } from './Icon.svelte';
  import { PANELS } from './editor/ToolDock.svelte';
  import { screenLabel } from './editor/screens';
  import { closeTheme, exportTheme, launchRetroBat, reloadFromDisk, shareTheme, tryInRetroBat } from './editor/actions';

  interface Entry {
    group: string;
    label: string;
    hint?: string;
    /** A shortcut, shown as keys. */
    keys?: string;
    icon: string;
    run: () => void;
    /** Shown but greyed out, e.g. commands for the selection when nothing is selected. */
    disabled?: boolean;
  }

  let q = $state('');
  // Each search starts empty.
  $effect(() => {
    if (ed.showSearch) q = '';
  });

  const cmd = (label: string, icon: string, run: () => void, keys?: string): Entry => ({ group: 'Commands', label, icon, run, keys });

  const entries = $derived.by<Entry[]>(() => {
    const sel = ed.selection.length > 0;
    const out: Entry[] = [
      cmd('Save', 'save', () => ed.save(), 'Ctrl+S'),
      cmd('Undo', 'undo', () => ed.undo(), 'Ctrl+Z'),
      cmd('Redo', 'redo', () => ed.redo(), 'Ctrl+Y'),
      ...[
        cmd('Duplicate selection', 'copy', () => ed.duplicate(), 'Ctrl+D'),
        cmd('Delete selection', 'trash', () => ed.deleteSelection(), 'Del'),
        cmd('Copy', 'copy', () => ed.copy(), 'Ctrl+C'),
        cmd('Centre on screen', 'fit', () => (ed.align('hcenter'), ed.align('vcenter'))),
        cmd('Align left', 'alignLeft', () => ed.align('left')),
        cmd('Align centre', 'alignHCenter', () => ed.align('hcenter')),
        cmd('Align right', 'alignRight', () => ed.align('right')),
        cmd('Align top', 'alignTop', () => ed.align('top')),
        cmd('Align middle', 'alignVCenter', () => ed.align('vcenter')),
        cmd('Align bottom', 'alignBottom', () => ed.align('bottom')),
        cmd('Bring to front', 'layers', () => ed.arrange('front'), 'Ctrl+Shift+]'),
        cmd('Bring forward', 'layers', () => ed.arrange('forward'), 'Ctrl+]'),
        cmd('Send backward', 'layers', () => ed.arrange('backward'), 'Ctrl+['),
        cmd('Send to back', 'layers', () => ed.arrange('back'), 'Ctrl+Shift+['),
        cmd('Lock / unlock', 'layers', () => ed.selection.forEach((n) => ed.setLocked(n, !ed.locked[n])), 'Ctrl+L'),
      ].map((e) => ({ ...e, disabled: !sel })),
      ...[cmd('Space evenly across', 'distH', () => ed.distribute('h')), cmd('Space evenly down', 'distV', () => ed.distribute('v'))].map((e) => ({ ...e, disabled: ed.selection.length < 3 })),
      cmd('Paste', 'copy', () => ed.paste(), 'Ctrl+V'),
      cmd('Select all', 'move', () => ed.selectAll(), 'Ctrl+A'),
      cmd('Try it in RetroBat (on the TV)', 'play', tryInRetroBat),
      cmd('Check theme for problems', 'sparkle', () => (ed.showHealth = true)),
      cmd('Use in RetroBat', 'monitor', () => ed.setActive()),
      cmd('Launch RetroBat', 'play', launchRetroBat),
      cmd('Export theme as zip…', 'folder', exportTheme),
      cmd('Share theme (one file with a preview)…', 'folder', shareTheme),
      cmd('Save as my design…', 'sparkle', () => (ed.showSaveDesign = true)),
      cmd('Import a design (.ccdesign)…', 'sparkle', () => ed.importMyDesign()),
      cmd('Make preview.png from this screen', 'image', () => ed.makePreviewImage()),
      cmd('RetroBat menu options…', 'sliders', () => (ed.showMenuOptions = true)),
      cmd('Matching game video & cover…', 'video', () => (ed.showFeatured = true)),
      cmd('Check game media…', 'image', () => (ed.showMediaCheck = true)),
      cmd('Restore a backup…', 'undo', () => (ed.showRestore = true)),
      cmd('Reload from disk', 'redo', reloadFromDisk),
      cmd('Zoom to fit', 'fit', () => (ed.zoom = 'fit'), 'Ctrl+0'),
      cmd('Actual size', 'zoomIn', () => (ed.zoom = 1), 'Ctrl+1'),
      cmd(ed.contactSheet ? 'Show one console' : 'Show six consoles at once', 'grid', () => (ed.contactSheet = !ed.contactSheet)),
      cmd(ed.playAnimations ? 'Stop animations' : 'Play animations', 'play', () => (ed.playAnimations = !ed.playAnimations), 'P'),
      cmd(prefs.v.showGrid ? 'Hide grid' : 'Show grid', 'grid', () => prefs.set('showGrid', !prefs.v.showGrid), "Ctrl+'"),
      cmd(prefs.v.showSafeArea ? 'Hide TV safe area' : 'Show TV safe area', 'monitor', () => prefs.set('showSafeArea', !prefs.v.showSafeArea)),
      cmd(prefs.v.showRulers ? 'Hide rulers' : 'Show rulers', 'sliders', () => prefs.set('showRulers', !prefs.v.showRulers)),
      cmd(prefs.v.snap ? 'Stop snapping to guides' : 'Snap to guides', 'fit', () => prefs.set('snap', !prefs.v.snap)),
      ...(ed.simple ? [] : [cmd(ed.showSource ? 'Hide XML source' : 'Show XML source', 'code', () => (ed.showSource = !ed.showSource))]),
      cmd(ed.simple ? 'Switch to Advanced mode' : 'Switch to Simple mode', 'sliders', () => ed.setMode(ed.simple ? 'advanced' : 'simple')),
      cmd('Light mode', 'sparkle', () => prefs.setMode('light')),
      cmd('Dark mode', 'sparkle', () => prefs.setMode('dark')),
      cmd('Light or dark like Windows', 'sparkle', () => prefs.setMode('system')),
      cmd('Where changes go: everywhere', 'monitor', () => ((ed.consoleOnly = false), (ed.gameOnly = false))),
      cmd(`Where changes go: only ${ed.consoleName}`, 'monitor', () => ((ed.consoleOnly = true), (ed.gameOnly = false))),
      cmd('Settings', 'settings', () => (ed.showSettings = true), 'Ctrl+,'),
      cmd('Keyboard shortcuts', 'help', () => (ed.showShortcuts = true), '?'),
      cmd('Report a problem', 'help', () => (ed.showReport = true)),
      cmd('Take the tour', 'help', () => (ed.showTour = true)),
      cmd('Getting started', 'help', () => (ed.showGuide = true)),
      cmd('Close theme', 'folder', closeTheme),
    ];
    for (const p of PANELS) if (!(ed.simple && p.id === 'files')) out.push({ group: 'Panels', label: `Open ${p.label}`, hint: p.help, icon: 'panel', run: () => ed.showPanel(p.id) });
    for (const el of ed.currentView?.elements.values() ?? []) out.push({ group: 'Elements on this screen', label: elementLabel(el.name), hint: el.name, icon: TYPE_ICONS[el.type] ?? 'file', run: () => ed.select(el.name) });
    for (const t of ed.screens) out.push({ group: 'Screens', label: screenLabel(t), icon: 'monitor', run: () => ed.showScreen(t) });
    for (const f of SPLASH_FILES)
      if (!ed.screens.some((t) => t.file === f)) out.push({ group: 'Screens', label: f === 'splash.xml' ? 'Add a loading screen' : 'Add a game launch screen', hint: f, icon: 'plus', run: () => ed.addLoadingScreen(f) });
    for (const i of itemsFor(ed.view)) out.push({ group: 'Add', label: `Add ${i.label.toLowerCase()}`, hint: i.help, icon: i.icon, run: () => ed.addLibraryItem(i) });
    for (const d of DESIGNS) out.push({ group: 'Designs', label: `Design: ${d.label}`, hint: d.description, icon: 'sparkle', run: () => (ed.showPanel('presets'), ed.applyDesign(d)) });
    for (const l of layoutsFor(ed.view)) out.push({ group: 'Layouts', label: `Layout: ${l.label}`, hint: l.description, icon: 'grid', run: () => ed.applyLayout(l, [ed.view]) });
    if (ed.selected) for (const a of ANIMATIONS) out.push({ group: 'Animations', label: `Animate: ${a.label}`, hint: a.help, icon: 'sparkle', run: () => ed.setAnimation(ed.selected!, a.id) });
    for (const s of ed.previewSystems) out.push({ group: 'Preview as', label: s.fullName, hint: ed.gameSystems.includes(s.name) ? 'your games' : s.manufacturer, icon: 'monitor', run: () => ed.setSystem(s) });
    return out;
  });

  /** Words in any order; each must appear in the label, hint or group. */
  const shown = $derived.by(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = words.length ? entries.filter((e) => words.every((w) => `${e.label} ${e.hint ?? ''} ${e.group}`.toLowerCase().includes(w))) : entries.filter((e) => e.group === 'Commands' || e.group === 'Elements on this screen');
    return list.slice(0, 80);
  });

  const groups = $derived.by(() => {
    const m = new Map<string, Entry[]>();
    for (const e of shown) m.set(e.group, [...(m.get(e.group) ?? []), e]);
    return [...m];
  });

  function run(e: Entry) {
    ed.showSearch = false;
    e.run();
  }
</script>

<Command.Dialog
  bind:open={() => ed.showSearch, (v) => (ed.showSearch = v)}
  title="Search"
  description="Find any command, element, screen, design or console"
  shouldFilter={false}
  class="ui-new sm:max-w-xl"
>
  <Command.Input bind:value={q} placeholder="Search commands, elements, screens, designs, consoles…" />
  <Command.List class="max-h-[min(60vh,480px)]">
    <Command.Empty>Nothing matches “{q}”.</Command.Empty>
    {#each groups as [group, items] (group)}
      <Command.Group heading={group}>
        {#each items as e, i (`${group}:${e.label}:${i}`)}
          <Command.Item value={`${group}:${e.label}:${i}`} disabled={e.disabled} onSelect={() => run(e)}>
            <Icon name={e.icon} size={15} />
            <span class="truncate">{e.label}</span>
            {#if e.keys}
              <Command.Shortcut>{e.keys}</Command.Shortcut>
            {:else if e.hint}
              <span class="ml-auto max-w-[45%] truncate text-xs text-muted-foreground">{e.hint}</span>
            {/if}
          </Command.Item>
        {/each}
      </Command.Group>
    {/each}
  </Command.List>
</Command.Dialog>
