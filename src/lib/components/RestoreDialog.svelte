<script lang="ts">
  // Lists the open theme's backups and puts the theme back exactly as it was in one of them.
  import { ask } from '@tauri-apps/plugin-dialog';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { ed } from '$lib/editor.svelte';
  import { api, type BackupInfo } from '$lib/api';
  import Icon from './Icon.svelte';

  const dir = ed.project?.dir ?? '';
  const name = ed.project?.name ?? '';
  let backups = $state<BackupInfo[] | null>(null);
  let error = $state('');
  let working = $state(false);

  async function load() {
    try {
      backups = await api.listBackups(dir);
    } catch (e) {
      error = String(e);
      backups = [];
    }
  }
  load();

  const NOTES: Record<string, string> = {
    'before saving': 'Before the first save of a session',
    'before restoring a backup': 'Before a backup was restored',
    'before delete': 'Before the theme was deleted',
  };
  const when = (secs: number) => new Date(secs * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  async function restore(b: BackupInfo) {
    const unsaved = ed.dirtyCount ? `\n\nYour ${ed.dirtyCount} unsaved file(s) will be lost.` : '';
    const ok = await ask(
      `Put “${name}” back exactly as it was on ${when(b.created)}?\n\nFiles added since then are removed. Your current version is backed up first, so you can come back to it.${unsaved}`,
      { title: 'Restore backup', kind: 'warning', okLabel: 'Restore', cancelLabel: 'Cancel' },
    );
    if (!ok) return;
    working = true;
    const done = await ed.restoreBackup(b.path);
    working = false;
    if (done) ed.showRestore = false;
    else load();
  }

  function close() {
    if (!working) ed.showRestore = false;
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && close()}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Restore a backup">
    <header>
      <h2>Restore a backup</h2>
      <p class="dim">
        ChannelCraft backs up the whole theme before the first save of each session, and before a restore. Each backup is checked file by file before anything is changed.
      </p>
    </header>
    <div class="list">
      {#if backups === null}
        <p class="dim">Looking for backups of “{name}”…</p>
      {:else if error}
        <p class="err">{error}</p>
      {:else if !backups.length}
        <p class="dim">There are no backups of “{name}” yet. One is made the first time you save.</p>
      {:else}
        {#each backups as b (b.path)}
          <div class="row" class:off={!b.restorable}>
            <Icon name={b.restorable ? 'save' : 'file'} size={18} />
            <div class="info">
              <strong>{when(b.created)}</strong>
              <small>{NOTES[b.note] ?? (b.note || 'Backup')} · {b.files} files · {size(b.size)}</small>
              {#if b.problem}<small class="warn">{b.problem}</small>{/if}
            </div>
            <button class="ghost small" title="Show this zip in its folder" onclick={() => revealItemInDir(b.path)}><Icon name="folder" size={14} /></button>
            <button class="small" disabled={!b.restorable || working || ed.busy} onclick={() => restore(b)}>{working ? 'Restoring…' : 'Restore'}</button>
          </div>
        {/each}
      {/if}
    </div>
    <footer>
      <button class="secondary" onclick={close} disabled={working}>Close</button>
    </footer>
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
    display: grid;
    grid-template-rows: auto 1fr auto;
    width: min(620px, 94vw);
    max-height: min(600px, 88vh);
    background: var(--panel);
    border: 1px solid #3a3a3a;
    border-radius: 12px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  header {
    padding: 18px 20px 8px;
  }
  h2 {
    margin: 0 0 6px;
    font-size: 16px;
  }
  header p {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
  }
  .list {
    overflow: auto;
    padding: 8px 12px;
    display: grid;
    align-content: start;
    gap: 6px;
  }
  .list > p {
    padding: 8px;
  }
  .row {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    gap: 10px;
    align-items: center;
    padding: 8px 10px;
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    background: var(--bg);
  }
  .row.off {
    opacity: 0.75;
  }
  .info {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  small {
    color: var(--text-faint);
    font-size: 11px;
  }
  small.warn {
    color: var(--warn);
  }
  .err {
    color: var(--danger, #e5534b);
  }
  footer {
    display: flex;
    justify-content: flex-end;
    padding: 10px 16px 14px;
  }
</style>
