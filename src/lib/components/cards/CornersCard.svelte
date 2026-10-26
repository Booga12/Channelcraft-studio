<script lang="ts">
  // Rounded corners, RetroBat's soft shadow, and its frame (a border with a drop shadow).
  import CornerIcon from '@lucide/svelte/icons/square-round-corner';
  import { ed } from '$lib/editor.svelte';
  import { SHADOW_TYPES, shaderOf } from '$lib/theme/shadow';
  import { FRAME_DEFAULT, frameOf, type Frame } from '$lib/theme/frame';
  import type { ResolvedElement } from '$lib/theme/resolver';
  import ColorInput from '../ColorInput.svelte';
  import Card from './Card.svelte';
  import Seg from './Seg.svelte';

  let { el }: { el: ResolvedElement } = $props();

  const frame = $derived(frameOf(el));
  const shader = $derived(SHADOW_TYPES.has(el.type) && !frame ? shaderOf(el) : null);
  const otherShader = $derived(!frame && !!shaderOf(el) && !shaderOf(el)?.shadow);
  const corners = $derived(frame ? frame.frame.corners : parseFloat(el.props.get('roundCorners')?.value ?? '0') || 0);
  type Shadow = 'none' | 'soft' | 'strong';
  const shadow = $derived<Shadow>(!shader ? 'none' : shader.offset <= 8 ? 'soft' : 'strong');
  const OFFSETS: Record<Shadow, number | null> = { none: null, soft: 6, strong: 14 };
  /** A colour as shown in the picker: a shared colour shows its current value. */
  const shown = (v: string) => {
    const m = v.match(/^\$\{([^}]+)\}$/);
    return m ? (ed.res?.vars.get(m[1])?.value ?? 'FFFFFFFF') : v;
  };
  const change = (part: Partial<Frame>) => frame && ed.setFrame(el.name, { ...frame.frame, ...part }, `frame.${el.name}`);
</script>

<Card id="corners" title="Corners & shadow" icon={CornerIcon} summary={frame ? 'Frame' : shadow === 'none' ? '' : `${shadow === 'soft' ? 'Soft' : 'Strong'} shadow`} words="border frame">
  <div class="row">
    <div class="lbl">Rounded corners <b>{corners ? `${Math.round(corners * 400)}%` : 'square'}</b></div>
    <input type="range" min="0" max="0.25" step="0.005" value={corners} aria-label="Rounded corners" oninput={(e) => ed.setCorners(el.name, e.currentTarget.valueAsNumber, `corners.${el.name}`)} />
  </div>

  {#if otherShader}
    <p class="note">This uses another RetroBat effect, so it can't have a shadow or frame too.</p>
  {:else}
    {#if SHADOW_TYPES.has(el.type) && !frame}
      <div class="row">
        <div class="lbl">Shadow</div>
        <Seg
          label="Shadow"
          options={[
            { id: 'none', label: 'None' },
            { id: 'soft', label: 'Soft' },
            { id: 'strong', label: 'Strong' },
          ]}
          value={shadow}
          onpick={(s) => ed.setShadow(el.name, OFFSETS[s])}
        />
      </div>
    {/if}
    <label class="switch">
      <span>Frame: a border and drop shadow</span>
      <input type="checkbox" checked={!!frame} onchange={(e) => ed.setFrame(el.name, e.currentTarget.checked ? { ...FRAME_DEFAULT, corners: corners || FRAME_DEFAULT.corners } : null)} />
    </label>
    {#if frame}
      <div class="row">
        <div class="lbl">Border <b>{frame.frame.border} px</b></div>
        <input type="range" min="0" max="12" step="1" value={frame.frame.border} aria-label="Border" oninput={(e) => change({ border: e.currentTarget.valueAsNumber })} />
      </div>
      <div class="row"><div class="lbl">Border colour</div><ColorInput value={shown(frame.frame.borderColor)} onchange={(v) => change({ borderColor: v })} /></div>
      <div class="row">
        <div class="lbl">Shadow <b>{frame.frame.shadow} px</b></div>
        <input type="range" min="0" max="30" step="1" value={frame.frame.shadow} aria-label="Frame shadow" oninput={(e) => change({ shadow: e.currentTarget.valueAsNumber })} />
      </div>
      <p class="note">Suits screenshots, videos and box art. RetroBat skips the frame on pictures with see-through corners (most logos); give those the soft shadow instead.</p>
    {/if}
  {/if}
</Card>
