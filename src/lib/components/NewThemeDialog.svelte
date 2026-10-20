<script lang="ts" module>
  export interface StarterChoice {
    game: string;
    system: string;
    palette: string;
  }
</script>

<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import type { ThemeInfo } from '$lib/api';
  import { LAYOUTS, PALETTES, type Rect } from '$lib/theme/presets';

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
  let game = $state('classic');
  let system = $state('carousel-middle');
  let palette = $state('midnight');

  const gameLayouts = LAYOUTS.filter((l) => l.kind === 'game');
  const systemLayouts = LAYOUTS.filter((l) => l.kind === 'system');

  const COLORS: Record<Rect['role'], string> = { list: '#378ef0', art: '#e8733d', text: '#8a8a8a', logo: '#b98cff', carousel: '#2d9d78', info: '#8a8a8a' };

  const exists = $derived(ed.themes.some((t) => t.name.toLowerCase() === name.trim().toLowerCase()));

  $effect(() => {
    input?.select();
  });

  async function submit(e: Event) {
    e.preventDefault();
    if (!name.trim() || exists || working) return;
    working = true;
    error = '';
    try {
      const path = mode === 'new' ? await ed.createTheme(name.trim()) : await ed.duplicateTheme(source!.path, name.trim());
      oncreated(path, mode === 'new' ? { game, system, palette } : undefined);
    } catch (err) {
      error = String(err);
    } finally {
      working = false;
    }
  }
</script>

{#snippet diagram(rects: Rect[])}
  <svg viewBox="0 0 160 90" class="pic" aria-hidden="true">
    <rect x="0" y="0" width="160" height="90" fill="#141414" />
    {#each rects as r}
      <rect x={r.x * 160} y={r.y * 90} width={r.w * 160} height={r.h * 90} rx="2" fill={COLORS[r.role]} opacity={r.role === 'text' || r.role === 'info' ? 0.55 : 0.9} />
    {/each}
  </svg>
{/snippet}

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && oncancel()} onkeydown={(e) => e.key === 'Escape' && oncancel()}>
  <form class="dialog" class:wide={mode === 'new'} onsubmit={submit}>
    <h2>{mode === 'new' ? 'New theme' : `Duplicate “${source?.name}”`}</h2>
    <p class="dim">
      {#if mode === 'new'}
        Pick a starting point. You can change everything afterwards, and switch layouts any time in the Presets panel.
      {:else}
        Copies every file of the theme to a new folder, so you can change the copy and keep the original.
      {/if}
    </p>
    <label class="field">
      <span>Name</span>
      <input bind:this={input} bind:value={name} spellcheck="false" />
    </label>
    {#if exists}
      <p class="err">A theme with this name already exists.</p>
    {/if}

    {#if mode === 'new'}
      <fieldset>
        <legend>Game list layout</legend>
        <div class="choices">
          {#each gameLayouts as l (l.id)}
            <label class="choice" class:on={game === l.id} title={l.description}>
              <input type="radio" name="game" value={l.id} bind:group={game} />
              {@render diagram(l.diagram)}
              <span>{l.label}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>System screen</legend>
        <div class="choices">
          {#each systemLayouts as l (l.id)}
            <label class="choice" class:on={system === l.id} title={l.description}>
              <input type="radio" name="system" value={l.id} bind:group={system} />
              {@render diagram(l.diagram)}
              <span>{l.label}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Colours</legend>
        <div class="pals">
          {#each PALETTES as p (p.id)}
            <label class="pal" class:on={palette === p.id}>
              <input type="radio" name="palette" value={p.id} bind:group={palette} />
              <span class="sw">
                {#each ['bgColor', 'accentColor', 'textColor', 'dimTextColor'] as k}
                  <span style:background="#{p.colors[k].slice(0, 6)}"></span>
                {/each}
              </span>
              <span>{p.label}</span>
            </label>
          {/each}
        </div>
      </fieldset>
    {/if}

    {#if error}
      <p class="err">{error}</p>
    {/if}
    <div class="buttons">
      <button type="button" class="secondary" onclick={oncancel}>Cancel</button>
      <button type="submit" class="primary" disabled={!name.trim() || exists || working}>{working ? 'Working…' : mode === 'new' ? 'Create and open' : 'Duplicate and open'}</button>
    </div>
  </form>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: grid;
    place-items: center;
    z-index: 100;
  }
  .dialog {
    width: min(460px, 92vw);
    max-height: 92vh;
    overflow: auto;
    background: var(--panel);
    border: 1px solid #3a3a3a;
    border-radius: 10px;
    padding: 20px 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  .dialog.wide {
    width: min(720px, 94vw);
  }
  h2 {
    margin: 0 0 6px;
    font-size: 18px;
    font-weight: 700;
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
  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    gap: 8px;
  }
  .choice,
  .pal {
    position: relative;
    display: grid;
    gap: 4px;
    padding: 6px;
    background: var(--bg);
    border: 1px solid #3a3a3a;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11.5px;
  }
  .choice input,
  .pal input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .choice.on,
  .pal.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .choice:has(input:focus-visible),
  .pal:has(input:focus-visible) {
    outline: 2px solid var(--accent);
  }
  .pic {
    width: 100%;
    display: block;
    border-radius: 3px;
  }
  .pals {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .pal {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sw {
    display: flex;
    border-radius: 3px;
    overflow: hidden;
  }
  .sw span {
    width: 10px;
    height: 18px;
  }
  .err {
    color: var(--danger);
    margin: 8px 0 0;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }
</style>
