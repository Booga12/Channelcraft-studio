<script lang="ts">
  // Where a part sits without numbers: snap to a spot, nudge, size (pictures), what's in front and
  // behind, and how see-through it is.
  import MoveIcon from '@lucide/svelte/icons/move';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import BringToFront from '@lucide/svelte/icons/bring-to-front';
  import SendToBack from '@lucide/svelte/icons/send-to-back';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { ed } from '$lib/editor.svelte';
  import { elementLabel } from '$lib/friendly';
  import { fmtNum } from '$lib/theme/schema';
  import { PICTURE_TYPES, pictureSize, resized, snappedAt, type SnapX, type SnapY } from '$lib/theme/simpleProps';
  import type { ResolvedElement } from '$lib/theme/resolver';
  import Card from './Card.svelte';

  let { el, onreset }: { el: ResolvedElement; onreset: (() => void) | null } = $props();

  const locked = $derived(!!ed.locked[el.name]);
  const rect = $derived(ed.rects[el.name]);
  const at = $derived(rect ? snappedAt(rect) : null);
  const spots: { x: SnapX; y: SnapY; name: string }[] = (['top', 'middle', 'bottom'] as SnapY[]).flatMap((y) =>
    (['left', 'center', 'right'] as SnapX[]).map((x) => ({ x, y, name: y === 'middle' && x === 'center' ? 'the middle' : `the ${y === 'middle' ? 'middle' : y}${x === 'center' ? '' : ` ${x}`}` })),
  );
  const size = $derived(PICTURE_TYPES.has(el.type) ? pictureSize(el) : null);
  const opacity = $derived(Math.min(1, Math.max(0, parseFloat(el.props.get('opacity')?.value ?? '1') || 0)));

  // Layers next to this one, top first.
  const layers = $derived(ed.layers);
  const idx = $derived(layers.findIndex((l) => l.name === el.name));
  const near = $derived(layers.slice(Math.max(0, idx - 2), idx + 3));
  const above = $derived(Math.max(0, idx - 2));
  const below = $derived(Math.max(0, layers.length - (idx + 3)));
  // The snap spots are one Tab stop (the spot it sits at, or the top left); the arrow keys move
  // round the 3 by 3 grid and Enter or Space snaps.
  const stop = $derived(Math.max(0, spots.findIndex((s) => at?.x === s.x && at?.y === s.y)));
  function rove(e: KeyboardEvent, i: number) {
    const [dx, dy] = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key] ?? [0, 0];
    if (!dx && !dy) return;
    // Kept from the editor's own arrow keys (they would nudge the part).
    e.preventDefault();
    e.stopPropagation();
    const x = (i % 3) + dx;
    const y = Math.floor(i / 3) + dy;
    if (x < 0 || x > 2 || y < 0 || y > 2) return;
    ((e.currentTarget as HTMLElement).parentElement!.children[y * 3 + x] as HTMLElement).focus();
  }
  const place = $derived(idx <= 0 ? 'Top layer' : idx === layers.length - 1 ? 'Bottom layer' : `${idx + 1} of ${layers.length}`);
</script>

<Card id="position" title="Position & layers" icon={MoveIcon} summary={place} words="layer front behind see-through" {onreset}>
  {#if locked}
    <div class="alert">
      <div><b>Locked</b>, so it can't be moved by accident.</div>
      <button
        class="small"
        onclick={() => {
          ed.setLocked(el.name, false);
          ed.selection = [el.name];
        }}>Unlock</button
      >
    </div>
  {/if}

  <div class="place">
    <div class="row">
      <div class="lbl">Snap to</div>
      <div class="snap">
        {#each spots as s, i (s.x + s.y)}
          <button
            class:on={at?.x === s.x && at?.y === s.y}
            aria-current={at?.x === s.x && at?.y === s.y ? 'true' : undefined}
            tabindex={i === stop ? 0 : -1}
            disabled={locked || !rect}
            title="Move to {s.name}"
            aria-label="Move to {s.name}"
            onclick={() => ed.snapTo(el.name, s.x, s.y)}
            onkeydown={(e) => rove(e, i)}><span></span></button
          >
        {/each}
      </div>
    </div>
    <div class="row">
      <div class="lbl">Nudge</div>
      <div class="nudge">
        <button class="u" disabled={locked} title="Up (↑)" aria-label="Nudge up" onclick={() => ed.nudge(0, -0.01)}><ArrowUp size={12} /></button>
        <button class="l" disabled={locked} title="Left (←)" aria-label="Nudge left" onclick={() => ed.nudge(-0.01, 0)}><ArrowLeft size={12} /></button>
        <button class="d" disabled={locked} title="Down (↓)" aria-label="Nudge down" onclick={() => ed.nudge(0, 0.01)}><ArrowDown size={12} /></button>
        <button class="r" disabled={locked} title="Right (→)" aria-label="Nudge right" onclick={() => ed.nudge(0.01, 0)}><ArrowRight size={12} /></button>
      </div>
    </div>
  </div>
  <p class="note">Or drag it in the preview. Arrow keys nudge it; hold Shift to move further.</p>

  {#if size}
    <div class="row">
      <div class="lbl">Size <b>{Math.round((size.w || size.h) * 100)}% of the screen {size.w ? 'wide' : 'high'}</b></div>
      <input
        type="range"
        min="0.03"
        max="1"
        step="0.005"
        value={size.w || size.h}
        aria-label="Size"
        disabled={locked}
        oninput={(e) => ed.setProp(el.name, size.prop, resized(size, e.currentTarget.valueAsNumber), { coalesce: `resize.${el.name}` })}
      />
    </div>
  {/if}

  <div class="row">
    <div class="lbl">In front or behind</div>
    <div class="stack">
      {#if above}<div class="more">{above} more above</div>{/if}
      {#each near as l (l.name)}
        <button class:me={l.name === el.name} aria-current={l.name === el.name ? 'true' : undefined} onclick={() => ed.select(l.name)} title={l.name === el.name ? 'This part' : `Pick ${elementLabel(l.name)}`}>{elementLabel(l.name)}{ed.locked[l.name] ? ' · locked' : ''}</button>
      {/each}
      {#if below}<div class="more">{below} more below</div>{/if}
    </div>
    <div class="order">
      <button class="small" disabled={idx <= 0} onclick={() => ed.arrange('front')}><BringToFront size={13} /> To the front</button>
      <button class="small" disabled={idx <= 0} onclick={() => ed.arrange('forward')}><ChevronUp size={13} /> Forward</button>
      <button class="small" disabled={idx >= layers.length - 1} onclick={() => ed.arrange('back')}><SendToBack size={13} /> Behind everything</button>
      <button class="small" disabled={idx >= layers.length - 1} onclick={() => ed.arrange('backward')}><ChevronDown size={13} /> Backward</button>
    </div>
  </div>

  <div class="row">
    <div class="lbl">See-through <b>{Math.round((1 - opacity) * 100)}%</b></div>
    <input type="range" min="0" max="1" step="0.05" value={1 - opacity} aria-label="See-through" oninput={(e) => ed.setProp(el.name, 'opacity', fmtNum(Math.round((1 - e.currentTarget.valueAsNumber) * 100) / 100), { coalesce: `opacity.${el.name}` })} />
  </div>
</Card>

<style>
  .place {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
  }
  .snap {
    display: grid;
    grid-template-columns: repeat(3, 30px);
    gap: 4px;
  }
  .snap button {
    height: 24px;
    padding: 0;
    border: 1px solid var(--line-strong);
    background: var(--bg);
    border-radius: 6px;
    display: grid;
    place-items: center;
  }
  .snap button span {
    width: 7px;
    height: 7px;
    border-radius: 2px;
    background: var(--text-faint);
  }
  .snap button.on {
    border-color: var(--brand);
  }
  .snap button.on span {
    background: var(--brand);
  }
  .nudge {
    display: grid;
    grid-template-columns: repeat(3, 26px);
    grid-template-rows: repeat(2, 24px);
    gap: 3px;
  }
  .nudge button {
    padding: 0;
    display: grid;
    place-items: center;
  }
  .nudge .u {
    grid-column: 2;
  }
  .nudge .l {
    grid-column: 1;
    grid-row: 2;
  }
  .nudge .d {
    grid-column: 2;
    grid-row: 2;
  }
  .nudge .r {
    grid-column: 3;
    grid-row: 2;
  }
  .stack {
    display: grid;
    gap: 3px;
  }
  .stack button {
    text-align: left;
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--bg);
    font-size: 12px;
    color: var(--text-faint);
    border: 1px solid var(--line);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .stack button.me {
    color: var(--text);
    border-color: var(--brand);
    background: var(--brand-soft);
    font-weight: 600;
  }
  .stack .more {
    font-size: 11px;
    color: var(--text-faint);
    padding-left: 8px;
  }
  .order {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 6px;
  }
  .order button {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    justify-content: center;
  }
</style>
