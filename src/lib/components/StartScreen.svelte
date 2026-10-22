<script lang="ts">
  import { task } from '$lib/task.svelte';
  import { ask, open } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import { fileUrl, type ThemeInfo } from '$lib/api';
  import NewThemeDialog, { type StarterChoice } from './NewThemeDialog.svelte';
  import { fade } from 'svelte/transition';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import HouseIcon from '@lucide/svelte/icons/house';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import KeyboardIcon from '@lucide/svelte/icons/keyboard';
  import FolderIcon from '@lucide/svelte/icons/folder';
  import FolderInputIcon from '@lucide/svelte/icons/folder-input';
  import SparklesIcon from '@lucide/svelte/icons/sparkles';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
  import SearchIcon from '@lucide/svelte/icons/search';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Input } from '$lib/components/ui/input';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Spinner } from '$lib/components/ui/spinner';
  import AppDialog from './AppDialog.svelte';
  import ModeToggle from './editor/ModeToggle.svelte';
  import ImportThemeDialog from './ImportThemeDialog.svelte';

  let dialog = $state<{ mode: 'new' | 'duplicate'; source?: ThemeInfo } | null>(null);
  let filter = $state('');
  let choosing = $state<ThemeInfo | null>(null);
  let dontAsk = $state(false);
  let importing = $state(false);
  /** The theme being opened, which shows a spinner on its card. */
  let opening = $state<string | null>(null);

  function open_(path: string) {
    opening = path;
    ed.openTheme(path);
  }

  function openTheme(t: ThemeInfo) {
    if (ed.askCopy) choosing = t;
    else open_(t.path);
  }

  const QUICK = $derived([
    { title: 'Start a new theme', help: 'A design to start from, with every RetroBat data element placed', icon: SparklesIcon, tone: 'bg-gradient-to-br from-blue-500 to-violet-600', run: () => (dialog = { mode: 'new' }) },
    {
      title: 'Remix the theme you use',
      help: "Copy RetroBat's current theme and change the copy",
      icon: CopyIcon,
      tone: 'bg-gradient-to-br from-pink-500 to-orange-500',
      run: () => ed.themes[0] && (dialog = { mode: 'duplicate', source: ed.themes.find((t) => t.name.toLowerCase() === ed.root?.activeTheme?.toLowerCase()) ?? ed.themes[0] }),
    },
    { title: 'Import a theme', help: 'From a .zip or folder someone shared, checked first', icon: FolderInputIcon, tone: 'bg-gradient-to-br from-amber-500 to-rose-500', run: () => (importing = true) },
    { title: 'How it works', help: 'Four steps, two minutes', icon: CircleHelpIcon, tone: 'bg-gradient-to-br from-emerald-500 to-sky-500', run: () => (ed.showGuide = true) },
  ]);

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
    open_(t.path);
  }

  const shown = $derived(ed.themes.filter((t) => t.name.toLowerCase().includes(filter.trim().toLowerCase())));

  async function pickRoot() {
    const dir = await open({ directory: true, title: 'Choose your RetroBat folder (the one with RetroBat.exe)' });
    if (typeof dir === 'string') await ed.setRoot(dir);
  }

  async function created(path: string, starter?: StarterChoice) {
    dialog = null;
    if (starter) task.step('open');
    await ed.openTheme(path);
    if (!starter) return;
    if (ed.project?.dir !== path) return task.fail('The new theme was created but could not be opened. Pick it from Your themes to try again.');
    try {
      await ed.applyStarter(starter);
      task.finish();
    } catch (e) {
      task.fail(e);
    }
  }
</script>

{#if importing}
  <ImportThemeDialog
    onclose={() => (importing = false)}
    onimported={(path) => {
      importing = false;
      ed.openTheme(path);
    }}
  />
{/if}

<div class="ui-new flex h-screen overflow-hidden bg-[var(--canvas)]">
  <aside class="flex w-60 shrink-0 flex-col gap-4 border-r bg-card/60 p-4 backdrop-blur-xl">
    <div class="flex items-center gap-2.5 px-1">
      <div class="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-from to-brand-to text-sm font-bold text-white shadow-elev-2" aria-hidden="true">Cc</div>
      <div class="leading-tight">
        <div class="text-sm font-semibold">ChannelCraft Studio</div>
        <div class="text-xs text-muted-foreground">Theme editor for RetroBat</div>
      </div>
    </div>
    <Button class="shadow-elev-2" onclick={() => (dialog = { mode: 'new' })} disabled={!ed.root}><PlusIcon data-icon="inline-start" />New theme</Button>
    <nav class="flex flex-col gap-0.5">
      <Button variant="secondary" class="justify-start"><HouseIcon data-icon="inline-start" />Home</Button>
      <Button variant="ghost" class="justify-start text-muted-foreground" onclick={() => ed.refreshThemes()} disabled={!ed.root}><RefreshCwIcon data-icon="inline-start" />Refresh themes</Button>
      <Button variant="ghost" class="justify-start text-muted-foreground" onclick={() => (ed.showSettings = true)}><SettingsIcon data-icon="inline-start" />Settings</Button>
      <Button variant="ghost" class="justify-start text-muted-foreground" onclick={() => (ed.showShortcuts = true)}><KeyboardIcon data-icon="inline-start" />Keyboard shortcuts</Button>
    </nav>
    <div class="flex-1"></div>
    <ModeToggle side="top" />
    {#if ed.root}
      <div class="flex flex-col gap-2 rounded-xl bg-muted/60 p-3 ring-1 ring-foreground/5">
        <div class="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">RetroBat folder</div>
        <div class="truncate font-mono text-xs" title={ed.root.root}>{ed.root.root}</div>
        <Button variant="outline" size="sm" class="self-start" onclick={pickRoot}><FolderIcon data-icon="inline-start" />Change…</Button>
      </div>
    {/if}
  </aside>

  {#if !ed.root}
    <section class="grid flex-1 place-items-center p-8">
      <div class="flex max-w-md flex-col items-center gap-3 text-center">
        <div class="grid size-16 place-items-center rounded-2xl bg-muted text-muted-foreground shadow-elev-1"><FolderIcon class="size-8" /></div>
        <h2 class="m-0 text-xl font-semibold">Where is RetroBat installed?</h2>
        <p class="m-0 text-sm text-muted-foreground">Pick the folder that contains <span class="font-mono">RetroBat.exe</span>. Themes are read from its <span class="font-mono">emulationstation\.emulationstation\themes</span> folder.</p>
        <Button class="mt-2" onclick={pickRoot}>Choose RetroBat folder…</Button>
      </div>
    </section>
  {:else}
    <section class="min-w-0 flex-1 overflow-auto px-10 py-8">
      <div class="mx-auto flex max-w-6xl flex-col gap-8">
        <header class="flex flex-col gap-2">
          <h1 class="m-0 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-3xl font-bold tracking-tight text-transparent">Welcome to ChannelCraft Studio</h1>
          <p class="m-0 max-w-2xl text-sm text-muted-foreground">Change how RetroBat looks: colours, fonts, pictures and layouts, with a live preview. Nothing reaches RetroBat until you save, and a backup is made first.</p>
        </header>

        <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {#each QUICK as q (q.title)}
            <button
              class="group flex items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-elev-1 ring-1 ring-foreground/8 transition-all duration-200 ease-out-soft hover:-translate-y-0.5 hover:shadow-elev-3 disabled:pointer-events-none disabled:opacity-50"
              onclick={q.run}
              disabled={!ed.root}
            >
              <span class="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-elev-2 transition-transform duration-300 ease-spring group-hover:scale-110 group-hover:-rotate-6 {q.tone}"><q.icon class="size-5" /></span>
              <span class="flex min-w-0 flex-col gap-0.5">
                <strong class="text-sm font-semibold">{q.title}</strong>
                <small class="text-xs text-muted-foreground">{q.help}</small>
              </span>
            </button>
          {/each}
        </div>

        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <h2 class="m-0 flex items-center gap-2 text-lg font-semibold">Your themes <Badge variant="secondary">{ed.themes.length}</Badge></h2>
            <div class="flex-1"></div>
            <div class="relative w-64">
              <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input class="pl-8" placeholder="Find a theme…" bind:value={filter} />
            </div>
          </div>

          <div class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {#each shown as t (t.path)}
              {@const active = ed.root.activeTheme?.toLowerCase() === t.name.toLowerCase()}
              {@const busy = ed.loading && opening === t.path}
              <article class="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-elev-1 ring-1 ring-foreground/8 transition-all duration-200 ease-out-soft hover:-translate-y-0.5 hover:shadow-elev-3">
                <button class="thumb relative aspect-video overflow-hidden bg-black" onclick={() => openTheme(t)} title="Open {t.name}" disabled={ed.loading}>
                  {#if t.preview}
                    <img class="size-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]" src={fileUrl(t.preview)} alt="" loading="lazy" />
                  {:else}
                    <div class="grid size-full place-items-center bg-gradient-to-br from-muted to-muted/40 text-xs text-muted-foreground">No preview</div>
                  {/if}
                  {#if active}
                    <Badge class="absolute top-2 left-2 shadow-elev-2">Active in RetroBat</Badge>
                  {/if}
                  {#if busy}
                    <div class="absolute inset-0 grid place-items-center bg-black/50 backdrop-blur-sm" transition:fade={{ duration: 150 }}>
                      <span class="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-elev-2"><Spinner />Opening…</span>
                    </div>
                  {/if}
                </button>
                <div class="flex items-center gap-1 p-2.5 pl-3.5">
                  <div class="min-w-0 flex-1 truncate text-sm font-medium" title={t.name}>{t.name}</div>
                  <Button variant="ghost" size="icon-sm" class="text-muted-foreground hover:text-destructive" onclick={() => removeTheme(t)} title="Delete this theme (moves it to the Recycle Bin)" aria-label="Delete {t.name}"><Trash2Icon /></Button>
                  <Button variant="ghost" size="sm" onclick={() => (dialog = { mode: 'duplicate', source: t })} title="Copy this theme to a new folder and edit the copy">Duplicate</Button>
                  <Button size="sm" onclick={() => openTheme(t)} disabled={ed.loading}>Edit</Button>
                </div>
              </article>
            {/each}
          </div>
        </div>
      </div>
    </section>
  {/if}
</div>

{#if choosing}
  <AppDialog title={`Edit “${choosing.name}”`} description="Editing a copy keeps the original safe, so you can always switch back to it in RetroBat." onclose={() => (choosing = null)} class="sm:max-w-[460px]">
    {#snippet footer()}
      <label class="mr-auto flex items-center gap-2 self-center text-xs text-muted-foreground"><Checkbox bind:checked={dontAsk} />Don't ask again</label>
      <Button variant="ghost" onclick={() => (choosing = null)}>Cancel</Button>
    {/snippet}
    <div class="ui-new flex flex-col gap-2">
      <button class="opt flex flex-col items-start gap-0.5 rounded-xl bg-primary p-3.5 text-left text-primary-foreground shadow-elev-2 transition-all hover:-translate-y-px hover:shadow-elev-3" onclick={chooseCopy}>
        <strong class="text-sm">Make a copy and edit it</strong>
        <span class="text-xs opacity-80">Recommended</span>
      </button>
      <button class="opt flex flex-col items-start gap-0.5 rounded-xl bg-muted p-3.5 text-left ring-1 ring-foreground/8 transition-all hover:-translate-y-px hover:bg-muted/70" onclick={chooseOriginal}>
        <strong class="text-sm">Edit the original</strong>
        <span class="text-xs text-muted-foreground">A backup is still made before the first save</span>
      </button>
    </div>
  </AppDialog>
{/if}

{#if dialog}
  <NewThemeDialog mode={dialog.mode} source={dialog.source} oncreated={created} oncancel={() => (dialog = null)} />
{/if}
