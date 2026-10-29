<script lang="ts">
  // Sound: the theme's menu music and the sound when you scroll, from the app's own free sounds
  // or your own files. Everything can be listened to here first.
  import { onDestroy, onMount } from 'svelte';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import PlayIcon from '@lucide/svelte/icons/play';
  import SquareIcon from '@lucide/svelte/icons/square';
  import CheckIcon from '@lucide/svelte/icons/check';
  import { ed } from '$lib/editor.svelte';
  import { fileUrl } from '$lib/api';
  import { assetDrag } from '$lib/assetDrag.svelte';
  import { basename } from '$lib/path';
  import { MUSIC, SCROLL_SOUNDS, wavBytes, type SoundPreset } from '$lib/theme/sounds';
  import { extensionsOf } from '$lib/theme/assetDrop';

  const music = $derived(ed.themeMusic());
  const scroll = $derived(ed.themeScrollSound());
  const musicOn = $derived(ed.retrobatMusicOn());
  let busy = $state(false);

  // ---- listening ----
  const audio = typeof Audio !== 'undefined' ? new Audio() : null;
  let playing = $state<string | null>(null);
  const urls = new Map<string, string>();
  audio?.addEventListener('ended', () => (playing = null));

  function urlOf(s: SoundPreset) {
    let u = urls.get(s.id);
    if (!u) urls.set(s.id, (u = URL.createObjectURL(new Blob([wavBytes(s.make()) as BlobPart], { type: 'audio/wav' }))));
    return u;
  }

  function listen(key: string, src: () => string) {
    if (!audio) return;
    if (playing === key) {
      audio.pause();
      playing = null;
      return;
    }
    audio.src = src();
    audio.currentTime = 0;
    audio.play().then(
      () => (playing = key),
      () => ed.notify('This sound can’t be played here. RetroBat may still play it.', 'error'),
    );
  }

  onDestroy(() => {
    audio?.pause();
    for (const u of urls.values()) URL.revokeObjectURL(u);
  });

  async function run(fn: () => Promise<unknown>) {
    busy = true;
    try {
      await fn();
    } finally {
      busy = false;
    }
  }

  // ---- your own sounds, from Assets ----
  onMount(() => {
    if (!ed.libraryLoaded) ed.loadLibrary();
  });
  const ownSounds = $derived(ed.library.filter((a) => a.kind === 'sound'));
  /** Which "Use my own…" list is open. */
  let picking = $state<'music' | 'scroll' | null>(null);
  /** A sound is being dragged (from Windows): both sections take it. */
  const dragging = $derived(assetDrag.item?.kind === 'sound');

  const useFile = (kind: 'music' | 'scroll', file: string) => (kind === 'music' ? ed.setMusic({ file }) : ed.setScrollSound({ file }));

  /** Opens or closes a "Use my own…" list; a sound playing from it stops when it closes. */
  function setPicking(kind: 'music' | 'scroll' | null) {
    picking = kind;
    if (playing?.startsWith('lib:')) {
      audio?.pause();
      playing = null;
    }
  }

  async function useOwn(kind: 'music' | 'scroll', file: string) {
    setPicking(null);
    await run(async () => void (await useFile(kind, file)));
  }

  /** A file from the PC: used, and added to Assets so it's there next time. */
  async function fromComputer(kind: 'music' | 'scroll') {
    const file = await openDialog({ title: kind === 'music' ? 'Choose a song' : 'Choose a scroll sound', multiple: false, filters: [{ name: 'Sound', extensions: extensionsOf('sound') }] });
    if (typeof file !== 'string') return;
    setPicking(null);
    await run(async () => {
      if (await useFile(kind, file)) await ed.addToLibrary([file], true);
    });
  }
</script>

{#snippet row(s: SoundPreset, key: string, on: boolean, use: () => Promise<unknown>)}
  <div class="row" class:on>
    <button class="play" onclick={() => listen(key, () => urlOf(s))} aria-label={playing === key ? `Stop ${s.label}` : `Listen to ${s.label}`} title={playing === key ? 'Stop' : 'Listen'}>
      {#if playing === key}<SquareIcon size={13} />{:else}<PlayIcon size={13} />{/if}
    </button>
    <span class="what"><b>{s.label}</b><small>{s.help}</small></span>
    {#if on}
      <span class="in"><CheckIcon size={13} /> In use</span>
    {:else}
      <button class="secondary small" disabled={busy} onclick={() => run(use)}>Use</button>
    {/if}
  </div>
{/snippet}

{#snippet picker(kind: 'music' | 'scroll')}
  <div class="picker">
    <p class="ptitle">Your sounds in Assets</p>
    {#each ownSounds as a (a.path)}
      {@const key = `lib:${a.path}`}
      <div class="row">
        <button class="play" onclick={() => listen(key, () => fileUrl(a.path))} aria-label={playing === key ? 'Stop' : `Listen to ${basename(a.rel)}`} title={playing === key ? 'Stop' : 'Listen'}>
          {#if playing === key}<SquareIcon size={13} />{:else}<PlayIcon size={13} />{/if}
        </button>
        <span class="what"><b title={a.rel}>{basename(a.rel)}</b></span>
        <button class="secondary small" disabled={busy} onclick={() => useOwn(kind, a.path)}>Use</button>
      </div>
    {:else}
      <p class="dim note">No sounds in your Assets yet. Add some there, drag one here from Windows, or pick a file from your computer.</p>
    {/each}
    <div class="tools">
      <button class="secondary small" disabled={busy} onclick={() => fromComputer(kind)}>From my computer…</button>
      <button class="ghost small" onclick={() => setPicking(null)}>Cancel</button>
    </div>
    <p class="faint note">Files from your computer are added to your Assets too.</p>
  </div>
{/snippet}

<div class="sound">
  <section data-sound-slot="music" class:drop={dragging}>
    <h4>Menu music</h4>
    {#if dragging}<p class="drophint">Drop the sound here to use it as the menu music</p>{/if}
    <p class="dim note">Plays in RetroBat's menus, on every screen. The songs here are made by the app, free to use and share.</p>
    {#if !musicOn}
      <p class="warn note">
        Music is off in RetroBat, so it won't play.
        <button class="link small" onclick={() => ed.enableRetrobatMusic()}>Turn music on in RetroBat</button>
      </p>
    {/if}
    {#if music && !music.preset}
      <div class="row on">
        {#if music.abs}
          {@const abs = music.abs}
          <button class="play" onclick={() => listen('music:own', () => fileUrl(abs))} aria-label={playing === 'music:own' ? 'Stop' : `Listen to ${music.label}`}>
            {#if playing === 'music:own'}<SquareIcon size={13} />{:else}<PlayIcon size={13} />{/if}
          </button>
        {/if}
        <span class="what"><b>{music.label}</b><small>Your own song</small></span>
        <span class="in"><CheckIcon size={13} /> In use</span>
      </div>
    {/if}
    {#each MUSIC as m (m.id)}
      {@render row(m, `music:${m.id}`, music?.preset === m.id, () => ed.setMusic({ preset: m.id }))}
    {/each}
    <div class="tools">
      <button class="secondary small" disabled={busy} aria-expanded={picking === 'music'} onclick={() => setPicking(picking === 'music' ? null : 'music')}>Use my own song…</button>
      {#if music}<button class="ghost small" disabled={busy} onclick={() => run(() => ed.setMusic(null))}>No music</button>{/if}
    </div>
    {#if picking === 'music'}{@render picker('music')}{/if}
    <p class="faint note">Your own song is copied into the theme. Only share a theme with music you're allowed to share.</p>
  </section>

  <section data-sound-slot="scroll" class:drop={dragging}>
    <h4>Scroll sound</h4>
    {#if dragging}<p class="drophint">Drop the sound here to use it as the scroll sound</p>{/if}
    <p class="dim note">Plays each time you move through the consoles or the game list.</p>
    {#if scroll && !scroll.preset}
      <div class="row on">
        <span class="what"><b>{scroll.label}</b><small>Your own sound</small></span>
        <span class="in"><CheckIcon size={13} /> In use</span>
      </div>
    {/if}
    {#each SCROLL_SOUNDS as s (s.id)}
      {@render row(s, `scroll:${s.id}`, scroll?.preset === s.id, () => ed.setScrollSound({ preset: s.id }))}
    {/each}
    <div class="tools">
      <button class="secondary small" disabled={busy} aria-expanded={picking === 'scroll'} onclick={() => setPicking(picking === 'scroll' ? null : 'scroll')}>Use my own sound…</button>
      {#if scroll}<button class="ghost small" disabled={busy} onclick={() => run(() => ed.setScrollSound(null))}>RetroBat's own</button>{/if}
    </div>
    {#if picking === 'scroll'}{@render picker('scroll')}{/if}
  </section>
</div>

<style>
  .sound {
    padding: 8px 10px 16px;
  }
  h4 {
    margin: 6px 0 6px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }
  section + section {
    margin-top: 16px;
  }
  section {
    border: 1px dashed transparent;
    border-radius: 8px;
    margin-left: -6px;
    margin-right: -6px;
    padding: 0 6px 2px;
  }
  section.drop {
    border-color: var(--brand);
    background: var(--brand-soft);
  }
  .drophint {
    margin: 0 0 6px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--brand);
  }
  .picker {
    margin: 0 0 8px;
    padding: 8px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--raised);
  }
  .ptitle {
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-dim);
  }
  .note {
    margin: 0 0 8px;
    font-size: 11.5px;
  }
  .warn {
    color: var(--warn);
  }
  .row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    margin-bottom: 4px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
  }
  .row.on {
    border-color: var(--brand);
  }
  .play {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: 50%;
  }
  .what {
    display: grid;
    min-width: 0;
  }
  .what b {
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .what small {
    color: var(--text-faint);
    font-size: 10.5px;
  }
  .in {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--brand);
    font-size: 11px;
    font-weight: 600;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0 6px;
  }
</style>
