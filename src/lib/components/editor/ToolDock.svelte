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
    { id: 'library', label: 'Library', help: 'Ready-made elements that show RetroBat’s game and system data', icon: SparklesIcon },
    { id: 'assets', label: 'Assets', help: 'Your own pictures, videos, sounds and fonts; drag one onto an element to use it', icon: ImagesIcon },
    { id: 'presets', label: 'Presets', help: 'Designs, layouts and colour palettes', icon: LayoutTemplateIcon },
    { id: 'variables', label: 'Colours', help: 'Colours and values shared across the theme', icon: PaletteIcon },
    { id: 'options', label: 'Options', help: 'Choices the theme offers inside RetroBat', icon: SlidersHorizontalIcon },
    { id: 'history', label: 'History', help: 'Every change; click one to go back to it', icon: HistoryIcon },
    { id: 'files', label: 'Files', help: 'XML files in the theme', icon: FileCodeIcon },
  ];
</script>

<script lang="ts">
  // A floating column at the left of the preview: an Add menu, then the panels, each with its
  // name under the icon so it's clear what a button opens before clicking it.
  import ImageIcon from '@lucide/svelte/icons/image';
  import TypeIcon from '@lucide/svelte/icons/type';
  import SquareIcon from '@lucide/svelte/icons/square-dashed';
  import ClockIcon from '@lucide/svelte/icons/clock';
  import StarIcon from '@lucide/svelte/icons/star';
  import VideoIcon from '@lucide/svelte/icons/video';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import ImagePlusIcon from '@lucide/svelte/icons/image-plus';
  import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { mergeProps } from 'bits-ui';
  import { ed } from '$lib/editor.svelte';
  import { TYPE_LABELS } from '$lib/friendly';
  import { cn } from '$lib/utils';

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
    elements: ed.layers.length || undefined,
    assets: ed.library.length || undefined,
    options: ed.res?.subsets.length || undefined,
    history: ed.history.done.length || undefined,
  });
  // Simple mode keeps to what a first theme needs: looks, colours, what's on screen, and undo.
  const SIMPLE: PanelId[] = ['presets', 'variables', 'elements', 'history'];
  const panels = $derived(ed.simple ? SIMPLE.map((id) => PANELS.find((p) => p.id === id)!) : PANELS);
  const label = (p: PanelInfo) => (p.id === 'variables' && !ed.simple ? 'Variables' : p.label);
  const item = 'relative flex w-full flex-col items-center gap-1 rounded-xl px-1 pt-1.5 pb-1 text-[10px] leading-none font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none [&_svg]:size-[18px] [&_svg]:shrink-0';
  const on = 'bg-primary/12 font-semibold text-primary hover:bg-primary/18 hover:text-primary';
</script>

<nav class="ui-new flex max-h-full w-16 flex-col items-center gap-0.5 overflow-y-auto rounded-2xl bg-card/90 p-1 text-card-foreground shadow-elev-3 ring-1 ring-foreground/8 backdrop-blur-xl [scrollbar-width:none]" aria-label="Tools">
  <DropdownMenu.Root>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props: tip })}
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <button {...mergeProps(tip, props)} class={cn(item, 'text-foreground aria-expanded:bg-muted')}>
                <span class="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-elev-1"><PlusIcon /></span>
                Add
              </button>
            {/snippet}
          </DropdownMenu.Trigger>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content side="right" sideOffset={6}>Add something to this screen</Tooltip.Content>
    </Tooltip.Root>
    <DropdownMenu.Content side="right" align="start" sideOffset={8} class="w-72">
      <DropdownMenu.Group>
        <DropdownMenu.Label>Add to this screen</DropdownMenu.Label>
        {#each ADD as a (a.type)}
          <DropdownMenu.Item onSelect={() => ed.addElement(a.type)} class="items-start gap-2.5 py-1.5">
            <a.icon class="mt-0.5" />
            <div class="flex min-w-0 flex-col">
              <span>{TYPE_LABELS[a.type]?.label ?? a.type}</span>
              <span class="line-clamp-2 text-xs text-muted-foreground">{TYPE_LABELS[a.type]?.help ?? ''}</span>
            </div>
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Group>
      <DropdownMenu.Separator />
      <DropdownMenu.Item onSelect={() => ed.pickAndAddAssets()} class="items-start gap-2.5 py-1.5">
        <ImagePlusIcon class="mt-0.5" />
        <div class="flex min-w-0 flex-col">
          <span>Your own picture or video…</span>
          <span class="text-xs text-muted-foreground">Pick files from your PC. Each one is added as a new layer.</span>
        </div>
      </DropdownMenu.Item>
      <DropdownMenu.Item onSelect={() => (open = 'library')} class="items-start gap-2.5 py-1.5">
        <SparklesIcon class="mt-0.5" />
        <div class="flex min-w-0 flex-col">
          <span>Ready-made elements…</span>
          <span class="text-xs text-muted-foreground">Box art, game info and more, filled in by RetroBat</span>
        </div>
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>

  <div class="my-1 h-px w-8 shrink-0 bg-border"></div>

  {#each panels as p (p.id)}
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <button {...mergeProps(props, { onclick: () => (open = open === p.id ? null : p.id) })} class={cn(item, open === p.id && on)} aria-pressed={open === p.id}>
            <p.icon />
            <span class="max-w-full truncate">{label(p)}</span>
            {#if counts[p.id]}
              <span class="absolute top-0.5 right-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-muted px-0.5 text-[9px] leading-none font-semibold text-muted-foreground ring-1 ring-background">{counts[p.id]! > 99 ? '99+' : counts[p.id]}</span>
            {/if}
          </button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content side="right" sideOffset={6}>{p.help}</Tooltip.Content>
    </Tooltip.Root>
  {/each}

  <div class="my-1 h-px w-8 shrink-0 bg-border"></div>
  <button class={item} onclick={() => (ed.showGuide = true)}><CircleHelpIcon /><span>Help</span></button>
</nav>
