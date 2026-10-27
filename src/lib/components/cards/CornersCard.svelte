<script lang="ts">
  // Rounded corners and one effect for a picture: RetroBat's drop shadow, a coloured glow round
  // its edges, or a frame (a border with a shadow). Presets first, sliders to fine-tune.
  import CornerIcon from '@lucide/svelte/icons/square-round-corner';
  import { ed } from '$lib/editor.svelte';
  import { SHADOW_TYPES, shaderOf } from '$lib/theme/shadow';
  import { FRAME_DEFAULT, frameOf, type Frame } from '$lib/theme/frame';
  import type { ResolvedElement } from '$lib/theme/resolver';
  import Card from './Card.svelte';
  import FxSwatches from './FxSwatches.svelte';
  import Seg from './Seg.svelte';

  let { el }: { el: ResolvedElement } = $props();

  type Kind = 'none' | 'shadow' | 'glow' | 'frame';
  const frame = $derived(frameOf(el));
  const shader = $derived(!frame ? shaderOf(el) : null);
  const otherShader = $derived(!!shader && !shader.shadow);
  const canShadow = $derived(SHADOW_TYPES.has(el.type));
  const corners = $derived(frame ? frame.frame.corners : parseFloat(el.props.get('roundCorners')?.value ?? '0') || 0);
  const kind = $derived<Kind>(frame ? (frame.frame.border <= 0 && frame.frame.shadow > 0 ? 'glow' : 'frame') : shader?.shadow ? 'shadow' : 'none');
  const kinds = $derived([
    { id: 'none' as const, label: 'None', title: 'No effect' },
    ...(canShadow ? [{ id: 'shadow' as const, label: 'Shadow', title: 'A soft shadow under the picture (works on any picture, logos too)' }] : []),
    { id: 'glow' as const, label: 'Glow', title: 'Coloured light round the edges (pictures with solid corners)' },
    { id: 'frame' as const, label: 'Frame', title: 'A border with a shadow (pictures with solid corners)' },
  ]);

  /** A colour as shown: a shared colour shows its current value. */
  const shown = (v: string) => {
    const m = v.match(/^\$\{([^}]+)\}$/);
    return m ? (ed.res?.vars.get(m[1])?.value ?? 'FFFFFFFF') : v;
  };
  const alphaOf = (v: string) => {
    const t = shown(v);
    return t.length >= 8 ? parseInt(t.slice(6, 8), 16) / 255 : 1;
  };
  const hexA = (a: number) => Math.max(1, Math.min(255, Math.round(a * 255))).toString(16).padStart(2, '0').toUpperCase();
  const accent = $derived((ed.res?.vars.get('designAccent')?.value ?? 'FFFFFF').slice(0, 6));

  const change = (part: Partial<Frame>, key?: string) => frame && ed.setFrame(el.name, { ...frame.frame, ...part }, key ? `frame.${el.name}.${key}` : undefined);
  const shadowDist = $derived(shader?.shadow ? Math.abs(shader.offset) : 6);
  const shadowUp = $derived(!!shader?.shadow && shader.offset < 0);

  const GLOWS = [
    { id: 'soft', label: 'Soft', size: 10, a: 0.45 },
    { id: 'bright', label: 'Bright', size: 16, a: 0.7 },
    { id: 'neon', label: 'Neon', size: 24, a: 0.9 },
  ];
  const SHADOWS = [
    { id: 'soft', label: 'Soft', d: 6 },
    { id: 'lifted', label: 'Lifted', d: 12 },
    { id: 'floating', label: 'Floating', d: 20 },
  ];
  const FRAMES = [
    { id: 'thin', label: 'Thin', border: 2, shadow: 8 },
    { id: 'classic', label: 'Classic', border: 4, shadow: 12 },
    { id: 'chunky', label: 'Chunky', border: 8, shadow: 16 },
  ];

  function pick(k: Kind) {
    if (k === kind) return;
    const c = corners || FRAME_DEFAULT.corners;
    if (k === 'none') {
      if (frame) ed.setFrame(el.name, null);
      else if (shader?.shadow) ed.setShadow(el.name, null);
    } else if (k === 'shadow') {
      ed.group(`shadow on ${el.name}`, () => {
        if (frame) ed.setFrame(el.name, null);
        ed.setShadow(el.name, 6);
      });
    } else if (k === 'glow') {
      // A frame takes the shadow's place by itself.
      ed.setFrame(el.name, { corners: c, border: 0, borderColor: 'FFFFFF00', shadow: 14, shadowColor: `${accent}${hexA(0.6)}` });
    } else {
      ed.setFrame(el.name, { ...FRAME_DEFAULT, corners: c });
    }
  }
</script>

<Card id="corners" title="Corners, glow & shadow" icon={CornerIcon} summary={kind === 'none' ? '' : kinds.find((k) => k.id === kind)?.label} words="border frame glow shadow">
  <div class="row">
    <div class="lbl">Rounded corners <b>{corners ? `${Math.round(corners * 400)}%` : 'square'}</b></div>
    <input type="range" min="0" max="0.25" step="0.005" value={corners} aria-label="Rounded corners" oninput={(e) => ed.setCorners(el.name, e.currentTarget.valueAsNumber, `corners.${el.name}`)} />
  </div>

  {#if otherShader}
    <p class="note">This uses another RetroBat effect, so it can't have a shadow, glow or frame too.</p>
  {:else}
    <div class="row">
      <div class="lbl">Effect</div>
      <Seg label="Effect" options={kinds} value={kind} onpick={pick} />
    </div>

    {#if kind === 'shadow' && shader}
      <div class="row">
        <div class="lbl">Quick picks</div>
        <div class="chips">
          {#each SHADOWS as s (s.id)}
            <button class="chip" class:on={shadowDist === s.d} onclick={() => ed.setShadow(el.name, shadowUp ? -s.d : s.d)}>{s.label}</button>
          {/each}
        </div>
      </div>
      <div class="row">
        <div class="lbl">Falls towards</div>
        <Seg
          label="Shadow direction"
          options={[
            { id: 'down', label: '↘ Down and right' },
            { id: 'up', label: '↖ Up and left' },
          ]}
          value={shadowUp ? 'up' : 'down'}
          onpick={(d) => ed.setShadow(el.name, d === 'up' ? -shadowDist : shadowDist)}
        />
      </div>
      <div class="row">
        <div class="lbl">Distance <b>{shadowDist} px</b></div>
        <input type="range" min="2" max="30" step="1" value={shadowDist} aria-label="Shadow distance" oninput={(e) => ed.setShadow(el.name, (shadowUp ? -1 : 1) * e.currentTarget.valueAsNumber, `shadow.${el.name}`)} />
      </div>
      <p class="note">RetroBat's shadow is always soft black and makes the picture a little smaller to fit it. Works on any picture, logos included.</p>
    {:else if kind === 'glow' && frame}
      <div class="row">
        <div class="lbl">Quick picks</div>
        <div class="chips">
          {#each GLOWS as g (g.id)}
            <button class="chip" class:on={frame.frame.shadow === g.size && Math.abs(alphaOf(frame.frame.shadowColor) - g.a) < 0.05} onclick={() => change({ shadow: g.size, shadowColor: shown(frame.frame.shadowColor).slice(0, 6) + hexA(g.a) })}>{g.label}</button>
          {/each}
        </div>
      </div>
      <div class="row">
        <div class="lbl">Glow colour</div>
        <FxSwatches value={shown(frame.frame.shadowColor).slice(0, 6)} onpick={(c) => change({ shadowColor: c + hexA(alphaOf(frame.frame.shadowColor)) })} />
      </div>
      <div class="row">
        <div class="lbl">Size <b>{frame.frame.shadow} px</b></div>
        <input type="range" min="4" max="40" step="1" value={frame.frame.shadow} aria-label="Glow size" oninput={(e) => change({ shadow: e.currentTarget.valueAsNumber }, 'size')} />
      </div>
      <div class="row">
        <div class="lbl">Strength <b>{Math.round(alphaOf(frame.frame.shadowColor) * 100)}%</b></div>
        <input type="range" min="0.1" max="1" step="0.05" value={alphaOf(frame.frame.shadowColor)} aria-label="Glow strength" oninput={(e) => change({ shadowColor: shown(frame.frame.shadowColor).slice(0, 6) + hexA(e.currentTarget.valueAsNumber) }, 'alpha')} />
      </div>
      <p class="note">Suits box art, screenshots and videos. RetroBat leaves pictures with see-through corners (most logos) plain; give those a Shadow instead.</p>
    {:else if kind === 'frame' && frame}
      <div class="row">
        <div class="lbl">Quick picks</div>
        <div class="chips">
          {#each FRAMES as f (f.id)}
            <button class="chip" class:on={frame.frame.border === f.border && frame.frame.shadow === f.shadow} onclick={() => change({ border: f.border, shadow: f.shadow })}>{f.label}</button>
          {/each}
        </div>
      </div>
      <div class="row">
        <div class="lbl">Border colour</div>
        <FxSwatches value={shown(frame.frame.borderColor).slice(0, 6)} onpick={(c) => change({ borderColor: c + hexA(alphaOf(frame.frame.borderColor)) })} />
      </div>
      <div class="row">
        <div class="lbl">Border <b>{frame.frame.border} px</b></div>
        <input type="range" min="1" max="16" step="1" value={frame.frame.border} aria-label="Border" oninput={(e) => change({ border: e.currentTarget.valueAsNumber }, 'border')} />
      </div>
      <div class="row">
        <div class="lbl">Shadow <b>{frame.frame.shadow ? `${frame.frame.shadow} px` : 'none'}</b></div>
        <input type="range" min="0" max="30" step="1" value={frame.frame.shadow} aria-label="Frame shadow" oninput={(e) => change({ shadow: e.currentTarget.valueAsNumber }, 'shadow')} />
      </div>
      <div class="row">
        <div class="lbl">Shadow colour</div>
        <FxSwatches value={shown(frame.frame.shadowColor).slice(0, 6)} onpick={(c) => change({ shadowColor: c + hexA(alphaOf(frame.frame.shadowColor)) })} />
      </div>
      <p class="note">Suits box art, screenshots and videos. RetroBat leaves pictures with see-through corners (most logos) plain; give those a Shadow instead.</p>
    {/if}
  {/if}
</Card>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .chip {
    padding: 3px 10px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg);
    color: var(--text-dim);
    font-size: 11.5px;
    font-weight: 600;
  }
  .chip:hover {
    color: var(--text);
    border-color: var(--brand);
  }
  .chip.on {
    color: var(--brand);
    border-color: var(--brand);
  }
  input[type='range'] {
    width: 100%;
  }
</style>
