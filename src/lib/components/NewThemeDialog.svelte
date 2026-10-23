<script lang="ts" module>
  export interface StarterChoice {
    design: string;
    artFrom: string | null;
  }
</script>

<script lang="ts">
  import AppDialog from './AppDialog.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import { ed } from '$lib/editor.svelte';
  import type { ThemeInfo } from '$lib/api';
  import { DESIGNS } from '$lib/theme/designs';
  import DesignThumb from './DesignThumb.svelte';
  import DesignGroupChips from './DesignGroupChips.svelte';
  import type { DesignGroup } from '$lib/theme/designs';
  import { task } from '$lib/task.svelte';

  let {
    mode,
    source,
    oncreated,
    oncancel,
  }: { mode: 'new' | 'duplicate'; source?: ThemeInfo; oncreated: (path: string, starter?: StarterChoice) => void; oncancel: () => void } = $props();

  function suggest(): string {
    if (mode === 'new') return 'My Theme';
    const n = source?.name ?? 'Theme';
    const m = n.match(/^(.*?)(\d+)$/);
    return m ? `${m[1]}${Number(m[2]) + 1}` : `${n} copy`;
  }

  let name = $state(suggest());
  let error = $state('');
  let working = $state(false);
  let input: HTMLInputElement;
  let design = $state('cinema');
  let group = $state<DesignGroup | 'all'>('all');
  const shown = $derived(DESIGNS.filter((d) => group === 'all' || d.group === group));
  let artFrom = $state<string>('');
  let sources = $state<{ theme: ThemeInfo; logos: number; consoles: number }[]>([]);
  let scanning = $state(false);

  const exists = $derived(ed.themes.some((t) => t.name.toLowerCase() === name.trim().toLowerCase()));

  $effect(() => {
    input?.select();
  });

  // Find installed themes that have system logos and console pictures to borrow.
  $effect(() => {
    if (mode !== 'new') return;
    scanning = true;
    (async () => {
      const out: typeof sources = [];
      for (const t of ed.themes) {
        try {
          const f = await ed.findConsoleArt(t.path);
          if (f.logoCount >= 10) out.push({ theme: t, logos: f.logoCount, consoles: f.consoleCount });
        } catch {
          // Unreadable theme: skip it.
        }
      }
      out.sort((a, b) => b.logos + b.consoles - (a.logos + a.consoles));
      sources = out;
      if (out[0] && !artFrom) artFrom = out[0].theme.path;
      scanning = false;
    })();
  });

  async function submit(e: Event) {
    e.preventDefault();
    if (!name.trim() || exists || working) return;
    working = true;
    error = '';
    if (mode === 'new') {
      // Setting up a new theme takes a while; the overlay shows each step as it happens.
      const d = DESIGNS.find((x) => x.id === design);
      task.start(`Building “${name.trim()}”`, [
        ['folder', 'Creating the theme folder'],
        ['open', 'Opening it'],
        ['art', 'Copying console logos and pictures'],
        ['design', d ? `Adding the ${d.label} design` : 'Adding the design'],
        ['fonts', 'Downloading fonts'],
        ['save', 'Saving'],
      ]);
      task.step('folder');
    }
    try {
      const path = mode === 'new' ? await ed.createTheme(name.trim()) : await ed.duplicateTheme(source!.path, name.trim());
      oncreated(path, mode === 'new' ? { design, artFrom: artFrom || null } : undefined);
    } catch (err) {
      // Back to the dialog, which says what went wrong.
      task.close();
      error = String(err);
    } finally {
      working = false;
    }
  }
</script>

<AppDialog
  title={mode === 'new' ? 'New theme' : `Duplicate “${source?.name}”`}
  description={mode === 'new'
    ? 'Pick a design to start from. It comes with artwork, colours, a font, animations and every RetroBat data element already placed: box art, screenshots, videos, logos, descriptions and more.'
    : 'Copies every file of the theme to a new folder, so you can change the copy and keep the original.'}
  onclose={oncancel}
  busy={working}
  class={mode === 'new' ? 'sm:max-w-[880px]' : 'sm:max-w-[460px]'}
>
  {#snippet footer()}
    <Button variant="outline" onclick={oncancel} disabled={working}>Cancel</Button>
    <Button type="submit" form="new-theme-form" disabled={!name.trim() || exists || working}>
      {#if working}<Spinner data-icon="inline-start" />Working…{:else}{mode === 'new' ? 'Create and open' : 'Duplicate and open'}{/if}
    </Button>
  {/snippet}
  <form id="new-theme-form" onsubmit={submit}>
    <label class="field">
      <span>Name</span>
      <input bind:this={input} bind:value={name} spellcheck="false" />
    </label>
    {#if exists}
      <p class="err">A theme with this name already exists.</p>
    {/if}

    {#if mode === 'new'}
      <fieldset>
        <legend>Design</legend>
        <DesignGroupChips bind:group />
        <div class="designs">
          {#each shown as d (d.id)}
            <label class="choice" class:on={design === d.id} title={d.description}>
              <input type="radio" name="design" value={d.id} bind:group={design} />
              <DesignThumb design={d} />
              <span class="dname">{d.label}</span>
              <small>{d.description}</small>
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Console logos and pictures</legend>
        <select bind:value={artFrom} disabled={scanning}>
          <option value="">{scanning ? 'Looking through your themes…' : 'None: show console names as text'}</option>
          {#each sources as s (s.theme.path)}
            <option value={s.theme.path}>Copy from {s.theme.name} ({s.logos} logos{s.consoles ? `, ${s.consoles} console pictures` : ''})</option>
          {/each}
        </select>
        <small class="note">Copies the system logos (and console pictures, if it has them) from one of your installed themes, so the system screen shows real logos straight away.</small>
      </fieldset>
    {/if}

    {#if error}
      <p class="err">{error}</p>
    {/if}
  </form>
</AppDialog>

<style>
  .field {
    display: grid;
    gap: 5px;
    margin-top: 14px;
  }
  .field span,
  legend {
    color: var(--text-dim);
    font-size: 11.5px;
    font-weight: 600;
  }
  .field input {
    font-size: 13px;
    padding: 6px 9px;
  }
  fieldset {
    border: none;
    padding: 0;
    margin: 16px 0 0;
  }
  legend {
    padding: 0;
    margin-bottom: 6px;
  }
  .designs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 10px;
  }
  .choice {
    position: relative;
    display: grid;
    gap: 4px;
    align-content: start;
    padding: 6px;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 8px;
    cursor: pointer;
  }
  .choice input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .choice.on {
    border-color: var(--brand);
    box-shadow: 0 0 0 1px var(--brand);
  }
  .choice:has(input:focus-visible) {
    outline: 2px solid var(--brand);
  }
  .dname {
    font-weight: 600;
  }
  small {
    color: var(--text-faint);
    font-size: 10.5px;
    line-height: 1.35;
  }
  select {
    width: 100%;
  }
  .note {
    display: block;
    margin-top: 5px;
  }
  .err {
    color: var(--danger);
    margin: 8px 0 0;
  }
</style>
