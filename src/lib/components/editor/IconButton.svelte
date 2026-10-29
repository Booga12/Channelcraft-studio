<script lang="ts">
  // An icon button with a tooltip (and its shortcut), used across the editor's bars and dock.
  import type { Snippet } from 'svelte';
  import { mergeProps } from 'bits-ui';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Button, type ButtonSize, type ButtonVariant } from '$lib/components/ui/button';
  import { Kbd } from '$lib/components/ui/kbd';
  import { cn } from '$lib/utils';

  let {
    label,
    shortcut,
    side = 'bottom',
    active = false,
    disabled = false,
    variant = 'ghost',
    size = 'icon-sm',
    class: className = '',
    onclick,
    children,
  }: {
    label: string;
    shortcut?: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
    /** Only the look: the buttons that use it also change their label, so no aria-pressed. */
    active?: boolean;
    disabled?: boolean;
    variant?: ButtonVariant;
    size?: ButtonSize;
    class?: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  } = $props();
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <Button
        {...mergeProps(props, { onclick })}
        {variant}
        {size}
        {disabled}
        aria-label={label}
        class={cn('text-muted-foreground hover:text-foreground', active && 'bg-primary/12 text-primary hover:bg-primary/18 hover:text-primary', className)}
      >
        {@render children()}
      </Button>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content {side} sideOffset={6}>
    {label}
    {#if shortcut}<Kbd>{shortcut}</Kbd>{/if}
  </Tooltip.Content>
</Tooltip.Root>
