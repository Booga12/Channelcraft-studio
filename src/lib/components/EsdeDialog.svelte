<script lang="ts">
  // Export for ES-DE (#49): what carries over to ES-DE and what doesn't, then a .zip to share.
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import { ed } from '$lib/editor.svelte';
  import { basename } from '$lib/path';
  import type { EsdeExport } from '$lib/theme/esde';
  import AppDialog from './AppDialog.svelte';

  let plan = $state<EsdeExport | null>(null);
  let failed = $state('');
  let busy = $state(false);
  let done = $state<string | null>(null);

  ed.esdeExport()
    .then((p) => (plan = p))
    .catch((e) => (failed = String(e)));

  const copied = $derived(plan ? plan.files.filter((f) => f.src).length : 0);
  const unsaved = $derived(ed.dirtyCount > 0);
  const close = () => !busy && (ed.showEsde = false);

  async function exportZip() {
    busy = true;
    failed = '';
    try {
      done = await ed.writeEsde();
    } catch (e) {
      failed = `The export didn’t work: ${e}`;
    } finally {
      busy = false;
    }
  }
</script>

<AppDialog
  title={done ? 'Exported for ES-DE' : 'Export for ES-DE'}
  description={done ? undefined : 'A copy of this theme for ES-DE (EmulationStation Desktop Edition), as a .zip to share. Your RetroBat theme stays as it is.'}
  onclose={close}
  {busy}
  class="sm:max-w-lg"
>
  {#snippet footer()}
    {#if done}
      <Button variant="outline" onclick={() => revealItemInDir(done!)}>Show file</Button>
      <Button onclick={close}>Done</Button>
    {:else}
      <Button variant="outline" onclick={close} disabled={busy}>Cancel</Button>
      <Button onclick={exportZip} disabled={busy || !plan}>
        {#if busy}<Spinner />Exporting…{:else}Export…{/if}
      </Button>
    {/if}
  {/snippet}

  {#if done}
    <div class="ui-new flex flex-col gap-2 text-sm" role="status">
      <p class="m-0">Saved as <strong>{basename(done)}</strong>.</p>
      <p class="m-0 text-muted-foreground">To use it: unzip it into ES-DE's <span class="font-mono text-xs">themes</span> folder, restart ES-DE and pick the theme in UI settings. The game list styles are under Theme variant.</p>
    </div>
  {:else if !plan && !failed}
    <p class="ui-new m-0 flex items-center gap-2 text-sm text-muted-foreground"><Spinner />Working out what carries over…</p>
  {:else if plan}
    <div class="ui-new flex flex-col gap-4 text-sm">
      <div class="flex flex-col gap-1.5">
        <strong>What carries over</strong>
        <p class="m-0 text-muted-foreground">The console list with each console's logo, and the colors, fonts, pictures and game details on each screen ({copied} file{copied === 1 ? '' : 's'}).</p>
        {#if plan.variants.length}
          <p class="m-0 text-muted-foreground">Game list styles, picked in ES-DE under Theme variant:</p>
          <div class="flex flex-wrap gap-1.5">
            {#each plan.variants as v (v.name)}<span class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{v.label}</span>{/each}
          </div>
        {/if}
      </div>
      {#if plan.notes.length}
        <div class="flex flex-col gap-1.5">
          <strong>Left out or changed</strong>
          <ul class="m-0 max-h-48 list-disc overflow-y-auto rounded-lg bg-muted/60 py-2 pr-3 pl-7 text-xs text-muted-foreground">
            {#each plan.notes as n (n)}<li class="py-0.5">{n}</li>{/each}
          </ul>
          <p class="m-0 text-xs text-muted-foreground">This list is also in the zip, as CONVERSION-NOTES.txt.</p>
        </div>
      {/if}
      {#if unsaved}<p class="m-0 text-xs text-muted-foreground">Your unsaved changes are saved first.</p>{/if}
    </div>
  {/if}
  {#if failed}<p class="ui-new m-0 mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{failed}</p>{/if}
</AppDialog>
