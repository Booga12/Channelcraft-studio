<script lang="ts">
  // Every colour setting of a part that isn't a text (game lists, carousels, ratings…), as swatches.
  import PaletteIcon from '@lucide/svelte/icons/palette';
  import { propHelp, propLabel } from '$lib/friendly';
  import type { ResolvedElement } from '$lib/theme/resolver';
  import Card from './Card.svelte';
  import ColourPick from './ColourPick.svelte';

  let { el, props }: { el: ResolvedElement; props: string[] } = $props();
</script>

<Card id="colours" title={props.length === 1 ? propLabel(props[0]) : 'Colours'} icon={PaletteIcon} words={props.map(propLabel).join(' ')}>
  {#each props as p (p)}
    <div class="row">
      <div class="lbl" title={propHelp(p)}>{propLabel(p)}</div>
      <ColourPick {el} prop={p} />
    </div>
  {/each}
</Card>
