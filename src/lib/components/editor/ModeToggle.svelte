<script lang="ts">
  // Light, dark or follow Windows.
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Button } from '$lib/components/ui/button';
  import SunIcon from '@lucide/svelte/icons/sun';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import { prefs, type Mode } from '$lib/prefs.svelte';

  let { side = 'bottom' as 'bottom' | 'top' | 'right' } = $props();
  const MODES: { v: Mode; label: string }[] = [
    { v: 'light', label: 'Light' },
    { v: 'dark', label: 'Dark' },
    { v: 'system', label: 'Same as Windows' },
  ];
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" size="icon-sm" class="relative text-muted-foreground hover:text-foreground" aria-label="Light or dark">
        <SunIcon class="scale-100 rotate-0 transition-all duration-300 dark:scale-0 dark:-rotate-90" />
        <MoonIcon class="absolute scale-0 rotate-90 transition-all duration-300 dark:scale-100 dark:rotate-0" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" {side} class="w-44">
    <DropdownMenu.Group>
      <DropdownMenu.RadioGroup value={prefs.v.mode} onValueChange={(v) => prefs.setMode(v as Mode)}>
        {#each MODES as m (m.v)}
          <DropdownMenu.RadioItem value={m.v} closeOnSelect>{m.label}</DropdownMenu.RadioItem>
        {/each}
      </DropdownMenu.RadioGroup>
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>
