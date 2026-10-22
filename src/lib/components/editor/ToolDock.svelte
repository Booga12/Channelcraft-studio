<script lang="ts" module>
  import type { Component } from 'svelte';
  import LayersIcon from '@lucide/svelte/icons/layers';
  import SparklesIcon from '@lucide/svelte/icons/sparkles';
  import ImagesIcon from '@lucide/svelte/icons/images';
  import LayoutTemplateIcon from '@lucide/svelte/icons/layout-template';
  import PaletteIcon from '@lucide/svelte/icons/palette';
  import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
  import HistoryIcon from '@lucide/svelte/icons/history';
  import FileCodeIcon from '@lucide/svelte/icons/file-code-2';
  import type { PanelId } from '$lib/prefs.svelte';

  export interface PanelInfo {
    id: PanelId;
    label: string;
    help: string;
    icon: Component;
  }

  /** The panels the dock opens, in order. */
  export const PANELS: PanelInfo[] = [
    { id: 'elements', label: 'Layers', help: 'Everything drawn on this screen', icon: LayersIcon },
    { id: 'library', label: 'Add', help: 'Ready-made elements that show RetroBat’s game and system data', icon: SparklesIcon },
    { id: 'assets', label: 'Assets', help: 'Your own pictures, videos, sounds and fonts; drag one onto an element to use it', icon: ImagesIcon },
    { id: 'presets', label: 'Presets', help: 'Designs, layouts and colour palettes', icon: LayoutTemplateIcon },
    { id: 'variables', label: 'Colours', help: 'Colours and values shared across the theme', icon: PaletteIcon },
    { id: 'options', label: 'Options', help: 'Choices the theme offers inside RetroBat', icon: SlidersHorizontalIcon },
    { id: 'history', label: 'History', help: 'Every change; click one to go back to it', icon: HistoryIcon },
    { id: 'files', label: 'Files', help: 'XML files in the theme', icon: FileCodeIcon },
  ];
</script>

<script lang="ts">
  // A floating column of tools at the left of the preview: things to add, then the panels.
  import ImageIcon from '@lucide/svelte/icons/image';
  import TypeIcon from '@lucide/svelte/icons/type';
  import SquareIcon from '@lucide/svelte/icons/square-dashed';
  import ClockIcon from '@lucide/svelte/icons/clock';
  import StarIcon from '@lucide/svelte/icons/star';
  import VideoIcon from '@lucide/svelte/icons/video';
  import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
  import { ed } from '$lib/editor.svelte';
  import { TYPE_LABELS } from '$lib/friendly';
  import IconButton from './IconButton.svelte';

  let { open = $bindable<PanelId | null>(null) }: { open?: PanelId | null } = $props();

  const ADD: { type: string; icon: Component }[] = [
    { type: 'image', icon: ImageIcon },
    { type: 'text', icon: TypeIcon },
    { type: 'ninepatch', icon: SquareIcon },
    { type: 'clock', icon: ClockIcon },
    { type: 'rating', icon: StarIcon },
    { type: 'video', icon: VideoIcon },
  ];

  const counts = $derived<Partial<Record<PanelId, number | undefined>>>({
    elements: [...(ed.currentView?.elements.values() ?? [])].filter((e) => e.type !== 'gameextras').length || undefined,
    assets: ed.library.length || undefined,
    options: ed.res?.subsets.length || undefined,
    history: ed.history.done.length || undefined,
  });
  const panels = $derived(PANELS.filter((p) => !(ed.simple && p.id === 'files')));
  const label = (p: PanelInfo) => (p.id === 'variables' && !ed.simple ? 'Variables' : p.label);
</script>

<nav class="ui-new flex w-11 flex-col items-center gap-0.5 rounded-2xl bg-card/90 p-1 text-card-foreground shadow-elev-3 ring-1 ring-foreground/8 backdrop-blur-xl" aria-label="Tools">
  {#each ADD as a (a.type)}
    <IconButton side="right" label="Add {TYPE_LABELS[a.type]?.label.toLowerCase() ?? a.type}: {TYPE_LABELS[a.type]?.help ?? ''}" onclick={() => ed.addElement(a.type)} class="relative">
      <a.icon />
      <span class="absolute right-1 bottom-1 size-1.5 rounded-full bg-primary/70"></span>
    </IconButton>
  {/each}
  <div class="my-1 h-px w-6 bg-border"></div>
  {#each panels as p (p.id)}
    <IconButton side="right" label="{label(p)}: {p.help}" active={open === p.id} onclick={() => (open = open === p.id ? null : p.id)} class="relative">
      <p.icon />
      {#if counts[p.id]}
        <span class="absolute -top-0.5 -right-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-muted px-0.5 text-[9px] leading-none font-semibold text-muted-foreground ring-1 ring-background">{counts[p.id]! > 99 ? '99+' : counts[p.id]}</span>
      {/if}
    </IconButton>
  {/each}
  <div class="my-1 h-px w-6 bg-border"></div>
  <IconButton side="right" label="Getting started" onclick={() => (ed.showGuide = true)}><CircleHelpIcon /></IconButton>
</nav>
