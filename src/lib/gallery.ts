// Publishing a theme to the gallery on the website (the upload itself is in src-tauri/src/gallery.rs).

/**
 * The website the gallery is on (the same as GALLERY_SITE in src-tauri/src/gallery.rs). In
 * development VITE_GALLERY_SITE can point it at a local website dev server.
 */
export const GALLERY_SITE: string = (import.meta.env.DEV && import.meta.env.VITE_GALLERY_SITE) || 'https://channelcraft-website.fatbooga6.workers.dev';

export const NAME_MAX = 60;
export const MAKER_MAX = 40;

/** What's wrong with a theme name or maker name, or null when it's fine. */
export function nameProblem(value: string, what: 'theme' | 'maker'): string | null {
  const v = value.trim();
  const max = what === 'theme' ? NAME_MAX : MAKER_MAX;
  if (!v) return what === 'theme' ? 'Give the theme a name.' : 'Say who made it.';
  if (v.length > max) return `Keep it to ${max} characters or fewer.`;
  return null;
}

/** The sentence about files left out of a published theme, or null when none were. */
export function leftOutNote(files: readonly string[] | undefined, shown = 3): string | null {
  const n = files?.length ?? 0;
  if (!files || !n) return null;
  const names = files.slice(0, shown).map((f) => f.split('/').pop() || f);
  const list = names.join(', ') + (n > shown ? ', …' : '.');
  return n === 1 ? `1 file the gallery doesn’t take was left out: ${list}` : `${n} files the gallery doesn’t take were left out: ${list}`;
}

/** The sentence to show when publishing failed (the app's errors are already plain sentences). */
export function publishError(e: unknown): string {
  const s = String((e as { message?: unknown })?.message ?? e ?? '').trim();
  return s || 'Publishing failed. Please try again.';
}
