<script lang="ts" module>
  import { ed } from '$lib/editor.svelte';
  import { isGameListView } from '$lib/theme/resolver';

  /** Where edits go right now; shared by the switch and the amber frame around the preview. */
  export const scope = {
    get gameScreen() {
      return !!ed.res && ed.screenFile === 'theme.xml' && isGameListView(ed.res, ed.view);
    },
    get mode(): 'all' | 'console' | 'game' {
      return ed.gameOnly && this.gameScreen ? 'game' : ed.consoleOnly ? 'console' : 'all';
    },
    get label() {
      return this.mode === 'game' ? `Only ${ed.gameName}` : this.mode === 'console' ? `Only ${ed.consoleName}` : 'Everywhere';
    },
  };
</script>

<script lang="ts">
  // Chooses where edits go: every console, only the console in the preview, or (on game-list
  // screens) only the game in the preview, through RetroBat's per-game files. It sits in the top
  // bar, so it works the same whether or not something is selected.
  import GlobeIcon from '@lucide/svelte/icons/globe';
  import MonitorIcon from '@lucide/svelte/icons/monitor';
  import Gamepad2Icon from '@lucide/svelte/icons/gamepad-2';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
  import EyeIcon from '@lucide/svelte/icons/eye';
  import * as Popover from '$lib/components/ui/popover';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import { elementLabel, humanize, propLabel } from '$lib/friendly';
  import { cn } from '$lib/utils';
  import { mergeProps } from 'bits-ui';

  const own = $derived(ed.consoleValues);
  const blocker = $derived(ed.gameOnlyBlocker);
  const others = $derived(scope.gameScreen ? ed.gamesWithOwnLook : []);
  const current = $derived(ed.currentGames.length ? ed.gameIndex % ed.currentGames.length : -1);
  const hasOwn = $derived(others.some((g) => g.index === current));
  const extras = $derived(own.length + others.length);

  function pick(mode: 'all' | 'console' | 'game') {
    if (mode === 'game' && blocker) return;
    ed.consoleOnly = mode === 'console';
    ed.gameOnly = mode === 'game';
  }

  /** One Tab stop for the switch; the arrows move to the next option that can be chosen and pick it. */
  function radioKeys(e: KeyboardEvent) {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const usable = OPTIONS.filter((o) => !(o.id === 'game' && blocker));
    const i = usable.findIndex((o) => o.id === scope.mode);
    const next = usable[(i + dir + usable.length) % usable.length];
    if (!next) return;
    pick(next.id);
    const group = (e.currentTarget as HTMLElement).closest('[role="radiogroup"]');
    group?.querySelector<HTMLElement>(`[data-scope="${next.id}"]`)?.focus();
  }

  const OPTIONS = $derived([
    { id: 'all' as const, label: scope.gameScreen ? 'All' : 'All consoles', icon: GlobeIcon, help: 'Changes apply to every console and game.' },
    { id: 'console' as const, label: `Only ${ed.consoleName}`, icon: MonitorIcon, help: `Only changes ${ed.consoleName}, the console shown in the preview. Pick another console to give it its own look.` },
    ...(scope.gameScreen ? [{ id: 'game' as const, label: 'Only this game', icon: Gamepad2Icon, help: blocker ?? `Only changes ${ed.gameName}, the game shown in the preview. RetroBat shows it whenever that game is selected.` }] : []),
  ]);
</script>

<div class="flex items-center gap-1">
  <div role="radiogroup" aria-label="Where changes go" class="relative flex h-8 items-center rounded-lg bg-muted p-0.5 shadow-[inset_0_1px_2px_oklch(0_0_0/0.08)]">
    {#each OPTIONS as o (o.id)}
      {@const on = scope.mode === o.id}
      {@const off = o.id === 'game' && !!blocker}
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <button
              {...mergeProps(props, { onkeydown: radioKeys })}
              type="button"
              role="radio"
              data-scope={o.id}
              tabindex={on ? 0 : -1}
              aria-label={o.label}
              aria-checked={on}
              aria-disabled={off}
              onclick={() => pick(o.id)}
              class={cn(
                'relative flex h-7 max-w-40 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-all duration-200 ease-out-soft',
                on ? (o.id === 'all' ? 'bg-background text-foreground shadow-elev-1' : 'bg-scope text-black shadow-elev-1') : 'text-muted-foreground hover:text-foreground',
                off && 'cursor-not-allowed opacity-45 hover:text-muted-foreground',
              )}
            >
              <o.icon class="size-3.5 shrink-0" />
              <!-- On narrower windows only the chosen option keeps its words; the others show their icon and tooltip. -->
              <span class={cn('truncate', !on && 'hidden 2xl:inline')}>{o.label}</span>
            </button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom" sideOffset={6} class="max-w-64">{o.help}</Tooltip.Content>
      </Tooltip.Root>
    {/each}
  </div>

  <Popover.Root>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button {...props} variant="ghost" size="icon-sm" aria-label="Details about where changes go" class="relative text-muted-foreground">
          <ChevronDownIcon />
          {#if extras}
            <span class="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-scope px-1 text-[10px] leading-none font-semibold text-black">{extras}</span>
          {/if}
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content align="end" class="w-80 gap-0 p-0">
      <div class="flex flex-col gap-2 p-3 text-xs">
        <p class="m-0 text-sm font-medium">Changes go to: {scope.label}</p>
        {#if scope.mode === 'all'}
          <p class="m-0 text-muted-foreground">Every console and game gets your changes. Pick “Only {ed.consoleName}”{scope.gameScreen ? ' or “Only this game”' : ''} to give one its own look.</p>
        {:else if scope.mode === 'console'}
          <p class="m-0 text-muted-foreground">Colours, pictures and settings you change now apply only to {ed.consoleName}. Every other console keeps the shared ones.</p>
        {:else if blocker}
          <p class="m-0 text-muted-foreground">{blocker}</p>
        {:else}
          <p class="m-0 text-muted-foreground">Changes now apply only to <strong class="text-foreground">{ed.gameName}</strong>. Pick another game under the preview to give it its own look. The game parts (cover, video, name, description…) and anything you add can change; things RetroBat draws once for the whole list can't.</p>
          {#if ed.gameSharedFile && !ed.gameFile}
            <p class="m-0 text-muted-foreground">It uses a shared look for games without their own (<span class="font-mono">{ed.gameSharedFile.rel}</span>). Its own file starts as a copy of that look, so only your changes differ.</p>
          {/if}
          {#if hasOwn}
            <Button variant="outline" size="sm" class="self-start" onclick={() => ed.resetGame()}><RotateCcwIcon data-icon="inline-start" />Reset {ed.gameName}</Button>
          {/if}
        {/if}
      </div>

      {#if others.length}
        <Separator />
        <div class="flex flex-col gap-1 p-3 text-xs">
          <p class="m-0 font-medium">{others.length} game{others.length === 1 ? ' has its' : 's have their'} own look here</p>
          <ul class="m-0 flex max-h-40 list-none flex-col gap-0.5 overflow-auto p-0">
            {#each others as g (g.index)}
              <li class="flex items-center justify-between gap-2">
                <span class="truncate">{g.name}</span>
                <Button variant="ghost" size="xs" onclick={() => (ed.gameIndex = g.index)}><EyeIcon data-icon="inline-start" />Show</Button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if own.length}
        <Separator />
        <div class="flex flex-col gap-1 p-3 text-xs">
          <p class="m-0 flex items-center gap-1.5 font-medium">{ed.consoleName} has its own values <Badge variant="secondary">{own.length}</Badge></p>
          <ul class="m-0 flex max-h-48 list-none flex-col gap-0.5 overflow-auto p-0">
            {#each own as v (`${v.kind}:${v.element ?? ''}:${v.name}`)}
              <li class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                <span class="truncate">{v.kind === 'var' ? humanize(v.name) : `${elementLabel(v.element ?? '')}: ${propLabel(v.name)}`}</span>
                <span class="max-w-24 truncate font-mono text-muted-foreground">{v.def.raw}</span>
                <Button variant="ghost" size="xs" title="Use the shared value again" onclick={() => ed.clearConsoleValues([v])}>Reset</Button>
              </li>
            {/each}
          </ul>
          <Button variant="outline" size="sm" class="mt-1 self-start" onclick={() => ed.clearConsoleValues(own)}><RotateCcwIcon data-icon="inline-start" />Reset all of {ed.consoleName}</Button>
        </div>
      {/if}
    </Popover.Content>
  </Popover.Root>
</div>
