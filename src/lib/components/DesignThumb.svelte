<script lang="ts">
  // A small picture of a design: its real background with the layout sketched on top.
  import { designAssets, type Design } from '$lib/theme/designs';

  let { design }: { design: Design } = $props();

  const bg = $derived(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(designAssets(design)['background.svg'])}`);
  const p = $derived(design.palette);
  const c = (h: string, a = 1) => `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;

  type R = [number, number, number, number, 'panel' | 'art' | 'list' | 'text' | 'accent'];
  const rects = $derived.by<R[]>(() => {
    switch (design.game) {
      case 'cinema':
        return [
          [0.05, 0.09, 0.3, 0.12, 'accent'],
          [0.05, 0.27, 0.36, 0.04, 'text'],
          [0.05, 0.46, 0.4, 0.14, 'text'],
          [0.05, 0.67, 0.2, 0.2, 'art'],
          [0.65, 0.14, 0.32, 0.74, 'panel'],
          [0.67, 0.18, 0.28, 0.6, 'list'],
        ];
      case 'cover':
        return [
          [0.07, 0.19, 0.3, 0.56, 'art'],
          [0.41, 0.12, 0.24, 0.8, 'panel'],
          [0.43, 0.26, 0.2, 0.05, 'text'],
          [0.67, 0.12, 0.3, 0.8, 'panel'],
          [0.69, 0.16, 0.26, 0.6, 'list'],
        ];
      case 'centered':
        return [
          [0.08, 0.13, 0.84, 0.42, 'panel'],
          [0.13, 0.17, 0.14, 0.34, 'art'],
          [0.33, 0.17, 0.34, 0.34, 'art'],
          [0.2, 0.58, 0.6, 0.05, 'text'],
          [0.25, 0.75, 0.5, 0.18, 'panel'],
          [0.3, 0.78, 0.4, 0.12, 'list'],
        ];
      default:
        return [
          [0.03, 0.14, 0.46, 0.78, 'panel'],
          [0.05, 0.17, 0.3, 0.05, 'text'],
          [0.06, 0.26, 0.16, 0.3, 'art'],
          [0.25, 0.26, 0.21, 0.3, 'art'],
          [0.05, 0.7, 0.42, 0.16, 'text'],
          [0.52, 0.14, 0.45, 0.78, 'panel'],
          [0.54, 0.18, 0.41, 0.66, 'list'],
        ];
    }
  });

  const fill = (k: R[4]) => (k === 'panel' ? c(p.text, 0.08) : k === 'art' ? c(p.dim, 0.55) : k === 'accent' ? c(p.accent, 0.95) : k === 'text' ? c(p.text, 0.55) : 'transparent');
</script>

<div class="thumb" style:background-image="url(&quot;{bg}&quot;)">
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
