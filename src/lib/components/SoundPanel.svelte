<script lang="ts">
  // Sound: the theme's menu music and the sound when you scroll, from the app's own free sounds
  // or your own files. Everything can be listened to here first.
  import { onDestroy } from 'svelte';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import PlayIcon from '@lucide/svelte/icons/play';
  import SquareIcon from '@lucide/svelte/icons/square';
  import CheckIcon from '@lucide/svelte/icons/check';
  import { ed } from '$lib/editor.svelte';
  import { fileUrl } from '$lib/api';
  import { MUSIC, SCROLL_SOUNDS, wavBytes, type SoundPreset } from '$lib/theme/sounds';

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

  async function run(fn: () => Promise<void>) {
    busy = true;
    try {
      await fn();
    } finally {
      busy = false;
    }
  }

  async function pickFile(kind: 'music' | 'scroll') {
    const file = await openDialog({ title: kind === 'music' ? 'Choose a song' : 'Choose a scroll sound', multiple: false, filters: [{ name: 'Sound', extensions: ['mp3', 'ogg', 'wav', 'flac'] }] });
    if (typeof file !== 'string') return;
    await run(() => (kind === 'music' ? ed.setMusic({ file }) : ed.setScrollSound({ file })));
  }
</script>

{#snippet row(s: SoundPreset, key: string, on: boolean, use: () => Promise<void>)}
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

<div class="sound">
  <section>
    <h4>Menu music</h4>
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
      <button class="secondary small" disabled={busy} onclick={() => pickFile('music')}>Use my own song…</button>
      {#if music}<button class="ghost small" disabled={busy} onclick={() => run(() => ed.setMusic(null))}>No music</button>{/if}
    </div>
    <p class="faint note">Your own song is copied into the theme. Only share a theme with music you're allowed to share.</p>
  </section>

  <section>
    <h4>Scroll sound</h4>
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
      <button class="secondary small" disabled={busy} onclick={() => pickFile('scroll')}>Use my own sound…</button>
      {#if scroll}<button class="ghost small" disabled={busy} onclick={() => run(() => ed.setScrollSound(null))}>RetroBat's own</button>{/if}
    </div>
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
