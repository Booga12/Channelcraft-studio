<script lang="ts">
  // RetroBat's intro video (retrobat.ini, [SplashScreen]): whether it plays, which one, and how
  // it hands over to the interface. Changes are written straight away; the file is backed up
  // the first time.
  import { open } from '@tauri-apps/plugin-dialog';
  import { fade } from 'svelte/transition';
  import ShuffleIcon from '@lucide/svelte/icons/shuffle';
  import FolderIcon from '@lucide/svelte/icons/folder';
  import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
  import FilmIcon from '@lucide/svelte/icons/film';
  import CheckIcon from '@lucide/svelte/icons/check';
  import { Switch } from '$lib/components/ui/switch';
  import { Slider } from '$lib/components/ui/slider';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import { api, fileUrl, type IntroInfo, type IntroSettings } from '$lib/api';
  import { ed } from '$lib/editor.svelte';
  import { cn } from '$lib/utils';

  let info = $state<IntroInfo | null>(null);
  let error = $state('');
  let saving = $state(false);
  let savedAt = $state(0);

  async function load() {
    try {
      info = await api.readIntro();
      error = '';
    } catch (e) {
      error = String(e);
    }
  }
  load();

  const s = $derived(info?.settings);
  const current = $derived(info?.videos.find((v) => v.name.toLowerCase() === s?.fileName.toLowerCase()) ?? null);

  /** Writes one change; on failure the file and the switches stay as they were. */
  async function change(part: Partial<IntroSettings>) {
    if (!info) return;
    const next = { ...info.settings, ...part };
    const before = info;
    info = { ...info, settings: next };
    saving = true;
    try {
      info = await api.writeIntro(next);
      savedAt = Date.now();
    } catch (e) {
      info = before;
      ed.notify(`Couldn't change retrobat.ini: ${e}`, 'error');
    } finally {
      saving = false;
    }
  }

  async function pickFolder() {
    const dir = await open({ directory: true, title: 'Choose a folder with intro videos' });
    if (typeof dir === 'string') await change({ filePath: dir });
  }

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 100 * 1024 * 1024 ? 0 : 1)} MB`;
  const pretty = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');

  // The video grid is one Tab stop: arrow keys move between the videos, Enter or Space picks one.
  let gridFocus = $state(-1);
  const gridStop = $derived.by(() => {
    const n = info?.videos.length ?? 0;
    if (gridFocus >= 0 && gridFocus < n) return gridFocus;
    return Math.max(0, info?.videos.findIndex((v) => !s?.randomVideo && v.name.toLowerCase() === s?.fileName.toLowerCase()) ?? 0);
  });

  function gridKeys(e: KeyboardEvent, i: number) {
    const n = info?.videos.length ?? 0;
    const cols = 3;
    let j: number;
    if (e.key === 'ArrowRight') j = i + 1;
    else if (e.key === 'ArrowLeft') j = i - 1;
    else if (e.key === 'ArrowDown') j = i + cols;
    else if (e.key === 'ArrowUp') j = i - cols;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = n - 1;
    else return;
    e.preventDefault();
    j = Math.max(0, Math.min(n - 1, j));
    ((e.currentTarget as HTMLElement).parentElement?.children[j] as HTMLElement | undefined)?.focus();
  }

  function hover(e: PointerEvent, play: boolean) {
    const v = (e.currentTarget as HTMLElement).querySelector('video');
    if (!v) return;
    if (play) v.play().catch(() => {});
    else {
      v.pause();
      v.currentTime = 1;
    }
  }
</script>

<div class="ui-new flex flex-col gap-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h3 class="m-0 text-sm font-semibold">Intro video</h3>
      <p class="m-0 mt-1 text-xs text-muted-foreground">The video RetroBat plays when it starts, before the menus. These are RetroBat's own settings (in retrobat.ini), not part of a theme.</p>
    </div>
    <span class="flex h-5 shrink-0 items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      {#if saving}<Spinner class="size-3.5" />Saving…{:else if savedAt}<span class="flex items-center gap-1" in:fade><CheckIcon class="size-3.5 text-primary" />Saved</span>{/if}
    </span>
  </div>

  {#if error}
    <p class="m-0 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
  {:else if !info || !s}
    <p class="m-0 flex items-center gap-2 text-sm text-muted-foreground"><Spinner />Reading retrobat.ini…</p>
  {:else if !info.found}
    <p class="m-0 rounded-lg bg-muted p-3 text-sm text-muted-foreground">RetroBat makes retrobat.ini the first time it starts. Launch RetroBat once, close it, and come back here.</p>
  {:else}
    <label class="flex items-center justify-between gap-4 rounded-xl bg-muted/50 p-3 ring-1 ring-foreground/5">
      <span class="flex flex-col">
        <span class="text-sm font-medium">Play an intro video</span>
        <span class="text-xs text-muted-foreground">Off goes straight to the menus.</span>
      </span>
      <Switch checked={s.enableIntro} onCheckedChange={(v) => change({ enableIntro: v })} />
    </label>

    <div class={cn('flex flex-col gap-4 transition-opacity duration-200', !s.enableIntro && 'pointer-events-none opacity-45')} aria-disabled={!s.enableIntro} inert={!s.enableIntro}>
      {#if current && !s.randomVideo}
        {#key current.path}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video class="aspect-video w-full rounded-xl bg-black shadow-elev-2 ring-1 ring-foreground/10" src={fileUrl(current.path)} controls preload="metadata" in:fade={{ duration: 200 }}></video>
        {/key}
      {/if}

      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 flex-col">
          <span class="text-sm font-medium">Which video</span>
          <span class="truncate text-xs text-muted-foreground" title={info.folder}>
            {s.filePath.toLowerCase() === 'default' ? "RetroBat's video folder" : info.folder} · {info.videos.length} video{info.videos.length === 1 ? '' : 's'}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          {#if s.filePath.toLowerCase() !== 'default'}
            <Button variant="ghost" size="sm" onclick={() => change({ filePath: 'default' })} title="Use the videos that come with RetroBat"><RotateCcwIcon data-icon="inline-start" />RetroBat's folder</Button>
          {/if}
          <Button variant="outline" size="sm" onclick={pickFolder}><FolderIcon data-icon="inline-start" />Other folder…</Button>
        </div>
      </div>

      <label class="flex items-center justify-between gap-4">
        <span class="flex items-center gap-2 text-sm"><ShuffleIcon class="size-4 text-muted-foreground" />A different random video each time</span>
        <Switch checked={s.randomVideo} onCheckedChange={(v) => change({ randomVideo: v })} />
      </label>

      {#if info.videos.length}
        <div class={cn('grid grid-cols-3 gap-2.5 transition-opacity duration-200', s.randomVideo && 'opacity-60')} role="radiogroup" aria-label="Which video">
          {#each info.videos as v, i (v.path)}
            {@const on = !s.randomVideo && v.name.toLowerCase() === s.fileName.toLowerCase()}
            <button
              class={cn(
                'group relative flex flex-col overflow-hidden rounded-xl bg-card text-left shadow-elev-1 ring-1 ring-foreground/8 transition-all duration-200 ease-out-soft hover:-translate-y-0.5 hover:shadow-elev-3',
                on && 'ring-2 ring-primary',
              )}
              role="radio"
              aria-checked={on}
              tabindex={i === gridStop ? 0 : -1}
              onfocus={() => (gridFocus = i)}
              onkeydown={(e) => gridKeys(e, i)}
              onclick={() => change({ fileName: v.name, randomVideo: false })}
              onpointerenter={(e) => hover(e, true)}
              onpointerleave={(e) => hover(e, false)}
              title="Play {v.name} when RetroBat starts"
            >
              <!-- svelte-ignore a11y_media_has_caption -->
              <video class="pointer-events-none aspect-video w-full bg-black object-cover" src="{fileUrl(v.path)}#t=1" muted loop preload="metadata" playsinline></video>
              <span class="flex items-center gap-1.5 px-2.5 py-2">
                <FilmIcon class="size-3.5 shrink-0 text-muted-foreground" />
                <span class="min-w-0 flex-1 truncate text-xs font-medium capitalize">{pretty(v.name)}</span>
                <span class="text-[10.5px] text-muted-foreground">{mb(v.size)}</span>
              </span>
              {#if on}
                <span class="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-elev-2"><CheckIcon class="size-3" strokeWidth={3} /></span>
              {/if}
            </button>
          {/each}
        </div>
      {:else}
        <p class="m-0 rounded-lg bg-muted p-3 text-sm text-muted-foreground">There are no videos in this folder.</p>
      {/if}

      <div class="flex flex-col gap-3 rounded-xl bg-muted/50 p-3 ring-1 ring-foreground/5">
        <label class="flex items-center justify-between gap-4">
          <span class="flex flex-col">
            <span class="text-sm">Wait for the video to end</span>
            <span class="text-xs text-muted-foreground">Off starts loading the menus while the video plays.</span>
          </span>
          <Switch checked={s.waitForVideoEnd} onCheckedChange={(v) => change({ waitForVideoEnd: v })} />
        </label>
        <label class="flex items-center justify-between gap-4">
          <span class="flex flex-col">
            <span class="text-sm">Stop the video when the menus are ready</span>
            <span class="text-xs text-muted-foreground">Cuts a long video short once RetroBat has loaded.</span>
          </span>
          <Switch checked={s.killVideoWhenEsReady} onCheckedChange={(v) => change({ killVideoWhenEsReady: v })} />
        </label>
        <label class="flex items-center justify-between gap-4">
          <span class="flex flex-col">
            <span class="text-sm">Skip with a gamepad button</span>
            <span class="text-xs text-muted-foreground">Works with Xbox-style (XInput) controllers.</span>
          </span>
          <Switch checked={s.gamepadVideoKill} onCheckedChange={(v) => change({ gamepadVideoKill: v })} />
        </label>
        <div class="flex flex-col gap-2">
          <span class="flex items-center justify-between text-sm">
            <span class="flex flex-col">
              <span>Delay before the menus start</span>
              <span class="text-xs text-muted-foreground">A longer delay helps when the video ends up behind the menus.</span>
            </span>
            <span class="font-mono text-xs text-muted-foreground tabular-nums">{(s.videoDelay / 1000).toFixed(1)} s</span>
          </span>
          <Slider type="single" thumbLabel="Delay before the menus start" min={0} max={5000} step={100} value={s.videoDelay} onValueCommit={(v: number) => change({ videoDelay: v })} />
        </div>
      </div>
    </div>
  {/if}
</div>
