<script lang="ts">
  import { ask } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import type { Ratio } from '$lib/theme/context';

  const LANGS = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'zh', 'ko', 'sv', 'tr'];
  const RATIOS: { v: Ratio; label: string }[] = [
    { v: '16/9', label: '16:9' },
    { v: '16/10', label: '16:10' },
    { v: '4/3', label: '4:3' },
  ];

  async function close() {
    if (ed.dirtyCount > 0) {
      const leave = await ask(`Close ${ed.project?.name} without saving ${ed.dirtyCount} changed file(s)?`, {
        title: 'Unsaved changes',
        kind: 'warning',
        okLabel: 'Close without saving',
        cancelLabel: 'Keep editing',
      });
      if (!leave) return;
    }
    ed.closeTheme();
  }

  function pickSystem(e: Event) {
    const name = (e.currentTarget as HTMLSelectElement).value;
    const s = ed.systems.find((x) => x.name === name);
    if (s) ed.settings.system = s;
  }

  async function launch() {
    if (ed.dirtyCount > 0) {
      const go = await ask('There are unsaved changes, which RetroBat will not show. Launch anyway?', { title: 'Launch RetroBat', kind: 'warning', okLabel: 'Launch', cancelLabel: 'Cancel' });
      if (!go) return;
    }
    ed.launch();
  }

  const isActive = $derived(!!ed.project && ed.root?.activeTheme?.toLowerCase() === ed.project.name.toLowerCase());
</script>

<header class="toolbar">
  <button class="ghost back" onclick={close} title="Back to the theme list">‹ Themes</button>
  <div class="title" title={ed.project?.dir}>
    <strong>{ed.project?.name}</strong>
    {#if isActive}<span class="badge accent">Active</span>{/if}
  </div>

  <div class="group">
    <label>
      <span>View</span>
      <select bind:value={ed.view} onchange={() => (ed.selected = null)}>
        {#each ed.viewNames as v}
          <option value={v}>{ed.res?.views.get(v)?.displayName ?? v}</option>
        {/each}
      </select>
    </label>
    <label>
      <span>System</span>
      <select value={ed.settings.system.name} onchange={pickSystem} class="system">
        {#each ed.systems as s (s.name)}
          <option value={s.name}>{s.fullName}</option>
        {/each}
      </select>
    </label>
    <label>
      <span>Screen</span>
      <select bind:value={ed.settings.ratio}>
        {#each RATIOS as r}<option value={r.v}>{r.label}</option>{/each}
      </select>
    </label>
    <label>
      <span>Lang</span>
      <select bind:value={ed.settings.lang}>
        {#each LANGS as l}<option value={l}>{l}</option>{/each}
      </select>
    </label>
  </div>

  <div class="spacer"></div>

  <div class="group">
    <button class="ghost" onclick={() => ed.undo()} disabled={!ed.canUndo} title="Undo (Ctrl+Z)">↶</button>
    <button class="ghost" onclick={() => ed.redo()} disabled={!ed.canRedo} title="Redo (Ctrl+Y)">↷</button>
    <button class:on={ed.showSource} class="ghost" onclick={() => (ed.showSource = !ed.showSource)} title="Show the XML source">&lt;/&gt; Source</button>
    <button class="primary" onclick={() => ed.save()} disabled={ed.dirtyCount === 0 || ed.busy} title="Save (Ctrl+S)">
      Save{ed.dirtyCount ? ` (${ed.dirtyCount})` : ''}
    </button>
    <button onclick={() => ed.setActive()} disabled={isActive} title="Make this RetroBat's theme (es_settings.cfg is backed up first)">Use in RetroBat</button>
    <button onclick={launch} title="Start RetroBat">▶ Launch</button>
  </div>
</header>

<style>
  .toolbar {
    grid-area: top;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 7px 12px;
    background: var(--panel-2);
    border-bottom: 1px solid var(--line);
    min-width: 0;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    max-width: 260px;
  }
  .title strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  label span {
    color: var(--text-faint);
    font-size: 11.5px;
  }
  select {
    max-width: 150px;
  }
  select.system {
    max-width: 200px;
  }
  .spacer {
    flex: 1;
  }
  .on {
    background: var(--accent-soft);
    color: var(--accent);
  }
</style>
