<script lang="ts">
  // A text's colour and its effect (glow, shadow or outline), with a warning (and fixes) when it
  // is hard to read on the theme's background. Presets first, then sliders to fine-tune; the
  // preview draws the effect the way RetroBat does.
  import PaletteIcon from '@lucide/svelte/icons/palette';
  import { ed } from '$lib/editor.svelte';
  import { contrast } from '$lib/theme/presets';
  import { hex8, SHADOW_DIRS, shadowDir, TEXT_FX_KINDS, TEXT_FX_PRESETS, textFxOf, type TextFx, type TextFxKind } from '$lib/theme/simpleProps';
  import type { ResolvedElement } from '$lib/theme/resolver';
  import Card from './Card.svelte';
  import ColourPick from './ColourPick.svelte';
  import DirPad from './DirPad.svelte';
  import FxSwatches from './FxSwatches.svelte';
  import Seg from './Seg.svelte';

  let { el, onreset }: { el: ResolvedElement; onreset: (() => void) | null } = $props();

  const v = (p: string) => el.props.get(p)?.value;
  const fx = $derived(textFxOf(v('glowColor'), v('glowSize'), v('glowOffset')));
  const colour = $derived(hex8(v('color')) ?? 'FFFFFFFF');
  const bg = $derived(ed.designBackground);
  /** Under 3 is hard to read (a shadow or outline helps). */
  const hard = $derived(!!bg && contrast(colour.slice(0, 6), bg) < 3 && fx.kind !== 'shadow' && fx.kind !== 'outline' && !(fx.kind === 'glow' && fx.strength > 0.6));
  const better = $derived(bg && contrast('111111', bg) > contrast('FFFFFF', bg) ? '111111FF' : 'FFFFFFFF');
  const dir = $derived(shadowDir(fx.dx, fx.dy));
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const summary = $derived(fx.kind === 'none' ? '' : `${TEXT_FX_KINDS.find((k) => k.id === fx.kind)?.label}`);

  /** A good colour to start an effect with: the text's own for a glow, dark or light for the rest. */
  function startColour(kind: TextFxKind): string {
    if (kind === 'glow') return colour.slice(0, 6);
    return contrast(colour.slice(0, 6), '000000') > contrast(colour.slice(0, 6), 'FFFFFF') ? '000000' : 'FFFFFF';
  }

  function set(next: Partial<TextFx>, coalesce?: string) {
    ed.setTextFx(el.name, { ...fx, ...next }, coalesce);
  }

  function pickKind(kind: TextFxKind) {
    if (kind === fx.kind) return;
    if (kind === 'none') return set({ kind });
    const first = TEXT_FX_PRESETS[kind][kind === 'outline' ? 0 : 1].fx;
    set({ kind, color: fx.kind === 'none' || (fx.kind === 'glow') !== (kind === 'glow') ? startColour(kind) : fx.color, ...first });
  }

  function setDir(id: string) {
    const d = SHADOW_DIRS.find((x) => x.id === id)!;
    set({ dx: d.x * dir.distance, dy: d.y * dir.distance });
  }

  function setDistance(n: number) {
    const d = SHADOW_DIRS.find((x) => x.id === dir.dir)!;
    set({ dx: d.x * n, dy: d.y * n }, `fx.${el.name}.distance`);
  }

  const presetOn = (p: { fx: Omit<TextFx, 'kind' | 'color'> }) => Math.round(p.fx.size) === fx.size && Math.abs(p.fx.strength - fx.strength) < 0.04 && (fx.kind !== 'shadow' || (p.fx.dx === fx.dx && p.fx.dy === fx.dy));
</script>

<Card id="colour" title="Colour & glow" icon={PaletteIcon} {summary} words="glow shadow outline" {onreset}>
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
    <div class="lbl">Effect</div>
    <Seg label="Effect" options={TEXT_FX_KINDS} value={fx.kind} onpick={pickKind} />
  </div>

  {#if fx.kind !== 'none'}
    <div class="row">
      <div class="lbl">Quick picks</div>
      <div class="chips">
        {#each TEXT_FX_PRESETS[fx.kind] as p (p.id)}
          <button class="chip" class:on={presetOn(p)} onclick={() => set({ ...p.fx, dx: fx.kind === 'shadow' ? p.fx.dx : 0, dy: fx.kind === 'shadow' ? p.fx.dy : 0 })}>{p.label}</button>
        {/each}
      </div>
    </div>

    <div class="row">
      <div class="lbl">{fx.kind === 'outline' ? 'Line colour' : fx.kind === 'shadow' ? 'Shadow colour' : 'Glow colour'}</div>
      <FxSwatches value={fx.color} own={colour} onpick={(c) => set({ color: c })} />
    </div>

    {#if fx.kind === 'shadow'}
      <div class="row split">
        <div>
          <div class="lbl">Falls towards</div>
          <DirPad dirs={SHADOW_DIRS} value={dir.dir} onpick={setDir} />
        </div>
        <div class="grow">
          <div class="lbl">Distance <b>{dir.distance} px</b></div>
          <input type="range" min="1" max="14" step="1" value={dir.distance} aria-label="Shadow distance" oninput={(e) => setDistance(e.currentTarget.valueAsNumber)} />
          <div class="lbl">Softness <b>{fx.size}</b></div>
          <input type="range" min="1" max="6" step="1" value={fx.size} aria-label="Shadow softness" oninput={(e) => set({ size: e.currentTarget.valueAsNumber }, `fx.${el.name}.size`)} />
        </div>
      </div>
    {:else}
      <div class="row">
        <div class="lbl">{fx.kind === 'outline' ? 'Thickness' : 'Size'} <b>{fx.size} px</b></div>
        <input type="range" min="1" max={fx.kind === 'outline' ? 5 : 10} step="1" value={fx.size} aria-label={fx.kind === 'outline' ? 'Outline thickness' : 'Glow size'} oninput={(e) => set({ size: e.currentTarget.valueAsNumber }, `fx.${el.name}.size`)} />
      </div>
    {/if}

    {#if fx.kind !== 'outline'}
      <div class="row">
        <div class="lbl">Strength <b>{pct(fx.strength)}</b></div>
        <input type="range" min="0.1" max="0.95" step="0.05" value={fx.strength} aria-label="Strength" oninput={(e) => set({ strength: e.currentTarget.valueAsNumber }, `fx.${el.name}.strength`)} />
      </div>
    {/if}
    <p class="note">The preview draws this the way RetroBat does, so what you see here is what you get on the TV.</p>
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
  .split {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .grow {
    flex: 1;
    display: grid;
    gap: 4px;
  }
  input[type='range'] {
    width: 100%;
  }
</style>
