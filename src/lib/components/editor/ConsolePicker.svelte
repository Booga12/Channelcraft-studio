<script lang="ts">
  // Which console the preview shows (searchable), plus the theme language in Advanced mode.
  import * as Popover from '$lib/components/ui/popover';
  import * as Command from '$lib/components/ui/command';
  import * as Select from '$lib/components/ui/select';
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
  import StarIcon from '@lucide/svelte/icons/star';
  import CheckIcon from '@lucide/svelte/icons/check';
  import Gamepad2Icon from '@lucide/svelte/icons/gamepad-2';
  import { ed } from '$lib/editor.svelte';

  const LANGS = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'zh', 'ko', 'sv', 'tr'];

  let open = $state(false);
  const withGames = $derived(ed.previewSystems.filter((s) => ed.gameSystems.includes(s.name)));
  const others = $derived(ed.previewSystems.filter((s) => !ed.gameSystems.includes(s.name)));

  function pick(name: string) {
    const s = ed.systems.find((x) => x.name === name);
    if (s) ed.setSystem(s);
    open = false;
  }
</script>

<div class="flex min-w-0 items-center gap-1">
  <Popover.Root bind:open>
    <Popover.Trigger>
      {#snippet child({ props })}
        <button {...props} class="flex h-8 min-w-0 max-w-60 items-center gap-2 rounded-lg px-2.5 text-sm transition-colors hover:bg-muted aria-expanded:bg-muted" title="Which console the preview shows (Page Up / Page Down to step through)">
          <Gamepad2Icon class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate">{ed.settings.system.fullName}</span>
          <ChevronsUpDownIcon class="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content align="start" class="w-80 p-0">
      <Command.Root>
        <Command.Input placeholder="Find a console…" />
        <Command.List class="max-h-80">
          <Command.Empty>No console with that name.</Command.Empty>
          {#if withGames.length}
            <Command.Group heading="With your games">
              {#each withGames as s (s.name)}
                <Command.Item value={`${s.fullName} ${s.name}`} onSelect={() => pick(s.name)}>
                  <StarIcon class="fill-current text-scope" />
                  <span class="truncate">{s.fullName}</span>
                  {#if s.name === ed.settings.system.name}<CheckIcon class="ml-auto text-primary" />{/if}
                </Command.Item>
              {/each}
            </Command.Group>
          {/if}
          <Command.Group heading="Other consoles">
            {#each others as s (s.name)}
              <Command.Item value={`${s.fullName} ${s.name}`} onSelect={() => pick(s.name)}>
                <span class="size-4"></span>
                <span class="truncate">{s.fullName}</span>
                {#if s.name === ed.settings.system.name}<CheckIcon class="ml-auto text-primary" />{/if}
              </Command.Item>
            {/each}
          </Command.Group>
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>

  {#if !ed.simple}
    <Select.Root type="single" bind:value={ed.settings.lang}>
      <Select.Trigger size="sm" class="h-8 w-[4.5rem] border-transparent bg-transparent uppercase shadow-none hover:bg-muted dark:bg-transparent" title="Language used by the theme">{ed.settings.lang}</Select.Trigger>
      <Select.Content>
        {#each LANGS as l (l)}
          <Select.Item value={l} label={l.toUpperCase()} />
        {/each}
      </Select.Content>
    </Select.Root>
  {/if}
</div>
