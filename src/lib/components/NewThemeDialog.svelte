<script lang="ts" module>
  export interface StarterChoice {
    design: string;
    artFrom: string | null;
    /** System screen layout; the design's own when not given. */
    systemLayout?: string;
    /** Game list layout; the design's own when not given. */
    gameLayout?: string;
  }
</script>

<script lang="ts">
  // New theme as four short steps with live pictures: a style, a design, the system menu and the
  // game list. Every step has a good choice made already, so Create works from any step, and
  // everything can be changed later in Presets.
  import AppDialog from './AppDialog.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import { ed } from '$lib/editor.svelte';
  import type { ThemeInfo } from '$lib/api';
  import { DESIGNS, DESIGN_GROUPS, designGameLayout, type DesignGroup } from '$lib/theme/designs';
  import { SYSTEM_LAYOUTS } from '$lib/theme/systemLayouts';
  import { GAME_LAYOUTS, flipped } from '$lib/theme/gameLayouts';
  import DesignThumb from './DesignThumb.svelte';
  import DesignGroupChips from './DesignGroupChips.svelte';
  import LayoutCard from './LayoutCard.svelte';
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

  const STEPS = ['Name and style', 'Design', 'System menu', 'Game list'];
  let step = $state(0);
  let name = $state(suggest());
  let error = $state('');
  let working = $state(false);
  let input = $state<HTMLInputElement>();
  let design = $state('cinema');
  let group = $state<DesignGroup | 'all'>('all');
  const shown = $derived(DESIGNS.filter((d) => group === 'all' || d.group === group));
  const chosen = $derived(DESIGNS.find((d) => d.id === design) ?? DESIGNS[0]);
  // The layouts start as the design's own, until you pick others.
  let systemLayout = $state<string | null>(null);
  let gameLayout = $state<string | null>(null);
  let flip = $state(false);
  const sysId = $derived(systemLayout ?? chosen.system);
  const gameBase = $derived(gameLayout ?? designGameLayout(chosen));
  const gameId = $derived(flip ? (flipped(gameBase) ?? gameBase) : gameBase);
  let artFrom = $state<string>('');
  let sources = $state<{ theme: ThemeInfo; logos: number; consoles: number }[]>([]);
  let scanning = $state(false);

  const exists = $derived(ed.themes.some((t) => t.name.toLowerCase() === name.trim().toLowerCase()));
  const canCreate = $derived(!!name.trim() && !exists && !working);

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

  function pickGroup(g: DesignGroup | 'all') {
    group = g;
    if (g !== 'all' && chosen.group !== g) pickDesign(DESIGNS.find((d) => d.group === g)!.id);
    step = 1;
  }

  function pickDesign(id: string) {
    design = id;
    systemLayout = null;
    gameLayout = null;
  }

  /** A random design with random layouts that go with it; press again for another. */
  function surprise() {
    const pool = DESIGNS.filter((d) => group === 'all' || d.group === group);
    const d = pool[Math.floor(Math.random() * pool.length)];
    design = d.id;
    systemLayout = SYSTEM_LAYOUTS[Math.floor(Math.random() * SYSTEM_LAYOUTS.length)].id;
    const bases = GAME_LAYOUTS.filter((l) => !l.flipOf);
    gameLayout = bases[Math.floor(Math.random() * bases.length)].id;
    flip = Math.random() < 0.3;
    step = 3;
  }

  async function submit(e?: Event) {
    e?.preventDefault();
    if (!canCreate) return;
    working = true;
    error = '';
    if (mode === 'new') {
      // Setting up a new theme takes a while; the overlay shows each step as it happens.
      task.start(`Building “${name.trim()}”`, [
        ['folder', 'Creating the theme folder'],
        ['open', 'Opening it'],
        ['art', 'Copying console logos and pictures'],
        ['design', `Adding the ${chosen.label} design`],
        ['fonts', 'Downloading fonts'],
        ['save', 'Saving'],
      ]);
      task.step('folder');
    }
    try {
      const path = mode === 'new' ? await ed.createTheme(name.trim()) : await ed.duplicateTheme(source!.path, name.trim());
      oncreated(path, mode === 'new' ? { design, artFrom: artFrom || null, systemLayout: sysId, gameLayout: gameId } : undefined);
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
  title={mode === 'new' ? 'Make my theme' : `Duplicate “${source?.name}”`}
  description={mode === 'new'
    ? 'Four quick choices, each with a picture. A good choice is already made at every step, so you can create the theme whenever you like and change anything later in Presets.'
    : 'Copies every file of the theme to a new folder, so you can change the copy and keep the original.'}
  onclose={oncancel}
  busy={working}
  class={mode === 'new' ? 'sm:max-w-[900px]' : 'sm:max-w-[460px]'}
>
  {#snippet footer()}
    <Button variant="outline" onclick={oncancel} disabled={working}>Cancel</Button>
    {#if mode === 'new'}
      <Button variant="ghost" onclick={surprise} disabled={working} title="A random design and layouts that go together. Press again for another.">Surprise me</Button>
      {#if step > 0}<Button variant="outline" onclick={() => (step -= 1)} disabled={working}>Back</Button>{/if}
      {#if step < STEPS.length - 1}<Button variant="outline" onclick={() => (step += 1)} disabled={working || !name.trim()}>Next</Button>{/if}
    {/if}
    <Button type="submit" form="new-theme-form" disabled={!canCreate}>
      {#if working}<Spinner data-icon="inline-start" />Working…{:else}{mode === 'new' ? 'Create and open' : 'Duplicate and open'}{/if}
    </Button>
  {/snippet}
  <form id="new-theme-form" onsubmit={submit}>
    {#if mode === 'new'}
      <ol class="steps" aria-label="Steps">
        {#each STEPS as s, i}
          <li><button type="button" class:on={step === i} class:done={step > i} onclick={() => (step = i)} aria-current={step === i ? 'step' : undefined}><b>{i + 1}</b>{s}</button></li>
        {/each}
      </ol>
      <p class="summary">
        <strong>{chosen.label}</strong> · {SYSTEM_LAYOUTS.find((l) => l.id === sysId)?.label} · {GAME_LAYOUTS.find((l) => l.id === gameId)?.label}
      </p>
    {/if}

    {#if mode !== 'new' || step === 0}
      <label class="field">
        <span>Name</span>
        <input bind:this={input} bind:value={name} spellcheck="false" />
      </label>
      {#if exists}
        <p class="err">A theme with this name already exists.</p>
      {/if}
    {/if}

    {#if mode === 'new'}
      {#if step === 0}
        <fieldset>
          <legend>What style do you like?</legend>
          <div class="groups">
            {#each [{ id: 'all' as const, label: 'Show me everything' }, ...DESIGN_GROUPS] as g (g.id)}
              {@const picks = DESIGNS.filter((d) => g.id === 'all' || d.group === g.id).slice(0, 3)}
              <button type="button" class="group" class:on={group === g.id} onclick={() => pickGroup(g.id)}>
                <span class="mini">{#each picks as d (d.id)}<DesignThumb design={d} />{/each}</span>
                <span class="dname">{g.label}</span>
              </button>
            {/each}
          </div>
        </fieldset>
      {:else if step === 1}
        <fieldset>
          <legend>Pick a design</legend>
          <DesignGroupChips bind:group />
          <div class="designs">
            {#each shown as d (d.id)}
              <label class="choice" class:on={design === d.id} title={d.description}>
                <input type="radio" name="design" value={d.id} checked={design === d.id} onchange={() => pickDesign(d.id)} />
                <DesignThumb design={d} />
                <span class="dname">{d.label}</span>
                <small>{d.description}</small>
              </label>
            {/each}
          </div>
        </fieldset>
      {:else if step === 2}
        <fieldset>
          <legend>How the consoles are shown (the system menu)</legend>
          <div class="designs">
            {#each SYSTEM_LAYOUTS as l (l.id)}
              <LayoutCard diagram={l.diagram} design={chosen} label={l.id === chosen.system ? `${l.label} (the design's own)` : l.label} description={l.description} on={sysId === l.id} onclick={() => (systemLayout = l.id)} />
            {/each}
          </div>
        </fieldset>
      {:else}
        <fieldset>
          <legend>How each console's games are shown (the game list)</legend>
          <label class="chk"><input type="checkbox" bind:checked={flip} /> Flip left and right</label>
          <div class="designs">
            {#each GAME_LAYOUTS.filter((l) => !l.flipOf) as l (l.id)}
              <LayoutCard diagram={(flip ? GAME_LAYOUTS.find((x) => x.id === flipped(l.id)) : l)?.diagram ?? l.diagram} design={chosen} label={l.id === designGameLayout(chosen) ? `${l.label} (the design's own)` : l.label} description={l.description} on={gameBase === l.id} onclick={() => (gameLayout = l.id)} />
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
    {/if}

    {#if error}
      <p class="err">{error}</p>
    {/if}
  </form>
</AppDialog>

<style>
  .steps {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
  }
  .steps button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 4px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg);
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 600;
  }
  .steps b {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--line);
    font-size: 11px;
  }
  .steps button.on {
    border-color: var(--brand);
    color: var(--text);
  }
  .steps button.on b,
  .steps button.done b {
    background: var(--brand);
    color: #fff;
  }
  .summary {
    margin: 8px 0 0;
    color: var(--text-dim);
    font-size: 12px;
  }
  .groups {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 10px;
  }
  .group {
    display: grid;
    gap: 6px;
    padding: 6px;
    text-align: left;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 8px;
  }
  .group:hover {
    border-color: var(--brand);
  }
  .group.on {
    border-color: var(--brand);
    box-shadow: 0 0 0 1px var(--brand);
  }
  .mini {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px;
  }
  .chk {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 8px;
    font-size: 12px;
  }
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
    max-height: 52vh;
    overflow-y: auto;
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
