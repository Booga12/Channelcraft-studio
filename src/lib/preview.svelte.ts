import { fileUrl } from './api';
import { parsePair } from './theme/schema';
import type { ResolvedElement } from './theme/resolver';

/** Bumped whenever a theme font finishes loading, so text re-measures. */
export const fontState = $state({ loaded: 0 });

const families = new Map<string, string>();

/** CSS font-family for a theme font file, loading it on first use. */
export function familyFor(abs: string | null): string {
  const fallback = "'Segoe UI', system-ui, sans-serif";
  if (!abs) return fallback;
  let fam = families.get(abs);
  if (!fam) {
    fam = `ccs-font-${families.size}`;
    families.set(abs, fam);
    const face = new FontFace(fam, `url("${fileUrl(abs)}")`);
    face
      .load()
      .then((f) => {
        document.fonts.add(f);
        fontState.loaded++;
      })
      .catch(() => {});
  }
  return `'${fam}', ${fallback}`;
}

export interface Box {
  x: number;
  y: number;
  /** null: sized by content. */
  w: number | null;
  h: number | null;
  ox: number;
  oy: number;
  rotation: number;
  rox: number;
  roy: number;
}

export function boxOf(el: ResolvedElement, W: number, H: number): Box {
  const g = (k: string) => parsePair(el.props.get(k)?.value);
  const pos = g('pos') ?? [0, 0];
  const size = g('size');
  const origin = g('origin') ?? [0, 0];
  const ro = g('rotationOrigin') ?? [0.5, 0.5];
  const rot = parseFloat(el.props.get('rotation')?.value ?? '0') || 0;
  return {
    x: pos[0] * W,
    y: pos[1] * H,
    w: size && size[0] > 0 ? size[0] * W : null,
    h: size && size[1] > 0 ? size[1] * H : null,
    ox: origin[0],
    oy: origin[1],
    rotation: rot,
    rox: ro[0],
    roy: ro[1],
  };
}

/** Fitted image size following ES rules for size, maxSize and minSize. */
export function imageSize(el: ResolvedElement, W: number, H: number, natural: { w: number; h: number } | null): { w: number; h: number } | null {
  const g = (k: string) => parsePair(el.props.get(k)?.value);
  const size = g('size');
  const max = g('maxSize');
  const min = g('minSize');
  const nw = natural?.w || 0;
  const nh = natural?.h || 0;
  if (size && size[0] > 0 && size[1] > 0) return { w: size[0] * W, h: size[1] * H };
  if (size && size[0] > 0) return { w: size[0] * W, h: nw ? (size[0] * W * nh) / nw : size[0] * W };
  if (size && size[1] > 0) return { w: nh ? (size[1] * H * nw) / nh : size[1] * H, h: size[1] * H };
  if (max) {
    const mw = max[0] * W;
    const mh = max[1] * H;
    if (!nw || !nh) return { w: mw, h: mh };
    const s = Math.min(mw / nw, mh / nh);
    return { w: nw * s, h: nh * s };
  }
  if (min) {
    const mw = min[0] * W;
    const mh = min[1] * H;
    if (!nw || !nh) return { w: mw, h: mh };
    const s = Math.max(mw / nw, mh / nh);
    return { w: nw * s, h: nh * s };
  }
  return nw ? { w: nw, h: nh } : null;
}

export function isWhite(c: string | undefined): boolean {
  const t = (c ?? '').trim().toUpperCase();
  return !t || t === 'FFFFFF' || t === 'FFFFFFFF';
}

export function alphaOf(c: string | undefined): number {
  const t = (c ?? '').trim();
  return /^[0-9a-fA-F]{8}$/.test(t) ? parseInt(t.slice(6), 16) / 255 : 1;
}

export function opaque(c: string | undefined): string {
  const t = (c ?? '').trim();
  return /^[0-9a-fA-F]{6}/.test(t) ? `#${t.slice(0, 6)}` : 'transparent';
}

export function formatDate(iso: string, fmt?: string): string {
  const y = iso.slice(0, 4);
  const m = iso.slice(4, 6);
  const d = iso.slice(6, 8);
  if (!fmt) return `${m}/${d}/${y}`;
  const time = /T(\d\d)(\d\d)(\d\d)/.exec(iso);
  const hh = time?.[1] ?? '00';
  const h12 = String(((Number(hh) + 11) % 12) + 1).padStart(2, '0');
  return fmt
    .replace(/%Y/g, y)
    .replace(/%y/g, y.slice(2))
    .replace(/%m/g, m)
    .replace(/%d/g, d)
    .replace(/%H/g, hh)
    .replace(/%I/g, h12)
    .replace(/%p/g, Number(hh) < 12 ? 'AM' : 'PM')
    .replace(/%M/g, time?.[2] ?? '00')
    .replace(/%S/g, time?.[3] ?? '00');
}
