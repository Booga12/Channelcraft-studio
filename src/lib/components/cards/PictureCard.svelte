<script lang="ts">
  // Which picture or video a part shows (and the fallback picture for RetroBat's game media).
  import ImageIcon from '@lucide/svelte/icons/image';
  import { ed } from '$lib/editor.svelte';
  import { SCHEMA, inferSpec } from '$lib/theme/schema';
  import type { ResolvedElement } from '$lib/theme/resolver';
  import AssetInput from '../AssetInput.svelte';
  import PropRow from '../PropRow.svelte';
  import Card from './Card.svelte';

  let { el }: { el: ResolvedElement } = $props();

  const isVideo = $derived(el.type === 'video');
  const files = $derived(['path', 'default'].filter((p) => el.props.has(p)));
  const spec = (p: string) => SCHEMA[el.type]?.find((s) => s.name === p) ?? inferSpec(p);
  const file = $derived((el.props.get('path')?.value ?? '').replace(/^.*[\\/]/, ''));
</script>

<Card id="picture" title={isVideo ? 'Video' : 'Picture'} icon={ImageIcon} summary={file.includes('{') ? 'from each game' : file}>
  {#each files as p (p)}
    {@const def = el.props.get(p)!}
    <div class="flush"><PropRow {el} spec={spec(p)} {def} /></div>
  {:else}
    <div class="row">
      <div class="lbl">{isVideo ? 'Video file' : 'Picture file'}</div>
      <AssetInput value="" kind={isVideo ? 'video' : 'image'} resolved={null} toRelative={(abs) => ed.relativeAssetPath(el.name, 'path', abs)} onchange={(v) => ed.setProp(el.name, 'path', v)} />
    </div>
  {/each}
  <p class="note">Keeps its shape. You can also drop a file from Assets or Explorer on this card to swap it.</p>
</Card>

<style>
  .flush {
    margin: 0 -12px;
  }
  .flush :global(.row) {
    border-bottom: 0;
    padding-top: 0;
  }
</style>
