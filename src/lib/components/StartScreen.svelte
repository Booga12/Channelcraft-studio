<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import { fileUrl, type ThemeInfo } from '$lib/api';
  import NewThemeDialog from './NewThemeDialog.svelte';

  let dialog = $state<{ mode: 'new' | 'duplicate'; source?: ThemeInfo } | null>(null);
  let filter = $state('');

  const shown = $derived(ed.themes.filter((t) => t.name.toLowerCase().includes(filter.trim().toLowerCase())));

  async function pickRoot() {
    const dir = await open({ directory: true, title: 'Choose your RetroBat folder (the one with RetroBat.exe)' });
    if (typeof dir === 'string') await ed.setRoot(dir);
  }

  async function created(path: string) {
    dialog = null;
    await ed.openTheme(path);
  }
</script>

<div class="start">
  <header>
    <div class="brand">
      <div class="logo" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
      <div>
        <h1>ChannelCraft Studio</h1>
        <p class="dim">Theme editor for RetroBat</p>
      </div>
    </div>
    <div class="root">
      {#if ed.root}
        <span class="dim">RetroBat</span>
        <span class="mono path" title={ed.root.root}>{ed.root.root}</span>
        <button class="small" onclick={pickRoot}>Change…</button>
      {/if}
    </div>
  </header>

  {#if !ed.root}
    <section class="empty">
      <h2>Where is RetroBat installed?</h2>
      <p class="dim">Pick the folder that contains <span class="mono">RetroBat.exe</span>. Themes are read from its <span class="mono">emulationstation\.emulationstation\themes</span> folder.</p>
      <button class="primary" onclick={pickRoot}>Choose RetroBat folder…</button>
    </section>
  {:else}
    <section class="themes">
      <div class="bar">
        <h2>Themes <span class="faint">{ed.themes.length}</span></h2>
        <input placeholder="Filter…" bind:value={filter} />
        <button class="ghost" onclick={() => ed.refreshThemes()} title="Reload the list">↻ Refresh</button>
        <button class="primary" onclick={() => (dialog = { mode: 'new' })}>＋ New theme</button>
      </div>

      <div class="grid">
        {#each shown as t (t.path)}
          <article class="card">
            <button class="thumb" onclick={() => ed.openTheme(t.path)} title="Open {t.name}" disabled={ed.loading}>
              {#if t.preview}
                <img src={fileUrl(t.preview)} alt="" loading="lazy" />
              {:else}
                <div class="noimg">No preview</div>
              {/if}
              {#if ed.root.activeTheme?.toLowerCase() === t.name.toLowerCase()}
                <span class="badge accent active">Active in RetroBat</span>
              {/if}
            </button>
            <div class="meta">
              <div class="name" title={t.name}>{t.name}</div>
              <div class="actions">
                <button class="small" onclick={() => (dialog = { mode: 'duplicate', source: t })} title="Copy this theme to a new folder and edit the copy">Duplicate</button>
                <button class="small primary" onclick={() => ed.openTheme(t.path)} disabled={ed.loading}>Open</button>
              </div>
            </div>
          </article>
        {/each}
      </div>
      {#if ed.loading}
        <p class="dim loading">Loading theme…</p>
      {/if}
    </section>
  {/if}
</div>

{#if dialog}
  <NewThemeDialog mode={dialog.mode} source={dialog.source} oncreated={created} oncancel={() => (dialog = null)} />
{/if}

<style>
  .start {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 28px;
    border-bottom: 1px solid var(--line);
    background: var(--panel);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo {
    display: grid;
    grid-template-columns: repeat(2, 14px);
    gap: 3px;
  }
  .logo span {
    height: 10px;
    border-radius: 3px;
    background: var(--accent);
  }
  .logo span:nth-child(2),
  .logo span:nth-child(3) {
    background: #8fb9ff;
  }
  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
  h1 + p {
    margin: 0;
  }
  .root {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 380px;
  }
  .empty {
    margin: auto;
    max-width: 480px;
    text-align: center;
    padding: 24px;
  }
  .empty h2 {
    font-size: 20px;
    font-weight: 600;
  }
  .themes {
    flex: 1;
    overflow: auto;
    padding: 20px 28px 40px;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }
  .bar h2 {
    font-size: 15px;
    font-weight: 600;
    margin: 0 auto 0 0;
  }
  .bar input {
    width: 200px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 18px;
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .card:hover {
    border-color: var(--line-strong);
  }
  .thumb {
    position: relative;
    padding: 0;
    border: 0;
    border-radius: 0;
    aspect-ratio: 16 / 9;
    background: #0c0d10;
    overflow: hidden;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .noimg {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--text-faint);
  }
  .active {
    position: absolute;
    top: 8px;
    left: 8px;
    background: rgba(18, 20, 24, 0.85);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
  }
  .name {
    flex: 1;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  .loading {
    margin-top: 16px;
  }
</style>
