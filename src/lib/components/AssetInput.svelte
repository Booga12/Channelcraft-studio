<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import { api, fileUrl } from '$lib/api';
  import { join } from '$lib/path';
  import { FONT_CATALOG } from '$lib/theme/fonts';

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

  const EXT: Record<string, string[]> = {
    image: ['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp'],
    font: ['ttf', 'otf'],
    sound: ['ogg', 'wav', 'mp3'],
    video: ['mp4', 'webm', 'mkv'],
  };

  async function importFile() {
    const file = await open({ title: `Import ${kind} into the theme`, filters: [{ name: kind, extensions: EXT[kind] }] });
    if (typeof file !== 'string') return;
    try {
      const abs = await ed.importAsset(file, kind);
      if (abs) onchange(toRelative(abs));
    } catch (e) {
      ed.notify(String(e), 'error');
    }
  }

  function pick(rel: string) {
    browsing = false;
    onchange(toRelative(join(ed.project!.dir, rel)));
  }

  // ---- fonts ----
  let fontTab = $state<'theme' | 'free' | 'pc'>('theme');
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
    <input class="mono" bind:value={text} spellcheck="false" onchange={() => onchange(text.trim())} onkeydown={(e) => e.key === 'Enter' && onchange(text.trim())} />
    <button class="small" onclick={() => (browsing = !browsing)} title="Choose a file from the theme">…</button>
  </div>
  {#if browsing}
    <div class="browser">
      <div class="bhead">
        <input placeholder="Filter {kind}s…" bind:value={filter} />
        <button class="small" onclick={importFile}>Import…</button>
      </div>
      {#if kind === 'font'}
        <div class="ftabs" role="tablist">
          <button class:on={fontTab === 'theme'} onclick={() => (fontTab = 'theme')}>In this theme</button>
          <button class:on={fontTab === 'free'} onclick={() => (fontTab = 'free')}>Free fonts</button>
          <button class:on={fontTab === 'pc'} onclick={() => ((fontTab = 'pc'), loadPcFonts())}>On this PC</button>
        </div>
      {/if}
      {#if kind === 'font' && fontTab === 'free'}
        <div class="items">
          {#each FONT_CATALOG.filter((f) => !filter || f.label.toLowerCase().includes(filter.toLowerCase())) as f (f.id)}
            <button class="item ghost font" onclick={() => pickCatalog(f.id)} disabled={busy}>
              <span>{f.label}</span>
              <small class="faint">{f.style}</small>
            </button>
          {/each}
          <p class="faint lic">Free fonts (Open Font License) from Google Fonts, downloaded into the theme when picked.</p>
        </div>
      {:else if kind === 'font' && fontTab === 'pc'}
        <div class="items">
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
          <p class="faint">No {kind} files in this theme.</p>
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
    background: repeating-conic-gradient(#2a2e36 0 25%, #353a44 0 50%) 0 0 / 8px 8px;
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
    background: repeating-conic-gradient(#20242b 0 25%, #2a2f38 0 50%) 0 0 / 10px 10px;
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
