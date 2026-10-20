<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import type { ThemeInfo } from '$lib/api';

  let { mode, source, oncreated, oncancel }: { mode: 'new' | 'duplicate'; source?: ThemeInfo; oncreated: (path: string) => void; oncancel: () => void } = $props();

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
      oncreated(path);
    } catch (err) {
      error = String(err);
    } finally {
      working = false;
    }
  }
</script>

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && oncancel()} onkeydown={(e) => e.key === 'Escape' && oncancel()}>
  <form class="dialog" onsubmit={submit}>
    <h2>{mode === 'new' ? 'New theme' : `Duplicate “${source?.name}”`}</h2>
    <p class="dim">
      {#if mode === 'new'}
        Starts from a small starter theme with a system view, game list views and a dark/light colour set.
      {:else}
        Copies every file of the theme to a new folder, so you can change the copy and keep the original.
      {/if}
    </p>
    <label>
      <span>Folder name</span>
      <input bind:this={input} bind:value={name} spellcheck="false" />
    </label>
    {#if exists}
      <p class="err">A theme with this name already exists.</p>
    {/if}
    {#if error}
      <p class="err">{error}</p>
    {/if}
    <div class="buttons">
      <button type="button" onclick={oncancel}>Cancel</button>
      <button type="submit" class="primary" disabled={!name.trim() || exists || working}>{working ? 'Working…' : mode === 'new' ? 'Create and open' : 'Duplicate and open'}</button>
    </div>
  </form>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: grid;
    place-items: center;
    z-index: 100;
  }
  .dialog {
    width: min(460px, 92vw);
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    padding: 20px 22px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  h2 {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 600;
  }
  label {
    display: grid;
    gap: 5px;
    margin-top: 14px;
  }
  label span {
    color: var(--text-dim);
    font-size: 12px;
  }
  .err {
    color: var(--danger);
    margin: 8px 0 0;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 18px;
  }
</style>
