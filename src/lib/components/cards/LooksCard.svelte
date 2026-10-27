<script lang="ts">
  // One-click looks that set a few settings at once (one undo step).
  import WandIcon from '@lucide/svelte/icons/wand-sparkles';
  import { ed } from '$lib/editor.svelte';
  import { catalogFont } from '$lib/theme/fonts';
  import { PICTURE_LOOKS, TEXT_LOOKS, type PictureLook, type TextLook } from '$lib/theme/simpleProps';
  import type { ResolvedElement } from '$lib/theme/resolver';
  import Card from './Card.svelte';

  let { el, kind }: { el: ResolvedElement; kind: 'text' | 'picture' } = $props();

  // The looks' fonts, loaded from the free font catalogue to draw the samples.
  const loaded = $state<Record<string, string>>({});
  $effect(() => {
    if (kind !== 'text') return;
    for (const l of TEXT_LOOKS) {
      const f = catalogFont(l.font);
      if (!f || loaded[l.id]) continue;
      const fam = `ccs-look-${l.id}`;
      new FontFace(fam, `url("${f.url}")`)
        .load()
        .then((face) => {
          document.fonts.add(face);
          loaded[l.id] = fam;
        })
        .catch(() => {});
    }
  });

  let busy = $state(false);
  async function text(l: TextLook) {
    busy = true;
    try {
      await ed.applyTextLook(el.name, l);
    } finally {
      busy = false;
    }
  }
  const glowCss = (g: TextLook['glow']) => ({ none: 'none', soft: '0 0 5px #fff9', strong: '0 0 2px #fff, 0 0 9px #fffc', shadow: '1px 2px 2px #000d', outline: '0 0 0 #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' })[g];
  const shadowCss = (l: PictureLook) => (l.shadow === null ? 'none' : l.shadow < 10 ? 'drop-shadow(2px 2px 2px #0009)' : 'drop-shadow(3px 4px 4px #000c)');
</script>

<Card id="looks" title="Quick looks" icon={WandIcon} summary="one click">
  <div class="looks">
    {#if kind === 'text'}
      {#each TEXT_LOOKS as l (l.id)}
        <button disabled={busy} title="{l.label}: font, capitals and glow in one click" onclick={() => text(l)}>
          <span class="sample" style:font-family={loaded[l.id] ? `'${loaded[l.id]}', sans-serif` : 'inherit'} style:text-shadow={glowCss(l.glow)}>{l.caps ? 'AA' : 'Aa'}</span>
          <span class="name">{l.label}</span>
        </button>
      {/each}
    {:else}
      {#each PICTURE_LOOKS as l (l.id)}
        <button title="{l.label}: corners, shadow and see-through in one click" onclick={() => ed.applyPictureLook(el.name, l)}>
          <span class="sample"><i style:border-radius="{l.corners * 150}px" style:opacity={l.opacity} style:filter={shadowCss(l)}></i></span>
          <span class="name">{l.label}</span>
        </button>
      {/each}
    {/if}
  </div>
  <p class="note">{kind === 'text' ? 'Each one picks a free font (downloaded into the theme), capitals and a glow.' : 'Each one sets the corners, the shadow and how see-through it is.'} Ctrl+Z undoes it.</p>
</Card>

<style>
  .looks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
    gap: 6px;
  }
  .looks button {
    padding: 0;
    overflow: hidden;
    display: grid;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--bg);
  }
  .looks button:hover:not(:disabled) {
    border-color: var(--brand);
  }
  .sample {
    height: 38px;
    display: grid;
    place-items: center;
    background: radial-gradient(120% 90% at 30% 20%, #2a3160, #12142a 70%);
    color: #fff;
    font-size: 16px;
  }
  .sample i {
    display: block;
    width: 26px;
    height: 18px;
    background: #d9dbe6;
  }
  .name {
    font-size: 11px;
    padding: 3px 0;
    color: var(--text-dim);
  }
</style>
