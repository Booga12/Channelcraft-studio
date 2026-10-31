<script lang="ts">
  // The theme menu behind the logo: everything the old menu bar had, as one menu with submenus.
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import Logo from '../Logo.svelte';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import { ed } from '$lib/editor.svelte';
  import { prefs } from '$lib/prefs.svelte';
  import { closeTheme, exportTheme, isActiveTheme, launchRetroBat, publishTheme, reloadFromDisk, shareTheme, tryInRetroBat } from './actions';

  interface Item {
    label: string;
    shortcut?: string;
    action: () => void;
    disabled?: boolean;
    checked?: boolean;
  }
  type Entry = Item | 'sep';

  const sel = $derived(ed.selection.length > 0);

  const menus = $derived<{ label: string; items: Entry[] }[]>([
    {
      label: 'File',
      items: [
        { label: 'Save', shortcut: 'Ctrl+S', action: () => ed.save(), disabled: ed.dirtyCount === 0 },
        { label: 'Share theme…', action: shareTheme },
        { label: 'Publish to the gallery…', action: publishTheme },
        { label: 'Export as zip…', action: exportTheme },
        { label: 'Save as my design…', action: () => (ed.showSaveDesign = true), disabled: !ed.canSaveDesign() },
        { label: 'Make preview.png from this screen', action: () => ed.makePreviewImage() },
        'sep',
        { label: 'RetroBat menu options…', action: () => (ed.showMenuOptions = true) },
        { label: 'Check theme…', action: () => (ed.showHealth = true) },
        { label: 'Check game media…', action: () => (ed.showMediaCheck = true) },
        { label: 'Restore a backup…', action: () => (ed.showRestore = true) },
        { label: 'Reload from disk', action: reloadFromDisk },
        'sep',
        { label: 'Try it in RetroBat', action: tryInRetroBat },
        { label: isActiveTheme() ? 'In use by RetroBat' : 'Use in RetroBat', action: () => ed.setActive(), disabled: isActiveTheme() },
        { label: 'Launch RetroBat', action: launchRetroBat },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => ed.undo(), disabled: !ed.canUndo },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: () => ed.redo(), disabled: !ed.canRedo },
        'sep',
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => ed.copy(), disabled: !sel },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => ed.paste() },
        { label: 'Duplicate', shortcut: 'Ctrl+D', action: () => ed.duplicate(), disabled: !sel },
        { label: 'Delete', shortcut: 'Del', action: () => ed.deleteSelection(), disabled: !sel },
        'sep',
        { label: 'Select all', shortcut: 'Ctrl+A', action: () => ed.selectAll() },
        { label: 'Deselect', shortcut: 'Esc', action: () => (ed.selected = null), disabled: !ed.selected },
      ],
    },
    {
      label: 'Insert',
      items: [
        { label: 'Design…', action: () => ed.showPanel('presets') },
        { label: 'Ready-made elements…', action: () => ed.showPanel('library') },
        { label: 'Layout presets…', action: () => ed.showPanel('presets') },
        { label: 'Matching game video & cover…', action: () => (ed.showFeatured = true) },
        'sep',
        { label: 'Picture', action: () => ed.addElement('image') },
        { label: 'Text', action: () => ed.addElement('text') },
        { label: 'Panel', action: () => ed.addElement('ninepatch') },
        { label: 'Clock', action: () => ed.addElement('clock') },
      ],
    },
    {
      label: 'Arrange',
      items: [
        { label: 'Bring to front', shortcut: 'Ctrl+Shift+]', action: () => ed.arrange('front'), disabled: !sel },
        { label: 'Bring forward', shortcut: 'Ctrl+]', action: () => ed.arrange('forward'), disabled: !sel },
        { label: 'Send backward', shortcut: 'Ctrl+[', action: () => ed.arrange('backward'), disabled: !sel },
        { label: 'Send to back', shortcut: 'Ctrl+Shift+[', action: () => ed.arrange('back'), disabled: !sel },
        'sep',
        { label: 'Align left', action: () => ed.align('left'), disabled: !sel },
        { label: 'Align centre', action: () => ed.align('hcenter'), disabled: !sel },
        { label: 'Align right', action: () => ed.align('right'), disabled: !sel },
        { label: 'Align top', action: () => ed.align('top'), disabled: !sel },
        { label: 'Align middle', action: () => ed.align('vcenter'), disabled: !sel },
        { label: 'Align bottom', action: () => ed.align('bottom'), disabled: !sel },
        'sep',
        { label: 'Space evenly across', action: () => ed.distribute('h'), disabled: ed.selection.length < 3 },
        { label: 'Space evenly down', action: () => ed.distribute('v'), disabled: ed.selection.length < 3 },
        'sep',
        { label: 'Lock / unlock', shortcut: 'Ctrl+L', action: () => ed.selection.forEach((n) => ed.setLocked(n, !ed.locked[n])), disabled: !sel },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Zoom to fit', shortcut: 'Ctrl+0', action: () => (ed.zoom = 'fit') },
        { label: 'Actual size', shortcut: 'Ctrl+1', action: () => (ed.zoom = 1) },
        'sep',
        { label: 'Grid', shortcut: "Ctrl+'", checked: prefs.v.showGrid, action: () => prefs.set('showGrid', !prefs.v.showGrid) },
        { label: 'TV safe area', checked: prefs.v.showSafeArea, action: () => prefs.set('showSafeArea', !prefs.v.showSafeArea) },
        { label: 'Rulers', checked: prefs.v.showRulers, action: () => prefs.set('showRulers', !prefs.v.showRulers) },
        { label: 'Snap to guides', checked: prefs.v.snap, action: () => prefs.set('snap', !prefs.v.snap) },
        { label: 'Play animations', shortcut: 'P', checked: ed.playAnimations, action: () => (ed.playAnimations = !ed.playAnimations) },
        { label: 'Six systems at once', checked: ed.contactSheet, action: () => (ed.contactSheet = !ed.contactSheet) },
        'sep',
        { label: 'Simple mode', checked: ed.simple, action: () => ed.setMode('simple') },
        { label: 'Advanced mode', checked: !ed.simple, action: () => ed.setMode('advanced') },
        ...(ed.simple ? [] : [{ label: 'XML source', checked: ed.showSource, action: () => (ed.showSource = !ed.showSource) }]),
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Take the tour', action: () => (ed.showTour = true) },
        { label: 'Getting started', action: () => (ed.showGuide = true) },
        { label: 'Keyboard shortcuts', shortcut: '?', action: () => (ed.showShortcuts = true) },
        { label: 'Search for anything', shortcut: 'Ctrl+K', action: () => (ed.showSearch = true) },
        'sep',
        { label: 'Report a problem…', action: () => (ed.showReport = true) },
      ],
    },
  ]);
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <button {...props} class="group flex h-8 items-center gap-1.5 rounded-lg pr-1.5 pl-1 transition-colors hover:bg-muted aria-expanded:bg-muted" aria-label="Theme menu">
        <Logo class="size-6" />
        <ChevronDownIcon class="size-3.5 text-muted-foreground transition-transform duration-200 group-aria-expanded:rotate-180" />
      </button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="start" class="w-60">
    {#each menus as m (m.label)}
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger>{m.label}</DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent class="w-64">
          <DropdownMenu.Group>
            {#each m.items as it, i (i)}
              {#if it === 'sep'}
                <DropdownMenu.Separator />
              {:else if it.checked !== undefined}
                <DropdownMenu.CheckboxItem checked={it.checked} disabled={it.disabled} onSelect={it.action}>
                  {it.label}
                  {#if it.shortcut}<DropdownMenu.Shortcut>{it.shortcut}</DropdownMenu.Shortcut>{/if}
                </DropdownMenu.CheckboxItem>
              {:else}
                <DropdownMenu.Item disabled={it.disabled} onSelect={it.action}>
                  {it.label}
                  {#if it.shortcut}<DropdownMenu.Shortcut>{it.shortcut}</DropdownMenu.Shortcut>{/if}
                </DropdownMenu.Item>
              {/if}
            {/each}
          </DropdownMenu.Group>
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
    {/each}
    <DropdownMenu.Separator />
    <DropdownMenu.Group>
      <DropdownMenu.Item onSelect={() => (ed.showSettings = true)}>Settings…<DropdownMenu.Shortcut>Ctrl+,</DropdownMenu.Shortcut></DropdownMenu.Item>
      <DropdownMenu.Item onSelect={closeTheme}>Close theme</DropdownMenu.Item>
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>
