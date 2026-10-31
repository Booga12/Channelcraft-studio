<script lang="ts">
  // Publish to the gallery: a .zip like the one Share theme makes (theme files and preview, without
  // the console art copied from other themes), sent with a theme name and a maker name. It's
  // public as soon as it's published.
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Input } from '$lib/components/ui/input';
  import { Spinner } from '$lib/components/ui/spinner';
  import { fileUrl } from '$lib/api';
  import { ed } from '$lib/editor.svelte';
  import { leftOutNote, MAKER_MAX, NAME_MAX, nameProblem, publishError } from '$lib/gallery';
  import { join } from '$lib/path';
  import { prefs } from '$lib/prefs.svelte';
  import AppDialog from './AppDialog.svelte';

  let name = $state((ed.project?.name ?? '').slice(0, NAME_MAX));
  let maker = $state(prefs.v.galleryMaker ?? '');
  let allowed = $state(false);
  let busy = $state(false);
  let error = $state('');
  let done = $state<{ url: string; leftOut: string[] } | null>(null);
  let copied = $state(false);
  // Problems show once the box has been left, or after pressing Publish.
  let touched = $state({ name: false, maker: false });

  const nameErr = $derived(nameProblem(name, 'theme'));
  const makerErr = $derived(nameProblem(maker, 'maker'));
  const ready = $derived(!nameErr && !makerErr && allowed && !busy);
  const preview = $derived(ed.project && ed.hasPreview() ? fileUrl(join(ed.project.dir, 'preview.png')) : null);
  const unsaved = $derived(ed.dirtyCount > 0);

  const close = () => !busy && (ed.showPublish = false);

  async function publish() {
    touched = { name: true, maker: true };
    if (!ready) return;
    busy = true;
    error = '';
    prefs.set('galleryMaker', maker.trim());
    try {
      done = await ed.publishToGallery(name, maker);
    } catch (e) {
      error = publishError(e);
    } finally {
      busy = false;
    }
  }

  async function copy() {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.url);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      ed.notify("Couldn't copy the link.", 'error');
    }
  }

  async function openPage() {
    if (!done) return;
    try {
      await openUrl(done.url);
    } catch (e) {
      ed.notify(`Couldn't open the browser: ${e}`, 'error');
    }
  }
</script>

<AppDialog
  title={done ? 'Published to the gallery' : 'Publish to the gallery'}
  description={done ? undefined : 'Put this theme in the ChannelCraft gallery, for anyone to download.'}
  onclose={close}
  {busy}
  class="sm:max-w-lg"
>
  {#snippet footer()}
    {#if done}
      <Button variant="outline" onclick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
      <Button variant="outline" onclick={openPage}>Open in browser</Button>
      <Button onclick={close}>Done</Button>
    {:else}
      <Button variant="outline" onclick={close} disabled={busy}>Cancel</Button>
      <Button onclick={publish} disabled={busy || !allowed}>
        {#if busy}<Spinner />Publishing…{:else}Publish{/if}
      </Button>
    {/if}
  {/snippet}

  {#if done}
    <div class="ui-new flex flex-col gap-3 text-sm" role="status">
      <p class="m-0">“{name.trim()}” is in the gallery now. Anyone can find it and download it there.</p>
      <a class="break-all text-primary underline-offset-4 hover:underline" href={done.url} onclick={(e) => (e.preventDefault(), openPage())}>{done.url}</a>
      {#if leftOutNote(done.leftOut)}<p class="m-0 text-xs text-muted-foreground">{leftOutNote(done.leftOut)}</p>{/if}
    </div>
  {:else}
    <form class="ui-new flex flex-col gap-4" onsubmit={(e) => (e.preventDefault(), publish())}>
      <div class="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div class="flex flex-col gap-3">
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            Theme name
            <!-- svelte-ignore a11y_autofocus -->
            <Input bind:value={name} maxlength={NAME_MAX} disabled={busy} autofocus aria-invalid={touched.name && !!nameErr} aria-describedby={touched.name && nameErr ? 'pub-name-err' : undefined} onblur={() => (touched.name = true)} />
            {#if touched.name && nameErr}<span id="pub-name-err" class="text-xs font-normal text-destructive">{nameErr}</span>{/if}
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            Made by
            <Input bind:value={maker} maxlength={MAKER_MAX} disabled={busy} placeholder="Your name or nickname" aria-invalid={touched.maker && !!makerErr} aria-describedby={touched.maker && makerErr ? 'pub-maker-err' : undefined} onblur={() => (touched.maker = true)} />
            {#if touched.maker && makerErr}<span id="pub-maker-err" class="text-xs font-normal text-destructive">{makerErr}</span>{/if}
          </label>
        </div>
        <figure class="m-0 flex flex-col gap-1">
          {#if preview}
            <img class="aspect-video w-full rounded-lg object-cover ring-1 ring-foreground/10" src={preview} alt="The theme’s preview" />
          {:else}
            <div class="grid aspect-video w-full place-items-center rounded-lg bg-muted p-2 text-center text-xs text-muted-foreground">No preview yet</div>
          {/if}
          <figcaption class="text-xs text-muted-foreground">{preview ? 'Shown in the gallery' : 'Made from this screen when you publish'}</figcaption>
        </figure>
      </div>

      <div class="flex flex-col gap-1.5 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
        <p class="m-0"><strong class="text-foreground">What's sent:</strong> the theme's files and its preview picture, with the theme name and your maker name. Nothing else from your PC.</p>
        <p class="m-0">Console logos and pictures copied from other themes aren't uploaded: people who download the theme get them from their own themes.</p>
        <p class="m-0"><strong class="text-foreground">It's public:</strong> once published, anyone can see it and download it from the gallery.</p>
        {#if unsaved}<p class="m-0">Your unsaved changes are saved first.</p>{/if}
      </div>

      <label class="flex items-start gap-2 text-sm">
        <Checkbox bind:checked={allowed} disabled={busy} class="mt-0.5" />
        <span>I made this theme, or I'm allowed to share everything in it.</span>
      </label>

      {#if error}<p class="m-0 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>{/if}
      {#if busy}<p class="m-0 text-xs text-muted-foreground" aria-live="polite">Packing and sending the theme… With many pictures this can take a little while.</p>{/if}
    </form>
  {/if}
</AppDialog>
