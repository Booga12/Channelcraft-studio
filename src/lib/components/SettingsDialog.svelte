<script lang="ts">
  import { updates } from '$lib/updates.svelte';
  let updateMsg = $state('');
  import * as Dialog from '$lib/components/ui/dialog';
  import { open } from '@tauri-apps/plugin-dialog';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { ed } from '$lib/editor.svelte';
  import { ACCENTS, prefs, type Mode } from '$lib/prefs.svelte';
  import { api } from '$lib/api';
  import Icon from './Icon.svelte';
  import IntroVideoSettings from './IntroVideoSettings.svelte';
  import { getVersion } from '@tauri-apps/api/app';
  import LICENSE from '../../../LICENSE?raw';

  let showLicence = $state(false);
  // One line per paragraph, so it wraps to the panel instead of at 80 columns.
  const licenceText = LICENSE.split(/\r?\n\r?\n/).map((p) => p.replace(/\s*\r?\n\s*/g, ' ')).join('\n\n');

  let version = $state('');
  getVersion().then((v) => (version = v)).catch(() => {});

  const SECTIONS = [
    { id: 'general', label: 'General', icon: 'settings' },
    { id: 'canvas', label: 'Canvas', icon: 'grid' },
    { id: 'saving', label: 'Saving & backups', icon: 'save' },
    { id: 'look', label: 'Appearance', icon: 'palette' },
    { id: 'preview', label: 'Preview', icon: 'monitor' },
    { id: 'intro', label: 'Intro video', icon: 'video' },
    { id: 'about', label: 'About', icon: 'help' },
  ] as const;
  let section = $state<(typeof SECTIONS)[number]['id']>('general');

  async function pickRoot() {
    const dir = await open({ directory: true, title: 'Choose your RetroBat folder (the one with RetroBat.exe)' });
    if (typeof dir === 'string') await ed.setRoot(dir);
  }

  async function showNotices() {
    try {
      await revealItemInDir(await api.noticesPath());
    } catch (e) {
      ed.notify(String(e), 'error');
    }
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

<Dialog.Root open onOpenChange={(o) => !o && (ed.showSettings = false)}>
  <Dialog.Content class="settings grid h-[min(560px,88vh)] w-[min(800px,94vw)] max-w-none grid-cols-[200px_1fr] gap-0 overflow-hidden p-0 shadow-elev-4 sm:max-w-none">
    <Dialog.Title class="sr-only">Settings</Dialog.Title>
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
          <div><strong>Light or dark</strong><small>System follows the Windows setting.</small></div>
          <select value={prefs.v.mode} onchange={(e) => prefs.setMode(e.currentTarget.value as Mode)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
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
            <option value="1.5">Huge (150%)</option>
          </select>
        </div>
      {:else if section === 'intro'}
        <IntroVideoSettings />
      {:else if section === 'about'}
        <h3>About</h3>
        <div class="row">
          <div><strong>ChannelCraft Studio {version}</strong><small>A theme editor for RetroBat. Not made by or affiliated with the RetroBat team.</small></div>
        </div>
        <div class="row">
          <div><strong>Your files stay on your computer</strong><small>Themes, games and settings are only read and written on this PC. The only time the app goes online is when you download a free font, which comes from the Google Fonts collection on GitHub.</small></div>
        </div>
        <div class="row">
          <div><strong>Licence: MIT</strong><small>Free to use, copy, change and share, including the changes you make. It comes without any warranty.</small></div>
          <button class="secondary small" onclick={() => (showLicence = !showLicence)}>{showLicence ? 'Hide' : 'Read it'}</button>
        </div>
        {#if showLicence}<pre class="licence">{licenceText}</pre>{/if}
        <div class="row">
          <div><strong>Updates</strong><small>{updateMsg || 'The studio looks for a newer version on its own a few seconds after starting. Updates are checked and signed, then installed with a restart.'}</small></div>
          <button class="secondary small" disabled={updates.state === 'checking'} onclick={async () => (updateMsg = (await updates.check()) ?? '')}>{updates.state === 'checking' ? 'Checking…' : 'Check for updates'}</button>
        </div>
        <div class="row">
          <div><strong>Open-source licences</strong><small>The open-source software this app is built with, and their licences.</small></div>
          <button class="secondary small" onclick={showNotices}>Show file</button>
        </div>
      {:else}
        <h3>Preview</h3>
        <div class="row">
          <div><strong>Show my own games</strong><small>Uses the box art, screenshots, videos and descriptions RetroBat scraped for your games ({ed.gameSystems.length} systems have them). Off shows sample games.</small></div>
          <input type="checkbox" checked={prefs.v.realArtwork} onchange={(e) => prefs.set('realArtwork', e.currentTarget.checked)} />
        </div>
        <div class="row">
          <div><strong>Fill missing pictures from libretro-thumbnails</strong><small>Games RetroBat hasn't scraped pictures for get free box art, title screens and screenshots from the libretro-thumbnails project online, found by the game's file name. Preview only: nothing is downloaded into your theme or RetroBat.</small></div>
          <input type="checkbox" checked={prefs.v.onlineArt} onchange={(e) => prefs.set('onlineArt', e.currentTarget.checked)} />
        </div>
      {/if}
    </section>
  </Dialog.Content>
</Dialog.Root>

<style>
  .licence {
    margin: 0 0 10px;
    padding: 10px 12px;
    max-height: 220px;
    overflow: auto;
    white-space: pre-wrap;
    font-size: 11px;
    line-height: 1.45;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 8px;
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
    border-bottom: 1px solid var(--line);
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
</style>
