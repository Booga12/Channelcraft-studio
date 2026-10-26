<script lang="ts" module>
  import type { Design as D } from '$lib/theme/designs';
  import { backgroundSvg as bgSvg, decoSvg as deco } from '$lib/theme/designArt';

  // Each design's background is made once and kept (as the same data URL, so the browser keeps
  // the drawn picture too): opening a picker again doesn't redraw 43 backgrounds.
  const made = new Map<string, string>();
  // The whole design is the key, so a recoloured or changed design gets its own picture.
  const key = (d: D) => JSON.stringify(d);
  function backgroundOf(d: D): string {
    const k = key(d);
    let v = made.get(k);
    if (!v) {
      const u = (svg: string) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
      const top = deco(d);
      v = top ? `${u(top)}, ${u(bgSvg(d))}` : u(bgSvg(d));
      made.set(k, v);
    }
    return v;
  }
</script>

<script lang="ts">
  // A small picture of a design: its real background with the layout sketched on top.
  import type { Design } from '$lib/theme/designs';
  import { defaultGameLayout } from '$lib/theme/gameLayouts';

  let { design }: { design: Design } = $props();

  const bg = $derived(backgroundOf(design));
  const p = $derived(design.palette);
  const c = (h: string, a = 1) => `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;

  type R = [number, number, number, number, 'panel' | 'art' | 'list' | 'text' | 'accent'];
  // The design's game list layout: lists sit on a panel, logos are in the accent colour.
  const rects = $derived.by<R[]>(() =>
    defaultGameLayout(design.game).diagram.flatMap((r): R[] => {
      if (r.role === 'list') return [[r.x, r.y, r.w, r.h, 'panel'], [r.x + 0.015, r.y + 0.03, r.w - 0.03, r.h - 0.06, 'list']];
      return [[r.x, r.y, r.w, r.h, r.role === 'art' ? 'art' : r.role === 'logo' ? 'accent' : 'text']];
    }),
  );

  const fill = (k: R[4]) => (k === 'panel' ? c(p.text, 0.08) : k === 'art' ? c(p.dim, 0.55) : k === 'accent' ? c(p.accent, 0.95) : k === 'text' ? c(p.text, 0.55) : 'transparent');
</script>

<div class="thumb" style:background-image={bg}>
  <svg viewBox="0 0 160 90" aria-hidden="true">
    {#each rects as [x, y, w, h, k]}
      <rect x={x * 160} y={y * 90} width={w * 160} height={h * 90} rx={Math.min(design.radius / 8, 4)} fill={fill(k)} />
      {#if k === 'list'}
        {#each Array(Math.max(3, Math.floor((h * 90) / 8))) as _, i}
          <rect x={x * 160 + 2} y={y * 90 + 2 + i * 8} width={w * 160 - 4} height="4" rx="1" fill={i === 1 ? c(p.accent) : c(p.text, 0.35)} />
        {/each}
      {/if}
    {/each}
  </svg>
</div>

<style>
  .thumb {
    aspect-ratio: 16 / 9;
    background-size: cover;
    border-radius: 4px;
    overflow: hidden;
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
