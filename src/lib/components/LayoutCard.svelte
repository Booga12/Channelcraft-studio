<script lang="ts">
  // A layout as a little picture, drawn on a design's background in its colours.
  import type { Rect } from '$lib/theme/presets';
  import type { Design } from '$lib/theme/designs';
  import { backgroundSvg } from '$lib/theme/designArt';

  let { diagram, design, label, description = '', on = false, onclick }: { diagram: Rect[]; design: Design; label: string; description?: string; on?: boolean; onclick: () => void } = $props();

  const bg = $derived(`url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(backgroundSvg(design))}")`);
  const rgba = (h: string, a: number) => `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
  function fill(r: Rect) {
    const p = design.palette;
    return r.role === 'carousel' ? rgba(p.accent, 0.95) : r.role === 'art' ? rgba(p.text, 0.32) : r.role === 'logo' ? rgba(p.accent, 0.7) : r.role === 'list' ? rgba(p.bg, 0.7) : rgba(p.text, 0.45);
  }
</script>

<button type="button" class="lcard" class:on {onclick} title={description} aria-pressed={on}>
  <svg viewBox="0 0 160 90" aria-hidden="true" style:background-image={bg}>
    {#each diagram as r}
      <rect x={r.x * 160} y={r.y * 90} width={r.w * 160} height={r.h * 90} rx={Math.min(design.radius / 8, 4)} fill={fill(r)} />
      {#if r.role === 'list'}
        {#each Array(Math.max(2, Math.floor((r.h * 90) / 8))) as _, i}
          <rect x={r.x * 160 + 3} y={r.y * 90 + 3 + i * 8} width={r.w * 160 - 6} height="4" rx="1" fill={i === 1 ? rgba(design.palette.accent, 1) : rgba(design.palette.text, 0.4)} />
        {/each}
      {/if}
    {/each}
  </svg>
  <span class="name">{label}</span>
  {#if description}<small>{description}</small>{/if}
</button>

<style>
  .lcard {
    display: grid;
    gap: 4px;
    align-content: start;
    padding: 6px;
    text-align: left;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 8px;
    white-space: normal;
  }
  .lcard:hover {
    border-color: var(--brand);
  }
  .lcard.on {
    border-color: var(--brand);
    box-shadow: 0 0 0 1px var(--brand);
  }
  svg {
    width: 100%;
    aspect-ratio: 16 / 9;
    display: block;
    border-radius: 4px;
    background-size: cover;
  }
  .name {
    font-weight: 600;
    font-size: 12px;
  }
  small {
    color: var(--text-faint);
    font-size: 10.5px;
    line-height: 1.35;
  }
</style>
