<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { ed } from '$lib/editor.svelte';
  import { ACCENTS, prefs } from '$lib/prefs.svelte';
  import { api } from '$lib/api';
  import Icon from './Icon.svelte';

  const SECTIONS = [
    { id: 'general', label: 'General', icon: 'settings' },
    { id: 'canvas', label: 'Canvas', icon: 'grid' },
    { id: 'saving', label: 'Saving & backups', icon: 'save' },
    { id: 'look', label: 'Appearance', icon: 'palette' },
    { id: 'preview', label: 'Preview', icon: 'monitor' },
  ] as const;
  let section = $state<(typeof SECTIONS)[number]['id']>('general');

  async function pickRoot() {
    const dir = await open({ directory: true, title: 'Choose your RetroBat folder (the one with RetroBat.exe)' });
    if (typeof dir === 'string') await ed.setRoot(dir);
  }

  async function showBackups() {
    try {
      const dir = await api.backupsDir();
      await revealItemInDir(dir);
    } catch (e) {
      ed.notify(String(e), 'error');
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (ed.showSettings = false)} />

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (ed.showSettings = false)}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Settings">
    <nav>
      <h2>Settings</h2>
      {#each SECTIONS as s}
        <button class="nav" class:on={section === s.id} onclick={() => (section = s.id)}><Icon name={s.icon} size={15} /> {s.label}</button>
      {/each}
    </nav>
    <section>
      {#if section === 'general'}
        <h3>General</h3>
        <div class="row">
          <div><strong>RetroBat folder</strong><small class="mono">{ed.root?.root ?? 'Not set'}</small></div>
          <button class="secondary small" onclick={pickRoot}>Change…</button>
        </div>
        <div class="row">
          <div><strong>Editor mode</strong><small>Simple shows plain names and the most useful settings. Advanced shows everything, including the XML.</small></div>
          <div class="seg">
            <button class:sel={ed.simple} onclick={() => ed.setMode('simple')}>Simple</button>
            <button class:sel={!ed.simple} onclick={() => ed.setMode('advanced')}>Advanced</button>
          </div>
        </div>
        <div class="row">
          <div><strong>Ask before editing an original theme</strong><small>Offers to make a copy first, so the original stays safe.</small></div>
          <input type="checkbox" checked={ed.askCopy} onchange={(e) => ed.setAskCopy(e.currentTarget.checked)} />
        </div>
      {:else if section === 'canvas'}
        <h3>Canvas</h3>
        <div class="row">
          <div><strong>Snap to guides</strong><small>Edges and centres snap to the screen and to other elements while you move or resize. Hold Alt to switch it off for a moment.</small></div>
          <input type="checkbox" checked={prefs.v.snap} onchange={(e) => prefs.set('snap', e.currentTarget.checked)} />
        </div>
        <div class="row">
          <div><strong>Show grid</strong><small>Elements also snap to the grid when it's showing.</small></div>
          <input type="checkbox" checked={prefs.v.showGrid} onchange={(e) => prefs.set('showGrid', e.currentTarget.checked)} />
        </div>
        <div class="row">
          <div><strong>Grid size</strong></div>
          <select value={String(prefs.v.gridSize)} onchange={(e) => prefs.set('gridSize', Number(e.currentTarget.value))}>
            <option value="0.025">2.5% of the screen</option>
            <option value="0.05">5% of the screen</option>
            <option value="0.1">10% of the screen</option>
          </select>
        </div>
        <div class="row">
          <div><strong>Show TV safe area</strong><small>Old TVs cut off the edges. Keep important things inside the inner line.</small></div>
          <input type="checkbox" checked={prefs.v.showSafeArea} onchange={(e) => prefs.set('showSafeArea', e.currentTarget.checked)} />
        </div>
        <div class="row">
          <div><strong>Show rulers</strong></div>
          <input type="checkbox" checked={prefs.v.showRulers} onchange={(e) => prefs.set('showRulers', e.currentTarget.checked)} />
        </div>
        <div class="row">
          <div><strong>Units</strong><small>Themes store sizes as a share of the screen. Pixels assume the preview's screen size.</small></div>
          <div class="seg">
            <button class:sel={prefs.v.units === '%'} onclick={() => prefs.set('units', '%')}>Percent</button>
            <button class:sel={prefs.v.units === 'px'} onclick={() => prefs.set('units', 'px')}>Pixels</button>
          </div>
        </div>
      {:else if section === 'saving'}
        <h3>Saving & backups</h3>
        <div class="row">
          <div><strong>Autosave</strong><small>Saves the theme for you. A backup is still made before the first save of each session.</small></div>
          <select value={String(prefs.v.autosaveMinutes)} onchange={(e) => prefs.set('autosaveMinutes', Number(e.currentTarget.value))}>
            <option value="0">Off</option>
            <option value="1">Every minute</option>
            <option value="5">Every 5 minutes</option>
            <option value="10">Every 10 minutes</option>
          </select>
        </div>
        <div class="row">
          <div><strong>Keep unsaved changes if the app closes</strong><small>Unsaved work is kept on the side and offered back next time you open the theme.</small></div>
          <input type="checkbox" checked={prefs.v.keepRecovery} onchange={(e) => prefs.set('keepRecovery', e.currentTarget.checked)} />
        </div>
        <div class="row">
          <div><strong>Backups to keep per theme</strong><small>Older backup zips are removed.</small></div>
          <select value={String(prefs.v.backupsKeep)} onchange={(e) => prefs.set('backupsKeep', Number(e.currentTarget.value))}>
            {#each [3, 5, 10, 25, 0] as n}
              <option value={String(n)}>{n === 0 ? 'Keep all' : n}</option>
            {/each}
          </select>
        </div>
        <div class="row">
          <div><strong>Backups folder</strong></div>
          <button class="secondary small" onclick={showBackups}><Icon name="folder" size={13} /> Open</button>
        </div>
        {#if ed.project}
          <div class="row">
            <div><strong>Restore a backup</strong><small>Put this theme back exactly as it was in one of its backups.</small></div>
            <button class="secondary small" onclick={() => ((ed.showSettings = false), (ed.showRestore = true))}>Choose…</button>
          </div>
        {/if}
      {:else if section === 'look'}
        <h3>Appearance</h3>
        <div class="row">
          <div><strong>Accent colour</strong></div>
          <div class="accents">
            {#each Object.entries(ACCENTS) as [id, a]}
              <button class="swatch" class:sel={prefs.v.accent === id} style:background={a.base} title={a.label} aria-label={a.label} onclick={() => prefs.set('accent', id)}></button>
            {/each}
          </div>
        </div>
        <div class="row">
          <div><strong>Interface size</strong><small>Makes all text and buttons bigger or smaller.</small></div>
          <select value={String(prefs.v.uiScale)} onchange={(e) => prefs.set('uiScale', Number(e.currentTarget.value))}>
            <option value="0.9">Compact (90%)</option>
            <option value="1">Normal</option>
            <option value="1.1">Large (110%)</option>
            <option value="1.25">Extra large (125%)</option>
          </select>
        </div>
      {:else}
        <h3>Preview</h3>
        <div class="row">
          <div><strong>Show my own games</strong><small>Uses the box art, screenshots, videos and descriptions RetroBat scraped for your games ({ed.gameSystems.length} systems have them). Off shows sample games.</small></div>
          <input type="checkbox" checked={prefs.v.realArtwork} onchange={(e) => prefs.set('realArtwork', e.currentTarget.checked)} />
        </div>
      {/if}
    </section>
    <button class="close ghost" onclick={() => (ed.showSettings = false)} aria-label="Close"><Icon name="close" size={16} /></button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: grid;
    place-items: center;
    z-index: 400;
  }
  .dialog {
    position: relative;
    display: grid;
    grid-template-columns: 200px 1fr;
    width: min(760px, 94vw);
    height: min(520px, 88vh);
    background: var(--panel);
    border: 1px solid #3a3a3a;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
  }
  nav {
    background: var(--frame);
    padding: 18px 10px;
    display: grid;
    align-content: start;
    gap: 2px;
  }
  h2 {
    margin: 0 8px 12px;
    font-size: 16px;
  }
  .nav {
    display: flex;
    gap: 9px;
    align-items: center;
    background: transparent;
    text-align: left;
    padding: 8px 10px;
    color: var(--text-dim);
  }
  .nav.on {
    background: var(--raised);
    color: var(--text);
  }
  section {
    padding: 20px 26px;
    overflow: auto;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 14px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 12px 0;
    border-bottom: 1px solid #383838;
  }
  .row > div:first-child {
    display: grid;
    gap: 2px;
  }
  small {
    color: var(--text-faint);
    font-size: 11.5px;
  }
  input[type='checkbox'] {
    width: 16px;
    height: 16px;
  }
  .seg {
    display: flex;
    background: var(--bg);
    border-radius: 14px;
    padding: 2px;
  }
  .seg button {
    background: transparent;
    border-radius: 12px;
    padding: 3px 11px;
    color: var(--text-dim);
  }
  .seg button.sel {
    background: var(--raised);
    color: var(--text);
  }
  .accents {
    display: flex;
    gap: 8px;
  }
  .swatch {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    padding: 0;
  }
  .swatch.sel {
    box-shadow:
      0 0 0 2px var(--panel),
      0 0 0 4px #fff;
  }
  .close {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 5px;
  }
</style>
