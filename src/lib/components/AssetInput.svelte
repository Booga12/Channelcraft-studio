<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import { api, fileUrl } from '$lib/api';
  import { join } from '$lib/path';
  import { FONT_CATALOG } from '$lib/theme/fonts';
  import { APP_SOUNDS, appSoundUrl } from '$lib/theme/appSounds';
  import { ASSET_KIND_LABEL, extensionsOf } from '$lib/theme/assetDrop';
  import { basename } from '$lib/path';

  let {
    value,
    kind,
    resolved,
    toRelative,
    onchange,
  }: {
    value: string;
    kind: 'image' | 'font' | 'sound' | 'video';
    /** Absolute path the current value points to, if it exists. */
    resolved: string | null;
    /** Converts an absolute path into the value to store. */
    toRelative: (abs: string) => string;
    onchange: (v: string) => void;
  } = $props();

  let text = $state('');
  let browsing = $state(false);
  let filter = $state('');
  $effect(() => {
    text = value;
  });

  const assets = $derived.by(() => {
    ed.rev;
    const p = ed.project;
    if (!p) return [];
    const want = kind;
    const q = filter.trim().toLowerCase();
    return p.assets.filter((a) => a.kind === want && (!q || a.rel.toLowerCase().includes(q))).slice(0, 400);
  });


  const what = $derived(ASSET_KIND_LABEL[kind]);

  /** A file from the PC: copied into the theme and used, and kept in Assets for next time. */
  async function importFile() {
    const file = await open({ title: `Choose a ${what} from your computer`, filters: [{ name: what, extensions: extensionsOf(kind) }] });
    if (typeof file !== 'string') return;
    busy = true;
    try {
      const abs = await ed.importAsset(file, kind);
      if (abs) {
        browsing = false;
        onchange(toRelative(abs));
        await ed.addToLibrary([file], true);
      }
    } catch (e) {
      ed.notify(String(e), 'error');
    } finally {
      busy = false;
    }
  }

  // ---- keyboard: Escape closes the list (back to the … button); arrows move between the tabs ----
  let browseBtn = $state<HTMLButtonElement | null>(null);
  const closeOnEscape = (node: HTMLElement) => {
    const onkey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      browsing = false;
      browseBtn?.focus();
    };
    node.addEventListener('keydown', onkey);
    return () => node.removeEventListener('keydown', onkey);
  };
  /** Escape on the … button itself (where focus is right after opening) closes the list too. */
  function browseKey(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !browsing) return;
    e.preventDefault();
    e.stopPropagation();
    browsing = false;
  }
  type Tab = 'assets' | 'theme' | 'free' | 'pc';
  function selectTab(t: Tab) {
    fontTab = t;
    if (t === 'free') loadGoogle();
    if (t === 'pc') loadPcFonts();
  }
  function tabKey(e: KeyboardEvent) {
    const ids: Tab[] = kind === 'font' ? ['assets', 'theme', 'free', 'pc'] : ['assets', 'theme'];
    const n = ids.length;
    const i = Math.max(0, ids.indexOf(fontTab));
    const next = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    e.stopPropagation();
    selectTab(ids[next]);
    (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }

  // ---- your Assets (and the app's own sounds) ----
  function toggleBrowse() {
    browsing = !browsing;
    if (browsing && !ed.libraryLoaded) ed.loadLibrary();
  }
  const library = $derived.by(() => {
    const q = filter.trim().toLowerCase();
    return ed.library.filter((a) => a.kind === kind && (!q || a.rel.toLowerCase().includes(q)));
  });
  const appSounds = $derived.by(() => {
    if (kind !== 'sound') return [];
    const q = filter.trim().toLowerCase();
    return APP_SOUNDS.filter((s) => !q || s.preset.label.toLowerCase().includes(q));
  });

  /** Copies a file from Assets (or writes one of the app's sounds) into the theme, and uses it. */
  async function pickLibrary(path: string) {
    busy = true;
    try {
      const abs = await ed.importAsset(path, kind);
      if (abs) {
        browsing = false;
        onchange(toRelative(abs));
      }
    } catch (e) {
      ed.notify(String(e), 'error');
    } finally {
      busy = false;
    }
  }

  let playing = $state<string | null>(null);
  let audio: HTMLAudioElement | null = null;
  function listen(key: string, url: string) {
    audio?.pause();
    if (playing === key) {
      playing = null;
      return;
    }
    audio = new Audio(url);
    audio.onended = () => (playing = null);
    audio.play().catch(() => (playing = null));
    playing = key;
  }
  function stopListening() {
    audio?.pause();
    audio = null;
    playing = null;
  }
  // A sound playing from the list stops when the list closes (or the field goes away).
  $effect(() => {
    if (!browsing) stopListening();
  });
  $effect(() => () => audio?.pause());

  function pick(rel: string) {
    browsing = false;
    onchange(toRelative(join(ed.project!.dir, rel)));
  }

  // ---- fonts ----
  /** Where the list comes from: your Assets first, then the theme (and for fonts, free and PC fonts). */
  let fontTab = $state<Tab>('assets');
  let pcFonts = $state<{ name: string; path: string; source: string }[]>([]);
  let busy = $state(false);

  async function loadPcFonts() {
    if (pcFonts.length) return;
    try {
      pcFonts = (await api.listFonts()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      ed.notify(String(e), 'error');
    }
  }

  async function pickCatalog(id: string) {
    busy = true;
    const rel = await ed.ensureFont(id);
    busy = false;
    if (rel) pick(rel);
    else ed.notify('That font could not be downloaded. Check the internet connection.', 'error');
  }

  // The whole Google Fonts library, searched by name (loaded the first time the tab is opened).
  let google = $state<{ family: string; category: string }[]>([]);
  let googleState = $state<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  async function loadGoogle() {
    if (googleState !== 'idle') return;
    googleState = 'loading';
    try {
      google = await api.googleFonts();
      googleState = 'ready';
    } catch {
      googleState = 'failed';
    }
  }
  const googleMatches = $derived.by(() => {
    const q = filter.trim().toLowerCase();
    if (q.length < 2) return [];
    const own = new Set(FONT_CATALOG.map((f) => f.label.toLowerCase()));
    return google.filter((f) => f.family.toLowerCase().includes(q) && !own.has(f.family.toLowerCase())).slice(0, 40);
  });
  async function pickGoogle(family: string) {
    busy = true;
    try {
      pick(await ed.ensureGoogleFont(family));
    } catch (e) {
      ed.notify(String(e), 'error');
    } finally {
      busy = false;
    }
  }

  async function pickPc(path: string) {
    busy = true;
    try {
      const rel = await api.addFontToTheme(ed.project!.dir, path);
      ed.project!.setAssets(await api.listThemeFiles(ed.project!.dir));
      pick(rel);
    } catch (e) {
      ed.notify(String(e), 'error');
    } finally {
      busy = false;
    }
  }
</script>

<div class="asset">
  <div class="line">
    {#if kind === 'image' && resolved}
      <img class="thumb" src={fileUrl(resolved)} alt="" />
    {:else if value && !resolved && !value.includes('{') && !value.includes('$')}
      <span class="badge warn" title="File not found in the theme">missing</span>
    {/if}
    <input class="mono" aria-label="Path of the {what}" bind:value={text} spellcheck="false" onchange={() => onchange(text.trim())} onkeydown={(e) => e.key === 'Enter' && onchange(text.trim())} />
    <button class="small" bind:this={browseBtn} onclick={toggleBrowse} onkeydown={browseKey} aria-label="Choose a {what} from your Assets or the theme" aria-expanded={browsing} title="Choose a {what} from your Assets or the theme">…</button>
  </div>
  {#if browsing}
    <div class="browser" {@attach closeOnEscape}>
      <div class="bhead">
        <input placeholder="Filter {what}s…" aria-label="Filter {what}s" bind:value={filter} />
        <button class="small" onclick={importFile} disabled={busy} title="Pick a file on your PC. It's added to your Assets too.">From my computer…</button>
      </div>
      <div class="ftabs" role="tablist" aria-label="Where to choose from">
        <button class:on={fontTab === 'assets'} role="tab" aria-selected={fontTab === 'assets'} tabindex={fontTab === 'assets' ? 0 : -1} onkeydown={tabKey} onclick={() => selectTab('assets')}>Your Assets</button>
        <button class:on={fontTab === 'theme'} role="tab" aria-selected={fontTab === 'theme'} tabindex={fontTab === 'theme' ? 0 : -1} onkeydown={tabKey} onclick={() => selectTab('theme')}>In this theme</button>
        {#if kind === 'font'}
          <button class:on={fontTab === 'free'} role="tab" aria-selected={fontTab === 'free'} tabindex={fontTab === 'free' ? 0 : -1} onkeydown={tabKey} onclick={() => selectTab('free')}>Free fonts</button>
          <button class:on={fontTab === 'pc'} role="tab" aria-selected={fontTab === 'pc'} tabindex={fontTab === 'pc' ? 0 : -1} onkeydown={tabKey} onclick={() => selectTab('pc')}>On this PC</button>
        {/if}
      </div>
      {#if fontTab === 'assets'}
        <div class="items" class:imgs={kind === 'image'}>
          {#each library as a (a.path)}
            {#if kind === 'sound'}
              <div class="srow">
                <button class="small ghost" onclick={() => listen(a.path, fileUrl(a.path))} aria-label="{playing === a.path ? 'Stop' : 'Listen to'} {basename(a.rel)}" title={playing === a.path ? 'Stop' : 'Listen'}>{playing === a.path ? '■' : '▶'}</button>
                <button class="item ghost" onclick={() => pickLibrary(a.path)} disabled={busy} title={a.rel}><span>{basename(a.rel)}</span></button>
              </div>
            {:else}
              <button class="item ghost" onclick={() => pickLibrary(a.path)} disabled={busy} title={a.rel}>
                {#if kind === 'image'}
                  <img src={fileUrl(a.path)} alt="" loading="lazy" />
                {/if}
                <span>{basename(a.rel)}</span>
              </button>
            {/if}
          {:else}
            <p class="faint">{filter.trim() ? `No ${what}s in your Assets match.` : `No ${what}s in your Assets yet. Use From my computer…, or add some in Assets.`}</p>
          {/each}
          {#if appSounds.length}
            <p class="faint gtitle">Made by the app</p>
            {#each appSounds as s (s.path)}
              <div class="srow">
                <button class="small ghost" onclick={() => listen(s.path, appSoundUrl(s))} aria-label="{playing === s.path ? 'Stop' : 'Listen to'} {s.preset.label}" title={playing === s.path ? 'Stop' : 'Listen'}>{playing === s.path ? '■' : '▶'}</button>
                <button class="item ghost" onclick={() => pickLibrary(s.path)} disabled={busy} title={s.preset.help}><span>{s.preset.label}</span><small class="faint">{s.group === 'music' ? 'song' : 'scroll sound'}</small></button>
              </div>
            {/each}
          {/if}
        </div>
      {:else if kind === 'font' && fontTab === 'free'}
        <div class="items">
          {#each FONT_CATALOG.filter((f) => !filter || f.label.toLowerCase().includes(filter.toLowerCase())) as f (f.id)}
            <button class="item ghost font" onclick={() => pickCatalog(f.id)} disabled={busy}>
              <span>{f.label}</span>
              <small class="faint">{f.style}</small>
            </button>
          {/each}
          {#if filter.trim().length >= 2}
            <p class="faint gtitle">All of Google Fonts{googleState === 'loading' ? ' (loading…)' : googleState === 'failed' ? ' (could not be reached: offline?)' : ''}</p>
            {#each googleMatches as f (f.family)}
              <button class="item ghost font" onclick={() => pickGoogle(f.family)} disabled={busy}>
                <span>{f.family}</span>
                <small class="faint">{f.category.toLowerCase()}</small>
              </button>
            {:else}
              {#if googleState === 'ready'}<p class="faint">No other Google Fonts match “{filter.trim()}”.</p>{/if}
            {/each}
          {:else if googleState === 'ready'}
            <p class="faint gtitle">Type a name to search all {google.length.toLocaleString()} Google Fonts.</p>
          {/if}
          <p class="faint lic">Free fonts (Open Font License) from Google Fonts, downloaded into the theme when picked, with their licence file next to them so the theme can be shared.</p>
        </div>
      {:else if kind === 'font' && fontTab === 'pc'}
        <div class="items">
          <p class="faint lic">Fonts that come with Windows or other programs are often not allowed to be shared. They're fine for your own theme; pick a free font instead if you'll share it.</p>
          {#each pcFonts.filter((f) => !filter || f.name.toLowerCase().includes(filter.toLowerCase())).slice(0, 300) as f (f.path)}
            <button class="item ghost font" onclick={() => pickPc(f.path)} disabled={busy}>
              <span>{f.name}</span>
              <small class="faint">{f.source}</small>
            </button>
          {:else}
            <p class="faint">{pcFonts.length ? 'No fonts match.' : 'Looking for fonts…'}</p>
          {/each}
          <p class="faint lic">The font file is copied into the theme. Check a font's licence before sharing your theme.</p>
        </div>
      {:else}
      <div class="items" class:imgs={kind === 'image'}>
        {#each assets as a (a.rel)}
          <button class="item ghost" onclick={() => pick(a.rel)} title={a.rel}>
            {#if kind === 'image'}
              <img src={fileUrl(join(ed.project!.dir, a.rel))} alt="" loading="lazy" />
            {/if}
            <span class="mono">{a.rel}</span>
          </button>
        {:else}
          <p class="faint">No {what} files in this theme.</p>
        {/each}
      </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .asset {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .line {
    display: flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }
  .line input {
    flex: 1;
    min-width: 0;
  }
  .thumb {
    width: 34px;
    height: 24px;
    object-fit: contain;
    background: repeating-conic-gradient(var(--checker-a) 0 25%, var(--checker-b) 0 50%) 0 0 / 8px 8px;
    border-radius: 4px;
    flex: none;
  }
  .browser {
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--bg);
    padding: 6px;
  }
  .bhead {
    display: flex;
    gap: 6px;
    margin-bottom: 6px;
  }
  .bhead input {
    flex: 1;
  }
  .items {
    max-height: 240px;
    overflow: auto;
    display: grid;
    gap: 2px;
  }
  .items.imgs {
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 6px;
  }
  .item {
    display: grid;
    gap: 3px;
    text-align: left;
    padding: 4px;
    min-width: 0;
  }
  .item img {
    width: 100%;
    height: 54px;
    object-fit: contain;
    background: repeating-conic-gradient(var(--checker-a) 0 25%, var(--checker-b) 0 50%) 0 0 / 10px 10px;
    border-radius: 4px;
  }
  .ftabs {
    display: flex;
    gap: 2px;
    margin-bottom: 6px;
  }
  .ftabs button {
    flex: 1;
    background: transparent;
    padding: 3px 4px;
    font-size: 11px;
    color: var(--text-faint);
  }
  .ftabs button.on {
    background: var(--raised);
    color: var(--text);
  }
  .srow {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 4px;
    align-items: center;
  }
  .srow .item {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .item.font {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .lic {
    font-size: 10.5px;
    margin: 6px 2px 0;
  }
  .item span {
    font-size: 10.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
