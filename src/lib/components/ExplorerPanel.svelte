<script lang="ts">
  // The Explorer tab: look through any folder on the PC, or the theme's own folder, and copy
  // many files into the theme at once. Outside the theme it only looks; nothing there changes.
  import { onMount } from 'svelte';
  import { ed } from '$lib/editor.svelte';
  import { fileUrl, type ExplorerEntry } from '$lib/api';
  import {
    crumbsOf,
    explorer,
    folderOf,
    formatSize,
    inThemeKey,
    isInTheme,
    isKind,
    kindCounts,
    kindLine,
    KIND_LABEL,
    usedWhere,
    type ExplorerKind,
    type Filter,
  } from '$lib/explorer.svelte';
  import Icon from './Icon.svelte';

  const themeDir = $derived(ed.project?.dir ?? null);
  const inTheme = $derived(explorer.source === 'theme');
  const crumbs = $derived(crumbsOf(explorer.path, inTheme ? themeDir : null));
  const keys = $derived.by(() => {
    void ed.rev;
    return inThemeKey(ed.project?.assets ?? []);
  });
  const res = $derived(ed.themeRes ?? ed.res);
  const xml = $derived.by(() => {
    void ed.rev;
    return [...(ed.project?.files.values() ?? [])].map((f) => f.src);
  });
  let note = $state<string | null>(null);

  onMount(() => {
    // "This theme" follows the open theme; otherwise show the folder again, freshly listed.
    if (!explorer.themeChanged(themeDir)) void explorer.open(explorer.path, { push: false });
  });
  $effect(() => {
    explorer.themeChanged(themeDir);
  });
  /** Files a theme can't use, shown anyway in a folder that has nothing else. */
  let reveal = $state(false);
  $effect(() => {
    void explorer.path;
    reveal = false;
  });

  const searching = $derived(explorer.found !== null);
  const base = $derived(explorer.found ?? explorer.entries);
  const folders = $derived(searching ? [] : base.filter((e) => e.isDir));
  const usable = (e: ExplorerEntry) => !e.isDir && !e.problem;
  const hiddenCount = $derived(base.filter((e) => !e.isDir && e.problem).length);
  const used = (e: ExplorerEntry) => usedWhere(e.name, res, xml);
  const usedMap = $derived.by(() => (inTheme ? new Map(base.filter((e) => !e.isDir).map((e) => [e.path, used(e)])) : new Map<string, string[] | null>()));
  const counts = $derived(kindCounts(base.filter((e) => explorer.showAll || usable(e))));
  const files = $derived(
    base.filter((e) => {
      if (e.isDir) return false;
      if (!explorer.showAll && e.problem) return false;
      const f = explorer.filter;
      if (f === 'all') return true;
      if (f === 'used') return !!usedMap.get(e.path);
      if (f === 'unused') return !usedMap.get(e.path);
      return e.kind === f;
    }),
  );
  const can = (e: ExplorerEntry) => !inTheme && usable(e) && !isInTheme(e, keys);
  const selectable = $derived(files.filter(can));
  const selectedSize = $derived(explorer.selectedSize);
  const usableCount = $derived(files.filter(usable).length);

  const filters = $derived<{ id: Filter; label: string; n?: number }[]>([
    { id: 'all', label: 'All', n: counts.all },
    ...(Object.keys(KIND_LABEL) as ExplorerKind[]).filter((k) => counts[k]).map((k) => ({ id: k as Filter, label: KIND_LABEL[k], n: counts[k] })),
    ...(inTheme ? [{ id: 'used' as Filter, label: 'Used' }, { id: 'unused' as Filter, label: 'Not used' }] : []),
  ]);

  function meta(e: ExplorerEntry): string {
    if (e.problem) return e.problem;
    if (inTheme) {
      const w = usedMap.get(e.path);
      return w ? w.join(', ') : 'Not used yet';
    }
    return `${KIND_LABEL[e.kind as ExplorerKind]?.replace(/s$/, '') ?? 'File'} · ${formatSize(e.size)}`;
  }

  function onTile(e: ExplorerEntry, ev: MouseEvent | KeyboardEvent) {
    if (searching && ev instanceof MouseEvent && ev.detail === 2) return;
    explorer.click(e, files, { shift: ev.shiftKey }, can);
  }

  async function onFolderTick(e: ExplorerEntry) {
    note = await explorer.toggleFolder(e, (p) => !explorer.entries.some((x) => x.path === p && isInTheme(x, keys)));
  }

  async function add() {
    const dir = themeDir;
    if (!dir) return;
    await explorer.addToTheme(dir, (assets) => {
      // Another theme may have been opened while it copied: only refresh the one it went into.
      if (ed.project?.dir !== dir) return;
      ed.project.setAssets(assets);
      ed.rev++;
    });
  }

  // ---- thumbnails -------------------------------------------------------------------------
  /** Sets a video's or picture's file only once its tile scrolls into view. */
  function lazy(node: HTMLImageElement | HTMLVideoElement, src: string) {
    let current = src;
    const io = new IntersectionObserver((list) => {
      if (list.some((x) => x.isIntersecting)) {
        node.src = current;
        io.disconnect();
      }
    });
    io.observe(node);
    return {
      update(next: string) {
        current = next;
        if (node.src) node.src = next;
      },
      destroy: () => io.disconnect(),
    };
  }

  const fontFamilies = new Map<string, string>();
  function fontFamily(path: string) {
    let f = fontFamilies.get(path);
    if (!f) {
      f = `ccs-exp-${fontFamilies.size}`;
      fontFamilies.set(path, f);
      new FontFace(f, `url("${fileUrl(path)}")`)
        .load()
        .then((ff) => document.fonts.add(ff))
        .catch(() => {});
    }
    return f;
  }

  let audio: HTMLAudioElement | null = null;
  let playing = $state<string | null>(null);
  function toggleSound(e: ExplorerEntry) {
    audio?.pause();
    if (playing === e.path) return void (playing = null);
    audio = new Audio(fileUrl(e.path));
    audio.onended = () => (playing = null);
    audio.play().catch(() => (playing = null));
    playing = e.path;
  }
  $effect(() => () => audio?.pause());

  const placeGroups = $derived([
    { id: 'place', label: 'Quick places', items: explorer.places.filter((p) => p.group === 'place') },
    { id: 'drive', label: 'Drives', items: explorer.places.filter((p) => p.group === 'drive') },
    { id: 'retrobat', label: 'RetroBat', items: explorer.places.filter((p) => p.group === 'retrobat') },
  ]);
</script>

<div class="exp" data-explorer-drop>
  <div class="scroll">
    <div class="top">
      <div class="seg" role="radiogroup" aria-label="Where to look">
        <button role="radio" aria-checked={inTheme} class:on={inTheme} disabled={!themeDir || !!explorer.adding} title={explorer.adding ? 'Wait until the files are added' : themeDir ? 'Everything already inside this theme' : 'Open a theme first'} onclick={() => explorer.setSource('theme', themeDir)}>This theme</button>
        <button role="radio" aria-checked={!inTheme} class:on={!inTheme} disabled={!!explorer.adding && !inTheme} title="Any folder on your computer (it's only looked at; nothing there is changed)" onclick={() => explorer.setSource('pc', themeDir)}>My PC</button>
      </div>

      <div class="nav">
        <button class="ic" title="Back" aria-label="Back" disabled={!explorer.canGoBack} onclick={() => explorer.goBack()}><span aria-hidden="true">←</span></button>
        <button class="ic" title="Up one folder" aria-label="Up one folder" disabled={!explorer.path || (inTheme && crumbs.length <= 1)} onclick={() => explorer.up(themeDir)}><span aria-hidden="true">↑</span></button>
        <nav class="crumbs" aria-label="Folder path">
          {#each crumbs as c, i (i)}
            {#if i}<span class="sep" aria-hidden="true">›</span>{/if}
            <button class="crumb" class:last={i === crumbs.length - 1} onclick={() => explorer.open(c.path)} title={c.path ?? 'Quick places and drives'}>{c.label}</button>
          {/each}
        </nav>
      </div>

      {#if explorer.path}
        <input class="search" type="search" placeholder="Search this folder and the folders inside it" value={explorer.query} oninput={(e) => explorer.search(e.currentTarget.value)} aria-label="Search" />

        <div class="filters">
          <div class="chips" role="radiogroup" aria-label="Show">
            {#each filters as f (f.id)}
              <button role="radio" aria-checked={explorer.filter === f.id} class:on={explorer.filter === f.id} onclick={() => (explorer.filter = f.id)}>
                {f.label}{#if f.n !== undefined}<span class="n">{f.n}</span>{/if}
              </button>
            {/each}
          </div>
          <div class="viewctl">
            <button class="ic" class:on={explorer.view === 'grid'} title="Thumbnails" aria-label="Thumbnails" aria-pressed={explorer.view === 'grid'} onclick={() => explorer.setView('grid')}><Icon name="grid" size={14} /></button>
            <button class="ic" class:on={explorer.view === 'list'} title="List" aria-label="List" aria-pressed={explorer.view === 'list'} onclick={() => explorer.setView('list')}><Icon name="list" size={14} /></button>
            {#if explorer.view === 'grid'}
              <input type="range" min="84" max="200" step="4" value={explorer.thumb} aria-label="Thumbnail size" title="Thumbnail size" oninput={(e) => explorer.setThumb(e.currentTarget.valueAsNumber)} />
            {/if}
          </div>
        </div>
      {/if}
    </div>

    {#if explorer.error}
      <p class="msg warn">{explorer.error}</p>
    {/if}
    {#if note}
      <p class="msg">{note} <button class="link" onclick={() => (note = null)}>OK</button></p>
    {/if}

    {#if !explorer.path && !inTheme}
      <!-- The start of My PC: Windows' own folders, the drives, RetroBat, and recent folders. -->
      {#each placeGroups as g (g.id)}
        {#if g.items.length}
          <h5>{g.label}</h5>
          <div class="places">
            {#each g.items as p (p.path)}
              <button class="place {p.group}" onclick={() => explorer.open(p.path, { source: 'pc' })} title={p.path}>
                <span class="pic"><Icon name={p.group === 'drive' ? 'monitor' : 'folder'} size={15} /></span>
                <span class="txt"><b>{p.name}</b>{#if p.detail}<small>{p.detail}</small>{/if}</span>
              </button>
            {/each}
          </div>
        {/if}
      {/each}
      {#if explorer.recent.length}
        <h5>Recent folders</h5>
        <div class="places">
          {#each explorer.recent as r (r)}
            <button class="place recent" onclick={() => explorer.open(r, { source: 'pc' })} title={r}>
              <span class="pic"><Icon name="folder" size={15} /></span>
              <span class="txt"><b>{r.split(/[\\/]/).filter(Boolean).pop()}</b><small>{folderOf(r)}</small></span>
            </button>
          {/each}
        </div>
      {/if}
      <p class="tip">Tip: drop a folder from Windows Explorer onto this panel to open it here.</p>
    {:else if explorer.loading && !base.length}
      <p class="msg faint">Opening…</p>
    {:else}
      {#if explorer.truncated && !searching}
        <p class="msg warn"><b>Showing the first {explorer.entries.length.toLocaleString()} of {explorer.total.toLocaleString()} things here.</b> Use search or the filters to find the rest.</p>
      {/if}
      {#if searching}
        <p class="msg faint">{files.length ? `${files.length}${explorer.foundTruncated ? '+' : ''} found for “${explorer.query}”` : `Nothing found for “${explorer.query}”.`}{#if explorer.foundTruncated} Type more to narrow it down.{/if}</p>
      {/if}

      {#if folders.length}
        <h5>Folders <span class="n">{folders.length}</span></h5>
        <div class="folders">
          {#each folders as f (f.path)}
            <div class="folder" class:ticked={explorer.folderTicked(f)}>
              {#if !inTheme}
                <button class="ftick" role="checkbox" aria-checked={explorer.folderTicked(f)} title="Tick every file a theme can use in this folder (and the folders inside it)" aria-label="Tick everything in {f.name}" onclick={() => onFolderTick(f)}>{explorer.folderTicked(f) ? '✓' : ''}</button>
              {/if}
              <button class="fopen" onclick={() => explorer.open(f.path)} title="Open {f.name}">
                <span class="ficon" aria-hidden="true"></span>
                <span class="txt"><b>{f.name}</b><small>{f.items === null ? 'Can’t be opened' : f.items > 100 ? '100+ items' : `${f.items} item${f.items === 1 ? '' : 's'}`}</small></span>
              </button>
            </div>
          {/each}
        </div>
      {/if}

      {#if files.length || !folders.length}
        <div class="fileshead">
          <h5>Files <span class="n">{files.length}</span></h5>
          {#if !inTheme && selectable.length}
            <button class="link" onclick={() => explorer.selectAll(files, can)}>Select all {selectable.length}</button>
          {/if}
        </div>
      {/if}

      {#if !folders.length && !searching && (!files.length || (!usableCount && !reveal))}
        <div class="empty">
          <span class="ficon big" aria-hidden="true"></span>
          <b>{hiddenCount ? 'Nothing here a theme can use' : 'This folder is empty'}</b>
          {#if hiddenCount}
            <p>Themes can use pictures (PNG, JPG, GIF, SVG, WebP), videos (MP4, WebM, MKV…), sounds (WAV, OGG, MP3, FLAC) and fonts (TTF, OTF). This folder has {hiddenCount} other file{hiddenCount === 1 ? '' : 's'}, hidden here.</p>
          {/if}
          <div class="row">
            <button class="small" onclick={() => explorer.up(themeDir)}>Go up a folder</button>
            {#if hiddenCount}<button class="small" onclick={() => ((explorer.showAll = true), (reveal = true))}>Show hidden files</button>{/if}
          </div>
        </div>
      {:else if explorer.view === 'grid'}
        <div class="grid" style:--tile="{explorer.thumb}px">
          {#each files as e (e.path)}
            {@const on = explorer.selected.has(e.path)}
            {@const already = !inTheme && isInTheme(e, keys)}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex (focusable only when it is a checkbox) -->
            <div
              class="tile"
              class:on
              class:off={!!e.problem}
              role={inTheme ? 'listitem' : 'checkbox'}
              aria-checked={inTheme ? undefined : on}
              aria-disabled={!can(e) && !inTheme}
              tabindex={inTheme ? undefined : 0}
              title="{e.name}{e.problem ? `\n${e.problem}` : already ? '\nAlready in this theme' : ''}"
              onclick={(ev) => onTile(e, ev)}
              onkeydown={(ev) => ev.target === ev.currentTarget && (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onTile(e, ev))}
              onmouseenter={(ev) => e.kind === 'video' && (ev.currentTarget.querySelector('video') as HTMLVideoElement | null)?.play().catch(() => {})}
              onmouseleave={(ev) => e.kind === 'video' && (ev.currentTarget.querySelector('video') as HTMLVideoElement | null)?.pause()}
            >
              <div class="thumb {e.kind}">
                {#if e.kind === 'image'}
                  <img use:lazy={fileUrl(e.path)} alt="" draggable="false" />
                {:else if e.kind === 'video'}
                  <video use:lazy={`${fileUrl(e.path)}#t=0.5`} muted loop preload="metadata" draggable="false"></video>
                  <span class="mark">▶</span>
                {:else if e.kind === 'font'}
                  <span class="aa" style:font-family="{fontFamily(e.path)}, sans-serif">Aa</span>
                {:else if e.kind === 'sound'}
                  <button class="play" class:playing={playing === e.path} title={playing === e.path ? 'Stop' : 'Listen'} aria-label={playing === e.path ? 'Stop' : 'Listen'} onclick={(ev) => (ev.stopPropagation(), toggleSound(e))}>{playing === e.path ? '■' : '♪'}</button>
                {:else}
                  <span class="mark dim">?</span>
                {/if}
                {#if !inTheme && can(e)}
                  <span class="check" class:on aria-hidden="true">{on ? '✓' : ''}</span>
                {/if}
                {#if already}<span class="tag">In theme</span>{/if}
                {#if inTheme && !e.problem}<span class="tag" class:good={!!usedMap.get(e.path)}>{usedMap.get(e.path) ? 'Used' : 'Not used'}</span>{/if}
              </div>
              <span class="name">{e.name}</span>
              <span class="meta">{meta(e)}</span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="list" role="list">
          {#each files as e (e.path)}
            {@const on = explorer.selected.has(e.path)}
            {@const already = !inTheme && isInTheme(e, keys)}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex (focusable only when it is a checkbox) -->
            <div
              class="lrow"
              class:on
              class:off={!!e.problem}
              role={inTheme ? 'listitem' : 'checkbox'}
              aria-checked={inTheme ? undefined : on}
              tabindex={inTheme ? undefined : 0}
              title={e.problem ?? e.path}
              onclick={(ev) => onTile(e, ev)}
              onkeydown={(ev) => ev.target === ev.currentTarget && (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onTile(e, ev))}
            >
              {#if !inTheme}<span class="check" class:on class:hide={!can(e)} aria-hidden="true">{on ? '✓' : ''}</span>{/if}
              <span class="lkind"><Icon name={e.kind === 'image' ? 'image' : e.kind === 'video' ? 'video' : e.kind === 'sound' ? 'sound' : e.kind === 'font' ? 'font' : 'file'} size={14} /></span>
              <span class="lname">{e.name}{#if searching}<small>{folderOf(e.path)}</small>{/if}</span>
              <span class="lmeta">{already ? 'In theme' : meta(e)}</span>
            </div>
          {/each}
        </div>
      {/if}

      {#if hiddenCount && (files.length || folders.length)}
        <button class="link more" onclick={() => (explorer.showAll = !explorer.showAll)}>{explorer.showAll ? 'Hide files a theme can’t use' : `Show ${hiddenCount} file${hiddenCount === 1 ? '' : 's'} a theme can’t use`}</button>
      {/if}
      {#if inTheme}
        <p class="msg faint">These files are already part of your theme. Each one says where it’s used, so you can spot leftovers.</p>
      {/if}
    {/if}
  </div>

  {#if !inTheme && (explorer.selected.size || explorer.adding || explorer.summary)}
    <div class="bar">
      {#if explorer.adding}
        <div class="prog">
          <div class="row"><b>Adding {explorer.adding.total} file{explorer.adding.total === 1 ? '' : 's'} to the theme…</b><span class="faint">{explorer.adding.done} of {explorer.adding.total}</span></div>
          <div class="track"><div class="fill" style:width="{(explorer.adding.done / explorer.adding.total) * 100}%"></div></div>
          <div class="row"><span class="faint">You can keep working while it copies.</span><button class="small" onclick={() => explorer.stop()}>Stop</button></div>
        </div>
      {:else if explorer.summary}
        {@const s = explorer.summary}
        <div class="done" class:bad={!s.added && s.problems.length}>
          <b>{s.added ? `✓  ${s.added} file${s.added === 1 ? '' : 's'} added to the theme` : 'Nothing new was added'}{s.stopped ? ' (stopped)' : ''}</b>
          {#if s.added}<span>{kindLine(s.byKind)}</span>{/if}
          {#if s.existing}<span>{s.existing} {s.existing === 1 ? 'was' : 'were'} already in the theme, so {s.existing === 1 ? 'it was' : 'they were'} skipped.</span>{/if}
          {#each s.problems.slice(0, 4) as p (p)}<span class="prob">{p}</span>{/each}
          {#if s.problems.length > 4}<span class="prob">…and {s.problems.length - 4} more.</span>{/if}
          <div class="row end">
            <button class="small" onclick={() => (explorer.summary = null)}>Close</button>
            {#if s.added}<button class="small primary" onclick={() => ((explorer.summary = null), explorer.setSource('theme', themeDir))}>See them in This theme</button>{/if}
          </div>
        </div>
      {/if}
      {#if explorer.selected.size && !explorer.adding}
        <div class="row">
          <b>{explorer.selected.size} selected</b>
          {#if selectedSize}<span class="faint">· {formatSize(selectedSize)}</span>{/if}
          <span class="grow"></span>
          <button class="small" onclick={() => explorer.clear()}>Clear</button>
          <button class="small primary" disabled={!themeDir} onclick={add}>Add {explorer.selected.size} to theme</button>
        </div>
        <p class="faint fine">Pictures go into the theme’s pictures folder, videos into videos, and so on. Nothing on your PC is changed or moved.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .exp {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 8px 10px 14px;
  }
  .top {
    display: grid;
    gap: 8px;
    margin-bottom: 8px;
  }
  .seg {
    display: inline-flex;
    justify-self: start;
    gap: 2px;
    padding: 3px;
    border-radius: 8px;
    background: var(--bg);
    border: 1px solid var(--line);
  }
  .seg button {
    border: 0;
    background: transparent;
    padding: 4px 14px;
    border-radius: 6px;
    font-weight: 600;
    color: var(--text-dim);
  }
  .seg button.on {
    background: var(--panel);
    color: var(--text);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.12);
  }
  .nav {
    display: flex;
    gap: 5px;
    align-items: center;
    min-width: 0;
  }
  .ic {
    display: inline-grid;
    place-items: center;
    min-width: 26px;
    height: 26px;
    padding: 0 6px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: transparent;
    color: var(--text-dim);
  }
  .ic.on {
    border-color: var(--brand);
    color: var(--brand);
    background: var(--brand-soft);
  }
  .crumbs {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px 6px;
    border-radius: 6px;
    background: var(--bg);
    overflow-x: auto;
    white-space: nowrap;
    scrollbar-width: none;
  }
  .crumb {
    border: 0;
    background: transparent;
    padding: 3px 4px;
    color: var(--text-dim);
    font-weight: 500;
  }
  .crumb:hover {
    color: var(--text);
  }
  .crumb.last {
    color: var(--text);
    font-weight: 600;
  }
  .sep {
    color: var(--text-faint);
  }
  .search {
    width: 100%;
  }
  .filters {
    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .chips {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .chips button {
    background: transparent;
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    padding: 1px 9px;
    font-size: 11px;
    color: var(--text-dim);
  }
  .chips button.on {
    background: var(--brand-soft);
    border-color: var(--brand);
    color: var(--text);
  }
  .n {
    margin-left: 4px;
    color: var(--text-faint);
    font-weight: 400;
  }
  .viewctl {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .viewctl input[type='range'] {
    width: 70px;
  }
  h5 {
    margin: 12px 2px 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-dim);
  }
  .fileshead {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .link {
    border: 0;
    background: transparent;
    padding: 0;
    color: var(--brand);
    font-weight: 600;
    cursor: pointer;
  }
  .more {
    margin: 10px 2px 0;
    font-size: 11px;
  }
  .msg {
    margin: 6px 2px;
    font-size: 11.5px;
    color: var(--text-dim);
  }
  .msg.warn {
    color: var(--warn);
  }
  .tip {
    margin: 14px 2px 0;
    font-size: 11px;
    color: var(--text-faint);
  }
  .places {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 6px;
  }
  .place,
  .fopen {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
    text-align: left;
    min-width: 0;
    width: 100%;
  }
  .place:hover,
  .fopen:hover,
  .place:focus-visible,
  .fopen:focus-visible {
    border-color: var(--brand);
  }
  .pic {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 5px;
    color: var(--text-dim);
    flex: none;
  }
  .place.drive .pic {
    color: #3b82f6;
  }
  .place.retrobat .pic {
    color: #ec4899;
  }
  .place.recent .pic {
    color: #d97706;
  }
  .txt {
    display: grid;
    min-width: 0;
  }
  .txt b,
  .txt small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .txt small {
    color: var(--text-faint);
    font-size: 10.5px;
  }
  .folders {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 6px;
  }
  .folder {
    position: relative;
    display: flex;
    min-width: 0;
  }
  .folder .fopen {
    padding-left: 30px;
  }
  .folder.ticked .fopen {
    border-color: var(--brand);
    background: var(--brand-soft);
  }
  .ftick {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
  }
  .ficon {
    width: 20px;
    height: 15px;
    border-radius: 3px;
    background: #fbbf24;
    flex: none;
  }
  .ficon.big {
    width: 34px;
    height: 26px;
    background: #fde68a;
  }
  .ftick,
  .check {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 0;
    line-height: 1;
  }
  .folder.ticked .ftick,
  .check.on {
    background: var(--brand);
    border-color: var(--brand);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--tile, 118px), 1fr));
    gap: 8px;
  }
  .tile {
    display: grid;
    gap: 3px;
    padding: 5px 5px 7px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
    cursor: pointer;
    user-select: none;
    min-width: 0;
  }
  .tile:hover {
    border-color: var(--brand);
  }
  .tile:focus-visible,
  .lrow:focus-visible,
  .place:focus-visible,
  .fopen:focus-visible,
  .ftick:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .tile.on {
    border: 2px solid var(--brand);
    padding: 4px 4px 6px;
    background: var(--brand-soft);
  }
  .tile.off,
  .lrow.off {
    opacity: 0.45;
    cursor: default;
  }
  .thumb {
    position: relative;
    aspect-ratio: 3 / 2;
    border-radius: 5px;
    overflow: hidden;
    display: grid;
    place-items: center;
    background: repeating-conic-gradient(var(--checker-a) 0 25%, var(--checker-b) 0 50%) 0 0 / 10px 10px;
  }
  .thumb.video,
  .thumb.sound,
  .thumb.font,
  .thumb.other {
    background: #3f3f46;
  }
  .thumb img,
  .thumb video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .thumb .check {
    position: absolute;
    left: 5px;
    top: 5px;
  }
  .mark {
    position: absolute;
    color: #fff;
    font-size: 16px;
    text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
  }
  .mark.dim {
    color: #a1a1aa;
  }
  .aa {
    color: #fff;
    font-size: 26px;
  }
  .play {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 0;
    background: rgb(255 255 255 / 0.15);
    color: #fff;
    font-size: 16px;
  }
  .play.playing {
    background: var(--brand);
  }
  .tag {
    position: absolute;
    right: 4px;
    bottom: 4px;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgb(24 24 27 / 0.72);
    color: #fff;
    font-size: 9.5px;
    font-weight: 600;
  }
  .tag.good {
    background: rgb(22 163 74 / 0.9);
  }
  .name,
  .meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name {
    font-weight: 500;
  }
  .meta {
    font-size: 10px;
    color: var(--text-faint);
  }
  .list {
    display: grid;
  }
  .lrow {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    gap: 8px;
    align-items: center;
    padding: 5px 6px;
    border-radius: 6px;
    cursor: pointer;
  }
  .lrow:hover {
    background: var(--bg);
  }
  .lrow.on {
    background: var(--brand-soft);
  }
  .check.hide {
    visibility: hidden;
  }
  .lkind {
    color: var(--text-dim);
    display: grid;
  }
  .lname {
    display: grid;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lname small {
    color: var(--text-faint);
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lmeta {
    color: var(--text-faint);
    font-size: 10.5px;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty {
    display: grid;
    justify-items: center;
    gap: 8px;
    text-align: center;
    padding: 26px 18px;
    border: 1px dashed var(--line-strong);
    border-radius: 10px;
    color: var(--text-dim);
  }
  .empty p {
    margin: 0;
    font-size: 11.5px;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .row.end {
    justify-content: flex-end;
  }
  .grow {
    flex: 1;
  }
  .bar {
    display: grid;
    gap: 8px;
    padding: 10px 12px 12px;
    border-top: 1px solid var(--line);
    background: var(--bg);
  }
  .fine {
    margin: 0;
    font-size: 10.5px;
  }
  .prog {
    display: grid;
    gap: 7px;
  }
  .prog .row {
    justify-content: space-between;
  }
  .track {
    height: 6px;
    border-radius: 3px;
    background: var(--line);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--brand);
    transition: width var(--dur, 200ms) var(--ease-out, ease-out);
  }
  .done {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--ok) 14%, transparent);
    color: var(--text);
    font-size: 11.5px;
  }
  .done.bad {
    background: color-mix(in srgb, var(--warn) 14%, transparent);
  }
  .prob {
    color: var(--warn);
  }
  .faint {
    color: var(--text-faint);
  }
</style>
