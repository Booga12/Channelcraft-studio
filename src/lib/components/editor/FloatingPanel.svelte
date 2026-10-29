<script lang="ts">
  // A floating card beside the tool dock or the right edge, with a title, optional pin and close,
  // and a grip to change its width.
  import type { Snippet } from 'svelte';
  import PinIcon from '@lucide/svelte/icons/pin';
  import PinOffIcon from '@lucide/svelte/icons/pin-off';
  import XIcon from '@lucide/svelte/icons/x';
  import { cn } from '$lib/utils';
  import IconButton from './IconButton.svelte';

  let {
    title,
    subtitle,
    width = $bindable(320),
    min = 260,
    max = 560,
    edge = 'right',
    pinned,
    onpin,
    onclose,
    onresized,
    class: className = '',
    header,
    children,
  }: {
    title: string;
    subtitle?: string;
    width?: number;
    min?: number;
    max?: number;
    /** Which side the resize grip is on. */
    edge?: 'left' | 'right';
    pinned?: boolean;
    onpin?: () => void;
    onclose?: () => void;
    onresized?: () => void;
    class?: string;
    header?: Snippet;
    children: Snippet;
  } = $props();

  function grip(e: PointerEvent) {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const w0 = width;
    const move = (ev: PointerEvent) => {
      const d = ev.clientX - x0;
      width = Math.round(Math.min(max, Math.max(min, edge === 'right' ? w0 + d : w0 - d)));
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      onresized?.();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  }

  /** The same from the keyboard: arrows change the width (Shift: further), Home/End go to the ends. */
  function gripKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 64 : 16;
    const out = edge === 'right' ? 'ArrowRight' : 'ArrowLeft';
    const inn = edge === 'right' ? 'ArrowLeft' : 'ArrowRight';
    let w = width;
    if (e.key === out) w += step;
    else if (e.key === inn) w -= step;
    else if (e.key === 'Home') w = min;
    else if (e.key === 'End') w = max;
    else return;
    e.preventDefault();
    width = Math.round(Math.min(max, Math.max(min, w)));
    onresized?.();
  }
</script>

<section
  class={cn('relative flex min-h-0 flex-col overflow-hidden rounded-2xl bg-card/95 text-card-foreground shadow-elev-3 ring-1 ring-foreground/8 backdrop-blur-xl', className)}
  style:width="{width}px"
  aria-label={title}
>
  <header class="ui-new flex shrink-0 items-center gap-2 border-b py-2 pr-1.5 pl-3.5">
    <div class="min-w-0 flex-1">
      <h2 class="m-0 truncate text-sm font-semibold">{title}</h2>
      {#if subtitle}<p class="m-0 truncate text-xs text-muted-foreground">{subtitle}</p>{/if}
    </div>
    {@render header?.()}
    {#if onpin}
      <IconButton label={pinned ? 'Unpin: close when you click the preview' : 'Pin: keep open while you work'} active={pinned} onclick={onpin}>
        {#if pinned}<PinOffIcon />{:else}<PinIcon />{/if}
      </IconButton>
    {/if}
    {#if onclose}
      <IconButton label="Close" shortcut="Esc" onclick={onclose}><XIcon /></IconButton>
    {/if}
  </header>
  <!-- The older panels draw their own content; it keeps its look inside the card. -->
  <div class="legacy-panel min-h-0 flex-1 overflow-auto">
    {@render children()}
  </div>
  <!-- A focusable separator is a resize control (WAI-ARIA window splitter); Svelte's check doesn't know that. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class={cn('absolute top-0 bottom-0 z-10 w-2 cursor-col-resize transition-colors hover:bg-primary/20 focus-visible:bg-primary/20', edge === 'right' ? '-right-1 focus-visible:right-0' : '-left-1 focus-visible:left-0')}
    role="separator"
    aria-orientation="vertical"
    aria-label="{title} width"
    aria-valuenow={width}
    aria-valuemin={min}
    aria-valuemax={max}
    tabindex="0"
    title="Drag to change the width"
    onpointerdown={grip}
    onkeydown={gripKey}
  ></div>
</section>
