<script lang="ts">
  // The splash shown while the app starts (#48): the brush logo paints itself in, stroke by
  // stroke, with the name and version under it, then the whole thing fades into Home.
  import { fade } from 'svelte/transition';
  import { getVersion } from '@tauri-apps/api/app';
  import { logoColour, logoSvg } from '$lib/logo';
  import { prefs } from '$lib/prefs.svelte';

  let version = $state('');
  getVersion().then((v) => (version = v)).catch(() => {});

  /**
   * The logo with each brush stroke revealed by a mask: a thick line along the middle of the
   * stroke that is drawn from its blob to its drip.
   */
  function paintedLogo(id: string): string {
    const svg = logoSvg(id).replace(/id="g"/, 'id="spl-g"').replace(/url\(#g\)/g, 'url(#spl-g)');
    const grad = svg.match(/<linearGradient[\s\S]*?<\/linearGradient>/)?.[0] ?? '';
    const rect = svg.match(/<rect[^>]*\/>/)?.[0] ?? '';
    const group = svg.match(/<g transform="([^"]*)">([\s\S]*?)<\/g>/);
    if (!group) return svg;
    // Each stroke: its outline path and the circles after it (the blob and the drip).
    const parts = group[2].split(/(?=<path )/).filter((p) => p.trim());
    const masks: string[] = [];
    const shapes: string[] = [];
    parts.forEach((part, i) => {
      const d = part.match(/d="([^"]*)"/)?.[1] ?? '';
      const pts = [...d.matchAll(/([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
      const half = Math.floor(pts.length / 2);
      // The outline goes along one edge and back along the other: the middle line is halfway.
      const mid = Array.from({ length: half }, (_, k) => {
        const [a, b] = [pts[k], pts[pts.length - 1 - k]];
        return `${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2).toFixed(1)}`;
      });
      masks.push(`<mask id="spl-m${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><path class="draw d${i}" d="M ${mid.join(' L ')}" pathLength="1" fill="none" stroke="#fff" stroke-width="150" stroke-linecap="round" stroke-linejoin="round"/></mask>`);
      shapes.push(`<g mask="url(#spl-m${i})">${part.trim()}</g>`);
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>${grad}</defs><g class="tile">${rect}</g><g transform="${group[1]}">${masks.join('')}${shapes.join('')}</g></svg>`;
  }

  const logo = $derived(paintedLogo(prefs.v.logoColour));
  const stops = $derived(logoColour(prefs.v.logoColour).stops);
</script>

<div class="splash" role="status" aria-label="ChannelCraft Studio is starting" out:fade={{ duration: 450 }}>
  <div class="logo" aria-hidden="true">{@html logo}</div>
  <div class="name">ChannelCraft Studio</div>
  <div class="version">{version ? `Version ${version}` : ' '}</div>
  <div class="line" style:--a={stops[0]} style:--b={stops[stops.length - 1]}><span></span></div>
</div>

<style>
  .splash {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: var(--background);
    color: var(--foreground);
  }
  .logo {
    width: 132px;
    height: 132px;
    margin-bottom: 18px;
    filter: drop-shadow(0 10px 30px rgb(0 0 0 / 0.35));
  }
  .logo :global(svg) {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  /* The tile pops in, then each stroke is painted from its blob to its drip. */
  .logo :global(.tile) {
    transform-origin: 512px 512px;
    animation: pop 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  }
  .logo :global(.draw) {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: paint 0.75s cubic-bezier(0.55, 0, 0.3, 1) forwards;
  }
  .logo :global(.d0) {
    animation-delay: 0.3s;
  }
  .logo :global(.d1) {
    animation-delay: 0.8s;
    animation-duration: 0.55s;
  }
  .name {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
    animation: rise 0.5s ease-out 0.9s both;
  }
  .version {
    font-size: 12px;
    color: var(--muted-foreground);
    animation: rise 0.5s ease-out 1s both;
  }
  .line {
    position: relative;
    width: 160px;
    height: 3px;
    margin-top: 18px;
    overflow: hidden;
    border-radius: 999px;
    background: color-mix(in oklab, var(--foreground) 10%, transparent);
    animation: rise 0.5s ease-out 1.1s both;
  }
  .line span {
    position: absolute;
    inset: 0 auto 0 0;
    width: 40%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--a), var(--b));
    animation: slide 1.1s ease-in-out infinite;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.7);
    }
  }
  @keyframes paint {
    to {
      stroke-dashoffset: 0;
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  @keyframes slide {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(250%);
    }
  }
  /* Less motion asked for in Windows: the logo just appears. */
  @media (prefers-reduced-motion: reduce) {
    .logo :global(.draw) {
      animation: none;
      stroke-dashoffset: 0;
    }
    .logo :global(.tile),
    .name,
    .version,
    .line {
      animation: none;
    }
    .line span {
      animation-duration: 2.4s;
    }
  }
</style>
