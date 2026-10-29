// The app logo (the brush "Cc") in the colour picked in Settings > Appearance.
// The SVG is the one the app icons are made from; only its gradient changes.

import source from '$lib/assets/logo.svg?raw';

export const LOGO_COLOURS: Record<string, { label: string; stops: string[] }> = {
  aurora: { label: 'Aurora', stops: ['#3fd68a', '#1fa6c9', '#5047d1'] },
  original: { label: 'Original', stops: ['#2f7cf6', '#5a5fe6', '#8447d9'] },
  sunset: { label: 'Sunset', stops: ['#ff8a3d', '#f2477e', '#8e3fd6'] },
  ocean: { label: 'Ocean', stops: ['#16c2c9', '#1f86e0', '#2b4fc4'] },
  synthwave: { label: 'Synthwave', stops: ['#ff3d9a', '#a64be8', '#22c4f0'] },
  ember: { label: 'Ember', stops: ['#e8344e', '#f26a2e', '#f7a531'] },
  berry: { label: 'Berry', stops: ['#f0479c', '#b23cc4', '#6a2fb8'] },
  lagoon: { label: 'Lagoon', stops: ['#9bdc3c', '#2fc79a', '#1797b8'] },
  midnight: { label: 'Midnight', stops: ['#1d2b64', '#2f3d8f', '#4c3fa8'] },
  graphite: { label: 'Graphite', stops: ['#3a3d46', '#24262d', '#121318'] },
};

/** The colour built into the app's icon files (shortcuts, Start menu, installer). */
export const DEFAULT_LOGO: string = 'aurora';

export function logoColour(id: string) {
  return LOGO_COLOURS[id] ?? LOGO_COLOURS[DEFAULT_LOGO];
}

/** The logo's SVG in one of the colours. */
export function logoSvg(id: string): string {
  const stops = logoColour(id).stops
    .map((c, i, all) => `<stop offset="${(i / (all.length - 1)).toFixed(2)}" stop-color="${c}"/>`)
    .join('');
  return source.replace(/(<linearGradient id="g"[^>]*>)[\s\S]*?(<\/linearGradient>)/, `$1${stops}$2`);
}

/** The logo as an image URL. */
export function logoUrl(id: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(logoSvg(id));
}

/** CSS gradient of a logo colour, for its swatch. */
export function logoGradient(id: string): string {
  return `linear-gradient(135deg, ${logoColour(id).stops.join(', ')})`;
}

let shown: string | null = null;

/** Gives the window (title bar and taskbar) the logo in the picked colour. */
export async function applyWindowLogo(id: string) {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;
  if (shown === id || (shown === null && id === DEFAULT_LOGO)) return; // the built-in icon already is Aurora
  shown = id;
  try {
    const size = 256;
    const img = new window.Image();
    img.src = logoUrl(id);
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, size, size);
    const rgba = new Uint8Array(ctx.getImageData(0, 0, size, size).data.buffer);
    const [{ getCurrentWindow }, { Image }] = await Promise.all([import('@tauri-apps/api/window'), import('@tauri-apps/api/image')]);
    if (shown !== id) return; // picked another colour meanwhile
    await getCurrentWindow().setIcon(await Image.new(rgba, size, size));
  } catch {
    // The window keeps the icon it has.
  }
}
