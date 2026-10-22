<script lang="ts">
  // Which screen of the theme the preview shows, and the TV shape it is drawn for.
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import { ed, SPLASH_FILES } from '$lib/editor.svelte';
  import { isCurrent, RATIOS, screenHelp, screenIcon, screenLabel } from './screens';

  const current = $derived(ed.screens.find(isCurrent) ?? ed.screens[0]);
  const CurrentIcon = $derived(current ? screenIcon(current) : null);
  /** RetroBat's loading screens the theme doesn't have yet. */
  const missing = $derived(SPLASH_FILES.filter((f) => !ed.screens.some((t) => t.file === f)));
  const ADD: Record<string, { label: string; help: string }> = {
    'splash.xml': { label: 'Add a loading screen', help: 'What RetroBat shows while it starts (splash.xml)' },
    'gamesplash.xml': { label: 'Add a game launch screen', help: 'What RetroBat shows while a game starts (gamesplash.xml)' },
  };
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <button {...props} class="flex h-8 min-w-0 max-w-56 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-muted aria-expanded:bg-muted" title="Which screen of the theme to show">
        {#if CurrentIcon}<CurrentIcon class="size-4 shrink-0 text-muted-foreground" />{/if}
        <span class="truncate">{current ? screenLabel(current) : 'Screen'}</span>
        <ChevronsUpDownIcon class="size-3.5 shrink-0 text-muted-foreground" />
      </button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="start" class="w-72">
    <DropdownMenu.Group>
      <DropdownMenu.Label>Screens</DropdownMenu.Label>
      {#each ed.screens as t (t.id)}
        {@const Icon = screenIcon(t)}
        <DropdownMenu.Item onSelect={() => ed.showScreen(t)} class="items-start gap-2.5 py-1.5 data-[current=true]:bg-primary/10" data-current={isCurrent(t)}>
          <Icon class="mt-0.5 shrink-0 {isCurrent(t) ? 'text-primary' : ''}" />
          <div class="flex min-w-0 flex-col">
            <span class="truncate {isCurrent(t) ? 'font-medium text-primary' : ''}">{screenLabel(t)}</span>
            <span class="line-clamp-2 text-xs text-muted-foreground">{screenHelp(t)}</span>
          </div>
        </DropdownMenu.Item>
      {/each}
    </DropdownMenu.Group>
    {#if missing.length}
      <DropdownMenu.Separator />
      <DropdownMenu.Group>
        {#each missing as f (f)}
          <DropdownMenu.Item onSelect={() => ed.addLoadingScreen(f)} class="items-start gap-2.5 py-1.5">
            <PlusIcon class="mt-0.5 shrink-0" />
            <div class="flex min-w-0 flex-col">
              <span>{ADD[f].label}</span>
              <span class="text-xs text-muted-foreground">{ADD[f].help}</span>
            </div>
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Group>
    {/if}
    <DropdownMenu.Separator />
    <DropdownMenu.Group>
      <DropdownMenu.Label>TV shape</DropdownMenu.Label>
      <DropdownMenu.RadioGroup bind:value={ed.settings.ratio}>
        {#each RATIOS as r (r.v)}
          <DropdownMenu.RadioItem value={r.v} closeOnSelect>{r.label}</DropdownMenu.RadioItem>
        {/each}
      </DropdownMenu.RadioGroup>
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>
