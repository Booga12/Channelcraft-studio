<script lang="ts">
  import AppDialog from './AppDialog.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  // Brings in a theme someone shared (a .zip or a folder). It is looked at first and only written,
  // as a new theme folder, when the user presses Import.
  import { open } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import { api, type ImportPlan } from '$lib/api';

  let { onclose, onimported }: { onclose: () => void; onimported: (path: string) => void } = $props();

  let source = $state('');
  let plan = $state<ImportPlan | null>(null);
  let name = $state('');
  let busy = $state(false);
  let error = $state('');
  let showSkipped = $state(false);

  async function pick(folder: boolean) {
    const picked = folder
      ? await open({ directory: true, title: 'Choose the theme folder (the one with theme.xml in it, or above it)' })
      : await open({ title: 'Choose a theme .zip', filters: [{ name: 'Zip', extensions: ['zip'] }] });
    if (typeof picked !== 'string') return;
    source = picked;
    plan = null;
    error = '';
    busy = true;
    try {
      plan = await api.inspectThemeImport(picked);
      name = plan.suggestedName;
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }

  const taken = $derived(ed.themes.some((t) => t.name.toLowerCase() === name.trim().toLowerCase()));
  const badName = $derived(!name.trim() || /[\\/:*?"<>|]/.test(name) || name.trim().startsWith('.') || /[. ]$/.test(name));

  async function run() {
    if (!plan || taken || badName) return;
    busy = true;
    error = '';
    try {
      const path = await api.importTheme(source, name.trim());
      await ed.refreshThemes();
      ed.notify(`“${name.trim()}” was imported`);
      onimported(path);
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }

  const size = (b: number) => (b > 1 << 30 ? `${(b / (1 << 30)).toFixed(1)} GB` : b > 1 << 20 ? `${(b / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
</script>

<AppDialog
  title="Import a theme"
  description="Add a theme someone shared, from a .zip or a folder. ChannelCraft looks inside first and shows what will come in. It is added as a new theme: your other themes aren't touched and RetroBat keeps the theme it uses."
  {onclose}
  {busy}
  class="sm:max-w-[560px]"
>
  {#snippet footer()}
    <Button variant="outline" onclick={onclose} disabled={busy}>Cancel</Button>
    <Button onclick={run} disabled={!plan || busy || taken || badName}>{#if busy && plan}<Spinner data-icon="inline-start" />Importing…{:else}Import{/if}</Button>
  {/snippet}
    <div class="pick">
      <button class="secondary" onclick={() => pick(false)} disabled={busy}>Choose a .zip…</button>
      <button class="secondary" onclick={() => pick(true)} disabled={busy}>Choose a folder…</button>
      {#if busy && !plan}<span class="faint">Checking every file…</span>{/if}
    </div>
    {#if source}<div class="faint mono src" title={source}>{source}</div>{/if}

    {#if plan}
      <div class="summary">
        <p>
          <b>{plan.files.toLocaleString()}</b> files ({size(plan.bytes)}) will be imported{plan.root ? `, from the “${plan.root}” folder inside` : ''}.
          {#if !plan.hasSplash}<span class="faint">It has no loading screen of its own, so RetroBat shows its standard one.</span>{/if}
        </p>
        {#if plan.skipped.length}
          <button class="ghost small" onclick={() => (showSkipped = !showSkipped)} aria-expanded={showSkipped}>{plan.skipped.length} file{plan.skipped.length === 1 ? '' : 's'} left out {showSkipped ? '▴' : '▾'}</button>
          {#if showSkipped}
            <ul class="skipped">
              {#each plan.skipped.slice(0, 200) as s}<li><span class="mono">{s.path}</span> <span class="faint">{s.reason}</span></li>{/each}
              {#if plan.skipped.length > 200}<li class="faint">…and {plan.skipped.length - 200} more</li>{/if}
            </ul>
          {/if}
        {/if}
        {#if plan.outside}<p class="faint">{plan.outside} file{plan.outside === 1 ? '' : 's'} next to the theme's folder in the {source.toLowerCase().endsWith('.zip') ? 'zip' : 'folder'} {plan.outside === 1 ? 'is' : 'are'} left out.</p>{/if}
        <p class="faint">Only theme files are copied, and only when their contents match their type: XML, pictures, fonts, sounds, videos, shaders and text. Programs and scripts never are.</p>
      </div>
      <label class="name">
        <span>Name of the new theme folder</span>
        <input bind:value={name} spellcheck="false" />
      </label>
      {#if taken}<p class="warn">A theme with this name already exists. Pick another name.</p>{:else if badName}<p class="warn">Folder names can't be empty, start with a dot, end with a dot or space, or contain \ / : * ? " &lt; &gt; |</p>{/if}
    {/if}
    {#if error}<p class="warn">{error}</p>{/if}
</AppDialog>

<style>
  p {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
  }
  .pick {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
  }
  .src {
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .summary {
    display: grid;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
  }
  .summary > button {
    justify-self: start;
  }
  .skipped {
    margin: 0;
    padding: 0 0 0 4px;
    list-style: none;
    max-height: 180px;
    overflow: auto;
    font-size: 11px;
    display: grid;
    gap: 2px;
  }
  .name {
    display: grid;
    gap: 4px;
    font-size: 12px;
  }
  .warn {
    color: var(--warn);
  }
</style>
