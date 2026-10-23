<script lang="ts">
  // A small banner when a newer version of the studio is available.
  import { onMount } from 'svelte';
  import { updates } from '$lib/updates.svelte';
  import { Button } from '$lib/components/ui/button';

  let dismissed = $state(false);

  onMount(() => {
    // Quietly, a little after starting, so it never slows the app down.
    const t = setTimeout(() => updates.check(true), 8000);
    return () => clearTimeout(t);
  });
</script>

{#if updates.available && !dismissed}
  <div class="ui-new fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-xl bg-card p-3 text-sm text-card-foreground shadow-elev-3 ring-1 ring-foreground/10" role="status">
    <div class="flex min-w-0 flex-col">
      <strong>ChannelCraft Studio {updates.available.version} is ready</strong>
      <span class="text-xs text-muted-foreground">{updates.state === 'installing' ? 'Downloading and installing…' : updates.state === 'failed' ? `It couldn't be installed: ${updates.error}` : 'Save your work first: the app restarts to finish.'}</span>
    </div>
    <Button size="sm" onclick={() => updates.install()} disabled={updates.state === 'installing'}>Install and restart</Button>
    <Button size="sm" variant="ghost" onclick={() => (dismissed = true)}>Later</Button>
  </div>
{/if}
