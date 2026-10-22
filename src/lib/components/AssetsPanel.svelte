<script lang="ts">
  // The user's own asset library. Drag a file onto an element (preview, Layers or a property row)
  // to copy it into the theme and link it there.
  import { onMount } from 'svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { ed } from '$lib/editor.svelte';
  import { api, fileUrl, type LibraryAsset } from '$lib/api';
  import { assetDrag } from '$lib/assetDrag.svelte';
  import { ASSET_KIND_LABEL, dropFit, type AssetKind } from '$lib/theme/assetDrop';
  import { basename } from '$lib/path';
  import { elementLabel } from '$lib/friendly';
  import Icon from './Icon.svelte';
  import ContextMenu, { type MenuItem } from './ContextMenu.svelte';

  type Filter = 'all' | AssetKind;
  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'image', label: 'Pictures' },
    { id: 'video', label: 'Videos' },
    { id: 'sound', label: 'Sounds' },
    { id: 'font', label: 'Fonts' },
  ];

  let filter = $state<Filter>('all');
  let query = $state('');

  onMount(() => {
    if (!ed.libraryLoaded) ed.loadLibrary();
  });

  const counts = $derived.by(() => {
    const c: Record<string, number> = { all: ed.library.length };
    for (const a of ed.library) c[a.kind] = (c[a.kind] ?? 0) + 1;
    return c;
  });
  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return ed.library.filter((a) => (filter === 'all' || a.kind === filter) && (!q || a.rel.toLowerCase().includes(q)));
  });

  async function addFiles() {
    const picked = await open({
      title: 'Add files to your Assets',
      multiple: true,
      filters: [
        { name: 'Pictures, videos, sounds and fonts', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'mpg', 'mpeg', 'wav', 'ogg', 'mp3', 'flac', 'ttf', 'otf'] },
      ],
    });
    const paths = Array.isArray(picked) ? picked : typeof picked === 'string' ? [picked] : [];
    await ed.addToLibrary(paths);
  }

  async function openFolder() {
    try {
      const dir = await api.assetLibraryDir();
      // Shows the library folder itself, selected in its parent.
      await revealItemInDir(dir);
    } catch (e) {
      ed.notify(String(e), 'error');
    }
  }

  // ---- dragging a tile ----
  function down(e: PointerEvent, a: LibraryAsset) {
    if (e.button !== 0) return;
    const tile = e.currentTarget as HTMLElement;
    const sx = e.clientX;
    const sy = e.clientY;
    let started = false;
    const move = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
        started = true;
        tile.setPointerCapture(ev.pointerId);
        assetDrag.start({ path: a.path, kind: a.kind, name: basename(a.path) });
      }
      assetDrag.move(ev.clientX, ev.clientY);
    };
    const key = (ev: KeyboardEvent) => ev.key === 'Escape' && (assetDrag.cancel(), stop());
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', key);
    };
    const up = () => {
      stop();
      if (started && assetDrag.item) assetDrag.drop();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('keydown', key);
  }

  /** The selected element and the property this asset would set on it. */
  function onSelected(a: LibraryAsset) {
    const el = ed.selectedElement;
    if (!el) return null;
    return { el, fit: dropFit(el.type, el.name, a.kind) };
  }

  function useOnSelected(a: LibraryAsset) {
    const s = onSelected(a);
    if (!s) return ed.notify('Select an element first, or drag the file onto one.');
    ed.linkAsset(a.path, a.kind, s.el.name);
  }

  // ---- previews ----
  let playing = $state<string | null>(null);
  let audio: HTMLAudioElement | null = null;
  function toggleSound(a: LibraryAsset) {
    audio?.pause();
    if (playing === a.path) {
      playing = null;
      return;
    }
    audio = new Audio(fileUrl(a.path));
    audio.onended = () => (playing = null);
    audio.play().catch(() => (playing = null));
    playing = a.path;
  }
  $effect(() => () => audio?.pause());

  const fontFamilies = new Map<string, string>();
  function fontFamily(path: string) {
    let f = fontFamilies.get(path);
    if (!f) {
      f = `ccs-lib-${fontFamilies.size}`;
      fontFamilies.set(path, f);
      new FontFace(f, `url("${fileUrl(path)}")`)
        .load()
        .then((ff) => document.fonts.add(ff))
        .catch(() => {});
    }
    return f;
  }

  const size = (n: number) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  let menu = $state<{ x: number; y: number; a: LibraryAsset } | null>(null);
  const menuItems = $derived.by<MenuItem[]>(() => {
    if (!menu) return [];
    const a = menu.a;
    const s = onSelected(a);
    return [
      {
        label: s ? (s.fit.ok ? `Use on ${elementLabel(s.el.name)}` : `Doesn't fit ${elementLabel(s.el.name)}`) : 'Use on the selected element',
        disabled: !s || !s.fit.ok,
        action: () => useOnSelected(a),
      },
      { label: 'Show in folder', action: () => revealItemInDir(a.path).catch((e) => ed.notify(String(e), 'error')) },
      { separator: true },
      { label: 'Remove from Assets', danger: true, action: () => ed.removeFromLibrary(a.path) },
    ];
  });
</script>

<div class="assets">
  <div class="bar">
    <input placeholder="Find an asset…" bind:value={query} />
    <button class="small" onclick={addFiles} title="Copy files into your Assets"><Icon name="plus" size={13} /> Add</button>
    <button class="small ghost" onclick={openFolder} title="Open the Assets folder in Explorer"><Icon name="folder" size={14} /></button>
  </div>
  <div class="chips" role="tablist">
    {#each FILTERS as f (f.id)}
      <button class:on={filter === f.id} role="tab" aria-selected={filter === f.id} onclick={() => (filter = f.id)}>
        {f.label}{#if counts[f.id]}<span class="n">{counts[f.id]}</span>{/if}
      </button>
    {/each}
  </div>

  {#if !ed.library.length}
    <div class="empty">
      <Icon name="folder" size={22} />
      <p><strong>Your own pictures, videos, sounds and fonts</strong></p>
      <p class="dim">Drop files here from Explorer, or use <strong>Add</strong>. Then drag one onto an element in the preview, in Layers or on a property to use it.</p>
      <button onclick={addFiles}><Icon name="plus" size={13} /> Add files…</button>
    </div>
  {:else}
    <p class="hint faint">Drag onto an element to use it. It's copied into the theme (<span class="mono">_inc/…</span>), so the theme keeps working on its own. Double-click to use it on the selected element.</p>
    <div class="grid">
      {#each shown as a (a.path)}
        <div
          class="tile"
          role="button"
          tabindex="0"
          title="{a.rel} · {ASSET_KIND_LABEL[a.kind]}, {size(a.size)}"
          onpointerdown={(e) => down(e, a)}
          ondblclick={() => useOnSelected(a)}
          onkeydown={(e) => e.key === 'Enter' && useOnSelected(a)}
          oncontextmenu={(e) => {
            e.preventDefault();
            menu = { x: e.clientX, y: e.clientY, a };
          }}
          onmouseenter={(e) => a.kind === 'video' && (e.currentTarget.querySelector('video') as HTMLVideoElement | null)?.play().catch(() => {})}
          onmouseleave={(e) => a.kind === 'video' && (e.currentTarget.querySelector('video') as HTMLVideoElement | null)?.pause()}
        >
          <div class="thumb {a.kind}">
            {#if a.kind === 'image'}
              <img src={fileUrl(a.path)} alt="" loading="lazy" draggable="false" />
            {:else if a.kind === 'video'}
              <video src="{fileUrl(a.path)}#t=0.5" muted loop preload="metadata" draggable="false"></video>
              <span class="badge"><Icon name="video" size={11} /></span>
            {:else if a.kind === 'font'}
              <span class="aa" style:font-family="{fontFamily(a.path)}, sans-serif">Aa</span>
            {:else}
              <button
                class="play ghost"
                class:on={playing === a.path}
                title={playing === a.path ? 'Stop' : 'Listen'}
                onpointerdown={(e) => e.stopPropagation()}
                onclick={() => toggleSound(a)}
              >
                <Icon name={playing === a.path ? 'close' : 'sound'} size={20} />
              </button>
            {/if}
          </div>
          <span class="name">{basename(a.rel)}</span>
        </div>
      {:else}
        <p class="faint pad">No {filter === 'all' ? 'assets' : FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} match.</p>
      {/each}
    </div>
  {/if}
</div>

{#if menu}
  <ContextMenu x={menu.x} y={menu.y} items={menuItems} onclose={() => (menu = null)} />
{/if}

<style>
  .assets {
    padding: 8px 8px 16px;
    display: grid;
    gap: 8px;
  }
  .bar {
    display: flex;
    gap: 6px;
  }
  .bar input {
    flex: 1;
    min-width: 0;
  }
  .bar button {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }
  .chips {
    display: flex;
    gap: 3px;
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
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--text);
  }
  .n {
    margin-left: 4px;
    color: var(--text-faint);
  }
  .hint {
    margin: 0 2px;
    font-size: 11px;
  }
  .empty {
    display: grid;
    justify-items: center;
    text-align: center;
    gap: 6px;
    padding: 18px 12px;
    border: 1px dashed var(--line-strong);
    border-radius: 8px;
    color: var(--text-dim);
  }
  .empty p {
    margin: 0;
    font-size: 12px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 6px;
  }
  .tile {
    display: grid;
    gap: 3px;
    padding: 4px;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: grab;
    user-select: none;
    min-width: 0;
  }
  .tile:hover,
  .tile:focus-visible {
    border-color: var(--accent);
    background: #232a33;
    outline: none;
  }
  .thumb {
    position: relative;
    height: 60px;
    border-radius: 4px;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: repeating-conic-gradient(#20242b 0 25%, #2a2f38 0 50%) 0 0 / 10px 10px;
  }
  .thumb.video,
  .thumb.sound,
  .thumb.font {
    background: #1b1f25;
  }
  .thumb img,
  .thumb video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
  .badge {
    position: absolute;
    right: 3px;
    bottom: 3px;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 3px;
    padding: 1px 3px;
    display: grid;
    color: #fff;
  }
  .aa {
    font-size: 26px;
    color: var(--text);
  }
  .play {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    padding: 0;
  }
  .play.on {
    color: var(--accent);
  }
  .name {
    font-size: 10.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-dim);
  }
  .pad {
    padding: 8px;
    grid-column: 1 / -1;
  }
</style>
