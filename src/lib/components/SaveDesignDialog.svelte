<script lang="ts">
  // Save as my design: the theme's look (colours, depth, layouts, fonts) as a design of your
  // own, kept in the app and shown first in every design picker.
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { ed } from '$lib/editor.svelte';
  import { savedToDesign } from '$lib/theme/designList.svelte';
  import { BUILT_IN_DESIGNS } from '$lib/theme/designCatalog';
  import DesignThumb from './DesignThumb.svelte';
  import AppDialog from './AppDialog.svelte';

  let name = $state(ed.project ? `My ${ed.project.name}` : 'My design');
  // Worked out once: the name only changes when it's saved.
  const look = ed.lookAsDesign('My design');
  const preview = look ? savedToDesign(look) : null;
  const baseLabel = BUILT_IN_DESIGNS.find((d) => d.id === look?.base)?.label ?? '';

  const close = () => (ed.showSaveDesign = false);
  function save() {
    if (!look || !name.trim()) return;
    ed.saveAsMyDesign(name);
    close();
  }
</script>

<AppDialog title="Save as my design" description="Keep this theme's look to use on other themes, or to share. It's saved in the app, not in the theme." onclose={close} class="sm:max-w-md">
  {#snippet footer()}
    <Button variant="outline" onclick={close}>Cancel</Button>
    <Button onclick={save} disabled={!look || !name.trim()}>Save design</Button>
  {/snippet}

  {#if !preview}
    <p class="text-sm">This theme isn't made from a design, so there's no look to save yet. Pick a design in Presets first, make it your own, then save it here.</p>
  {:else}
    <form class="ui-new flex flex-col gap-4" onsubmit={(e) => (e.preventDefault(), save())}>
      <label class="flex flex-col gap-1.5 text-sm font-medium">
        Name
        <!-- svelte-ignore a11y_autofocus -->
        <Input bind:value={name} maxlength={40} autofocus />
      </label>
      <div class="thumb"><DesignThumb design={preview} /></div>
      <p class="text-xs text-muted-foreground">
        It keeps your colours, depth, console screen layout, game list layout and fonts, with the artwork style of {baseLabel}.
        Parts you added yourself and pictures you chose stay in this theme only.
      </p>
    </form>
  {/if}
</AppDialog>

<style>
  .thumb {
    max-width: 280px;
  }
</style>
