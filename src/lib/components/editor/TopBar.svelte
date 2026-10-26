<script lang="ts">
  // The one bar above the preview: theme menu and name, what the preview shows, where changes
  // go, and saving.
  import UndoIcon from '@lucide/svelte/icons/undo-2';
  import RedoIcon from '@lucide/svelte/icons/redo-2';
  import SearchIcon from '@lucide/svelte/icons/search';
  import PlayIcon from '@lucide/svelte/icons/play';
  import CheckIcon from '@lucide/svelte/icons/check';
  import { Button } from '$lib/components/ui/button';
  import { Kbd } from '$lib/components/ui/kbd';
  import { Separator } from '$lib/components/ui/separator';
  import { Spinner } from '$lib/components/ui/spinner';
  import { ed } from '$lib/editor.svelte';
  import { cn } from '$lib/utils';
  import AppMenu from './AppMenu.svelte';
  import ScreenPicker from './ScreenPicker.svelte';
  import ConsolePicker from './ConsolePicker.svelte';
  import ScopeSwitch from './ScopeSwitch.svelte';
  import ModeToggle from './ModeToggle.svelte';
  import IconButton from './IconButton.svelte';
  import { isActiveTheme, tryInRetroBat } from './actions';

  const active = $derived(isActiveTheme());
  const lastUndo = $derived(ed.history.done[ed.history.done.length - 1]);
</script>

<header class="ui-new relative z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-2 backdrop-blur-xl">
  <div class="flex shrink-0 items-center gap-1">
    <AppMenu />
    <div class="flex min-w-0 flex-col leading-tight" title={ed.project?.dir}>
      <span class="flex items-center gap-1.5 text-sm font-semibold">
        <span class="max-w-40 truncate 2xl:max-w-56">{ed.project?.name}</span>
        {#if ed.dirtyCount > 0}<span class="size-1.5 shrink-0 rounded-full bg-scope" title="Unsaved changes"></span>{/if}
      </span>
      {#if active}<span class="text-[10.5px] whitespace-nowrap text-primary">In use by RetroBat</span>{/if}
    </div>
    <div class="ml-1 flex items-center">
      <IconButton label={ed.canUndo ? `Undo ${lastUndo ?? ''}` : 'Nothing to undo'} shortcut="Ctrl+Z" disabled={!ed.canUndo} onclick={() => ed.undo()}><UndoIcon /></IconButton>
      <IconButton label={ed.canRedo ? `Redo ${ed.history.undone[0] ?? ''}` : 'Nothing to redo'} shortcut="Ctrl+Y" disabled={!ed.canRedo} onclick={() => ed.redo()}><RedoIcon /></IconButton>
    </div>
  </div>

  <Separator orientation="vertical" class="mx-1 !h-5" />

  <div class="flex min-w-0 flex-1 items-center gap-0.5">
    <ScreenPicker />
    <ConsolePicker />
  </div>

  <div class="flex shrink-0 justify-center px-1">
    <ScopeSwitch />
  </div>

  <div class="flex flex-1 shrink-0 items-center justify-end gap-1">
    <button
      class="flex h-8 items-center gap-2 rounded-lg border bg-muted/50 px-2.5 text-xs whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onclick={() => (ed.showSearch = true)}
      data-tour="search"
      title="Find any command, element or setting"
    >
      <SearchIcon class="size-3.5" />
      <span class="hidden xl:inline">Search</span>
      <Kbd>Ctrl K</Kbd>
    </button>
    <div class="flex h-8 items-center rounded-lg bg-muted p-0.5" role="group" aria-label="Editor mode">
      <button class={cn('h-7 rounded-md px-2.5 text-xs font-medium transition-all duration-200', ed.simple ? 'bg-background text-foreground shadow-elev-1' : 'text-muted-foreground hover:text-foreground')} onclick={() => ed.setMode('simple')} title="Plain names and the most useful settings">Simple</button>
      <button class={cn('h-7 rounded-md px-2.5 text-xs font-medium transition-all duration-200', !ed.simple ? 'bg-background text-foreground shadow-elev-1' : 'text-muted-foreground hover:text-foreground')} onclick={() => ed.setMode('advanced')} title="Every setting, file names and the XML source">Advanced</button>
    </div>
    <ModeToggle />
    <Separator orientation="vertical" class="mx-1 !h-5" />
    <Button variant="outline" size="sm" onclick={tryInRetroBat} data-tour="try" title="Save, make this RetroBat's theme and start RetroBat to see it for real (RetroBat's settings are backed up first)"><PlayIcon data-icon="inline-start" />Try in RetroBat</Button>
    <Button size="sm" data-tour="save" class="min-w-20 shadow-elev-1" onclick={() => ed.save()} disabled={ed.dirtyCount === 0 || ed.busy} title="Save your changes (Ctrl+S). A backup is made first.">
      {#if ed.busy}
        <Spinner data-icon="inline-start" />Saving
      {:else if ed.dirtyCount}
        Save
      {:else}
        <CheckIcon data-icon="inline-start" />Saved
      {/if}
    </Button>
  </div>
</header>
