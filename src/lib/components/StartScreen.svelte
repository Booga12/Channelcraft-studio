<script lang="ts">
  import { ask, open } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import { fileUrl, type ThemeInfo } from '$lib/api';
  import NewThemeDialog, { type StarterChoice } from './NewThemeDialog.svelte';
  import Icon from './Icon.svelte';

  let dialog = $state<{ mode: 'new' | 'duplicate'; source?: ThemeInfo } | null>(null);
  let filter = $state('');
  let choosing = $state<ThemeInfo | null>(null);
  let dontAsk = $state(false);

  function openTheme(t: ThemeInfo) {
    if (ed.askCopy) choosing = t;
    else ed.openTheme(t.path);
  }

  async function removeTheme(t: ThemeInfo) {
    if (ed.root?.activeTheme?.toLowerCase() === t.name.toLowerCase()) {
      ed.notify(`“${t.name}” is the theme RetroBat is using, so it can’t be deleted. Use another theme in RetroBat first.`, 'error');
      return;
    }
    const ok = await ask(`Delete “${t.name}”?\n\nThe folder goes to the Windows Recycle Bin, so you can restore it from there. A backup zip is saved first as well.`, {
      title: 'Delete theme',
      kind: 'warning',
      okLabel: 'Move to Recycle Bin',
      cancelLabel: 'Keep it',
    });
    if (ok) await ed.deleteTheme(t.path, t.name);
  }

  function chooseCopy() {
    const t = choosing!;
    if (dontAsk) ed.setAskCopy(false);
    choosing = null;
    dialog = { mode: 'duplicate', source: t };
  }

  function chooseOriginal() {
    const t = choosing!;
    if (dontAsk) ed.setAskCopy(false);
    choosing = null;
    ed.openTheme(t.path);
  }

  const shown = $derived(ed.themes.filter((t) => t.name.toLowerCase().includes(filter.trim().toLowerCase())));

  async function pickRoot() {
    const dir = await open({ directory: true, title: 'Choose your RetroBat folder (the one with RetroBat.exe)' });
    if (typeof dir === 'string') await ed.setRoot(dir);
  }

  async function created(path: string, starter?: StarterChoice) {
    dialog = null;
    await ed.openTheme(path);
    if (starter) await ed.applyStarter(starter);
  }
</script>

<div class="start">
  <aside class="side">
    <div class="brand">
      <div class="mark" aria-hidden="true">Cc</div>
      <div>
        <div class="app">ChannelCraft Studio</div>
        <div class="faint">Theme editor for RetroBat</div>
      </div>
    </div>
    <button class="primary create" onclick={() => (dialog = { mode: 'new' })} disabled={!ed.root}><Icon name="plus" size={14} /> New theme</button>
    <nav>
      <button class="nav on"><Icon name="home" size={16} /> Home</button>
      <button class="nav" onclick={() => ed.refreshThemes()} disabled={!ed.root}><Icon name="redo" size={16} /> Refresh themes</button>
    </nav>
    <div class="grow"></div>
    {#if ed.root}
      <div class="rootbox">
        <div class="faint label">RetroBat folder</div>
        <div class="mono path" title={ed.root.root}>{ed.root.root}</div>
        <button class="secondary small" onclick={pickRoot}><Icon name="folder" size={13} /> Change…</button>
      </div>
    {/if}
  </aside>

  {#if !ed.root}
    <section class="empty">
      <Icon name="folder" size={40} />
      <h2>Where is RetroBat installed?</h2>
      <p class="dim">Pick the folder that contains <span class="mono">RetroBat.exe</span>. Themes are read from its <span class="mono">emulationstation\.emulationstation\themes</span> folder.</p>
      <button class="primary" onclick={pickRoot}>Choose RetroBat folder…</button>
    </section>
  {:else}
    <section class="themes">
      <h1>Welcome to ChannelCraft Studio</h1>
      <p class="dim lead">Change how RetroBat looks: colours, fonts, pictures and layouts, with a live preview. Nothing reaches RetroBat until you save, and a backup is made first.</p>

      <div class="quick">
        <button class="qcard" onclick={() => (dialog = { mode: 'new' })}>
          <span class="qicon a"><Icon name="sparkle" size={22} /></span>
          <span><strong>Start a new theme</strong><small>A simple starter with a light and a dark colour set</small></span>
        </button>
        <button class="qcard" onclick={() => ed.themes[0] && (dialog = { mode: 'duplicate', source: shown.find((t) => t.name.toLowerCase() === ed.root?.activeTheme?.toLowerCase()) ?? ed.themes[0] })}>
          <span class="qicon b"><Icon name="copy" size={22} /></span>
          <span><strong>Remix the theme you use</strong><small>Copy RetroBat's current theme and change the copy</small></span>
        </button>
        <button class="qcard" onclick={() => (ed.showGuide = true)}>
          <span class="qicon c"><Icon name="help" size={22} /></span>
          <span><strong>How it works</strong><small>Four steps, two minutes</small></span>
        </button>
      </div>

      <div class="bar">
        <h2>Your themes <span class="faint">{ed.themes.length}</span></h2>
        <input placeholder="Find a theme…" bind:value={filter} />
      </div>

      <div class="grid">
        {#each shown as t (t.path)}
          <article class="card">
            <button class="thumb" onclick={() => openTheme(t)} title="Open {t.name}" disabled={ed.loading}>
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
                <button class="small icon-btn" onclick={() => removeTheme(t)} title="Delete this theme (moves it to the Recycle Bin)" aria-label="Delete {t.name}"><Icon name="trash" size={14} /></button>
                <button class="small" onclick={() => (dialog = { mode: 'duplicate', source: t })} title="Copy this theme to a new folder and edit the copy">Duplicate</button>
                <button class="small primary" onclick={() => openTheme(t)} disabled={ed.loading}>Edit</button>
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

{#if choosing}
  <div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (choosing = null)} onkeydown={(e) => e.key === 'Escape' && (choosing = null)}>
    <div class="choose" role="dialog" aria-modal="true">
      <h2>Edit “{choosing.name}”</h2>
      <p class="dim">Editing a copy keeps the original safe, so you can always switch back to it in RetroBat.</p>
      <div class="opts">
        <button class="opt primary" onclick={chooseCopy}>
          <strong>Make a copy and edit it</strong>
          <span>Recommended</span>
        </button>
        <button class="opt" onclick={chooseOriginal}>
          <strong>Edit the original</strong>
          <span>A backup is still made before the first save</span>
        </button>
      </div>
      <div class="foot">
        <label class="chk"><input type="checkbox" bind:checked={dontAsk} /> Don't ask again</label>
        <button class="ghost" onclick={() => (choosing = null)}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

{#if dialog}
  <NewThemeDialog mode={dialog.mode} source={dialog.source} oncreated={created} oncancel={() => (dialog = null)} />
{/if}

<style>
  .start {
    height: 100vh;
    display: flex;
    overflow: hidden;
    background: var(--frame);
  }
  .side {
    width: 230px;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 14px;
    background: var(--panel);
    border-right: 1px solid var(--line);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 4px;
  }
  .mark {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: linear-gradient(135deg, #2680eb, #7e4bd6);
    display: grid;
    place-items: center;
    font-weight: 800;
    color: #fff;
  }
  .app {
    font-weight: 700;
    font-size: 13px;
  }
  .create {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
  }
  nav {
    display: grid;
    gap: 2px;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 10px;
    background: transparent;
    padding: 8px 10px;
    text-align: left;
    color: var(--text-dim);
  }
  .nav.on {
    background: var(--raised);
    color: var(--text);
  }
  .grow {
    flex: 1;
  }
  .rootbox {
    display: grid;
    gap: 6px;
    padding: 10px;
    background: var(--bg);
    border-radius: 6px;
  }
  .rootbox .label {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .rootbox button {
    justify-self: start;
    display: flex;
    gap: 5px;
    align-items: center;
  }
  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty {
    margin: auto;
    max-width: 480px;
    text-align: center;
    padding: 24px;
    display: grid;
    justify-items: center;
    color: var(--text-dim);
  }
  .empty h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text);
  }
  .themes {
    flex: 1;
    overflow: auto;
    padding: 34px 40px 48px;
  }
  h1 {
    margin: 0;
    font-size: 26px;
    font-weight: 700;
  }
  .lead {
    max-width: 640px;
    font-size: 13px;
    margin: 8px 0 22px;
  }
  .quick {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 14px;
    margin-bottom: 32px;
  }
  .qcard {
    display: flex;
    gap: 14px;
    align-items: center;
    text-align: left;
    white-space: normal;
    background: var(--panel);
    border: 1px solid #3a3a3a;
    border-radius: 10px;
    padding: 14px 16px;
  }
  .qcard:hover {
    background: var(--panel-2);
    border-color: #555;
  }
  .qcard strong {
    display: block;
    font-size: 13px;
  }
  .qcard small {
    color: var(--text-faint);
    font-size: 11.5px;
  }
  .qicon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    flex: none;
    color: #fff;
  }
  .qicon.a {
    background: linear-gradient(135deg, #2680eb, #5c3bd6);
  }
  .qicon.b {
    background: linear-gradient(135deg, #d6458d, #e8733d);
  }
  .qicon.c {
    background: linear-gradient(135deg, #2d9d78, #2680eb);
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
    width: 220px;
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
  .icon-btn {
    background: transparent;
    padding: 3px 5px;
    color: var(--text-faint);
  }
  .icon-btn:hover:not(:disabled) {
    color: var(--danger);
    background: var(--raised);
  }
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: grid;
    place-items: center;
    z-index: 100;
  }
  .choose {
    width: min(480px, 92vw);
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    padding: 20px 22px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  .choose h2 {
    margin: 0 0 6px;
    font-size: 16px;
  }
  .opts {
    display: grid;
    gap: 8px;
    margin-top: 14px;
  }
  .opt {
    display: grid;
    gap: 2px;
    text-align: left;
    padding: 10px 14px;
    white-space: normal;
  }
  .opt span {
    font-size: 12px;
    opacity: 0.8;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 14px;
  }
  .chk {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--text-dim);
    font-size: 12px;
  }
</style>
