// The start-up splash's logo (#61): the brush logo with each stroke revealed by a mask, so it can
// paint itself in. static/splash.html carries a copy (the splash window loads before the app);
// splashLogo.test.ts keeps that copy in step with this.

import { logoSvg } from '$lib/logo';

/**
 * The logo with each brush stroke revealed by a mask: a thick line along the middle of the
 * stroke that is drawn from its blob to its drip.
 */
export function paintedLogo(id: string): string {
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
