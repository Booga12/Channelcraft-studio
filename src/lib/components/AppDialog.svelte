<script lang="ts">
  // The app's dialog frame (shadcn Dialog): title, optional description and header controls,
  // a scrolling body and an optional footer. Escape and clicking outside close it unless `busy`.
  import type { Snippet } from 'svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import { cn } from '$lib/utils';

  let {
    title,
    description,
    onclose,
    busy = false,
    class: className = '',
    bodyClass = '',
    actions,
    footer,
    children,
  }: {
    title: string;
    description?: string;
    onclose: () => void;
    /** While something is running, the dialog can't be closed. */
    busy?: boolean;
    /** Size and layout of the dialog box, e.g. "sm:max-w-3xl". */
    class?: string;
    bodyClass?: string;
    actions?: Snippet;
    footer?: Snippet;
    children: Snippet;
  } = $props();
</script>

<Dialog.Root open onOpenChange={(o) => !o && !busy && onclose()}>
  <Dialog.Content
    class={cn('flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 shadow-elev-4 sm:max-w-xl', className)}
    showCloseButton={!busy}
    escapeKeydownBehavior={busy ? 'ignore' : 'close'}
    interactOutsideBehavior={busy ? 'ignore' : 'close'}
  >
    <Dialog.Header class="ui-new flex-row items-start gap-3 border-b px-6 pt-5 pb-4 pr-12">
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <Dialog.Title class="text-base">{title}</Dialog.Title>
        {#if description}<Dialog.Description>{description}</Dialog.Description>{/if}
      </div>
      {@render actions?.()}
    </Dialog.Header>
    <!-- The dialogs' own content keeps its look (it predates shadcn). -->
    <div class={cn('legacy-dialog min-h-0 flex-1 overflow-auto px-6 py-4', bodyClass)}>
      {@render children()}
    </div>
    {#if footer}
      <Dialog.Footer class="ui-new m-0 rounded-b-xl border-t bg-muted/40 px-6 py-3">
        {@render footer()}
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
