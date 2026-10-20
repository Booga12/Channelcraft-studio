<script lang="ts" module>
  export interface StarterChoice {
    design: string;
    artFrom: string | null;
  }
</script>

<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import type { ThemeInfo } from '$lib/api';
  import { DESIGNS } from '$lib/theme/designs';
  import DesignThumb from './DesignThumb.svelte';

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
    try {
      const path = mode === 'new' ? await ed.createTheme(name.trim()) : await ed.duplicateTheme(source!.path, name.trim());
      oncreated(path, mode === 'new' ? { design, artFrom: artFrom || null } : undefined);
    } catch (err) {
      error = String(err);
    } finally {
      working = false;
    }
  }
</script>

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && oncancel()} onkeydown={(e) => e.key === 'Escape' && oncancel()}>
  <form class="dialog" class:wide={mode === 'new'} onsubmit={submit}>
    <h2>{mode === 'new' ? 'New theme' : `Duplicate “${source?.name}”`}</h2>
    <p class="dim">
      {#if mode === 'new'}
        Pick a design to start from. It comes with artwork, colours, a font, animations and every RetroBat data element already placed: box art, screenshots, videos, logos, descriptions and more.
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
        <legend>Design</legend>
        <div class="designs">
          {#each DESIGNS as d (d.id)}
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
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  .dialog.wide {
    width: min(880px, 95vw);
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
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    cursor: pointer;
  }
  .choice input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .choice.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .choice:has(input:focus-visible) {
    outline: 2px solid var(--accent);
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
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }
</style>
