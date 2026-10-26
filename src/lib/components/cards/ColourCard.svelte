<script lang="ts">
  // A text's colour and glow, with a warning (and fixes) when it is hard to read on the theme's
  // background.
  import PaletteIcon from '@lucide/svelte/icons/palette';
  import { ed } from '$lib/editor.svelte';
  import { contrast } from '$lib/theme/presets';
  import { glowOf, GLOWS, hex8 } from '$lib/theme/simpleProps';
  import type { ResolvedElement } from '$lib/theme/resolver';
  import Card from './Card.svelte';
  import ColourPick from './ColourPick.svelte';
  import Seg from './Seg.svelte';

  let { el, onreset }: { el: ResolvedElement; onreset: (() => void) | null } = $props();

  const v = (p: string) => el.props.get(p)?.value;
  const glow = $derived(glowOf(v('glowColor'), v('glowSize'), v('glowOffset')));
  const colour = $derived(hex8(v('color')) ?? 'FFFFFFFF');
  const bg = $derived(ed.designBackground);
  /** Under 3 is hard to read (a glow or shadow helps). */
  const hard = $derived(!!bg && contrast(colour.slice(0, 6), bg) < 3 && glow !== 'shadow' && glow !== 'strong');
  const better = $derived(bg && contrast('111111', bg) > contrast('FFFFFF', bg) ? '111111FF' : 'FFFFFFFF');
</script>

<Card id="colour" title="Colour & glow" icon={PaletteIcon} summary={glow === 'none' ? '' : glow === 'shadow' ? 'Shadow' : `${glow === 'soft' ? 'Soft' : 'Strong'} glow`} words="glow shadow" {onreset}>
  <div class="row">
    <div class="lbl">Colour</div>
    <ColourPick {el} prop="color" />
    {#if hard}
      <div class="alert">
        <div><b>Hard to read</b> on this theme's background.</div>
        <div class="two">
          <button class="small" onclick={() => ed.setProp(el.name, 'color', better, { literal: true })}>Use {better.startsWith('FFF') ? 'white' : 'black'}</button>
          <button class="small" onclick={() => ed.setGlow(el.name, 'shadow')}>Add a shadow</button>
        </div>
      </div>
    {/if}
  </div>
  <div class="row">
    <div class="lbl">Glow or shadow</div>
    <Seg label="Glow or shadow" options={GLOWS} value={glow} onpick={(g) => ed.setGlow(el.name, g)} />
  </div>
</Card>
