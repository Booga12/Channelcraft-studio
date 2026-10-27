// Moving backgrounds for designs: scenes drawn frame by frame in the design's colours, made into
// a short video that loops without a jump (everything moves in whole cycles over the loop), and
// played by RetroBat behind everything else.

import type { Palette6 } from './designs';
import { webmFile, type WebmFrame } from './webm';

export interface MovingBg {
  id: string;
  label: string;
  help: string;
}

export const MOVING_BGS: MovingBg[] = [
  { id: 'bokeh', label: 'Floating lights', help: 'Soft, blurry lights drifting slowly' },
  { id: 'stars', label: 'Twinkling stars', help: 'A night sky with stars that twinkle and the odd shooting star' },
  { id: 'waves', label: 'Gentle waves', help: 'Layers of colour rolling like the sea' },
  { id: 'grid', label: 'Retro grid', help: 'A glowing grid racing towards a sunset, synthwave style' },
];

/** Where moving backgrounds go in a theme. */
export const MOVING_DIR = '_inc/ccs/moving';
/** The design variable that remembers which one the theme uses. */
export const MOVING_VAR = 'designMovingBg';

export const W = 1280;
export const H = 720;
export const FPS = 30;
export const SECS = 8;

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const TAU = Math.PI * 2;

function rgba(hex: string, a = 1): string {
  const h = hex.replace('#', '');
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) || 0;
  return `rgba(${n(0)}, ${n(2)}, ${n(4)}, ${a})`;
}

/** A seeded random source, so the same scene comes out each time. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** The file name for a scene in these colours, so a change of colours makes a new video. */
export function movingFileName(id: string, p: Palette6): string {
  let h = 2166136261;
  for (const ch of `${id}|${p.bg}|${p.bg2}|${p.accent}|${p.text}|${p.dim}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return `${id}-${(h >>> 0).toString(16).padStart(8, '0').slice(0, 6)}.webm`;
}

function backdrop(c: Ctx, p: Palette6) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgba(p.bg2));
  g.addColorStop(1, rgba(p.bg));
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}

/** Draws one frame; `t` goes from 0 to 1 over the loop, and 1 looks the same as 0. */
export function drawMovingBg(c: Ctx, id: string, p: Palette6, t: number) {
  backdrop(c, p);
  const r = rng(7);
  if (id === 'bokeh') {
    c.globalCompositeOperation = 'lighter';
    const colours = [p.accent, p.text, p.dim, p.accent];
    for (let i = 0; i < 26; i++) {
      const x0 = r() * W;
      const y0 = r() * H;
      const size = 40 + r() * 120;
      const k = 1 + Math.floor(r() * 2);
      const ph = r();
      const reach = 30 + r() * 70;
      const x = x0 + Math.cos(TAU * (k * t + ph)) * reach;
      const y = y0 + Math.sin(TAU * (k * t + ph)) * reach * 0.6;
      const a = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(TAU * (t + ph)));
      const g = c.createRadialGradient(x, y, 0, x, y, size);
      const col = colours[i % colours.length];
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(0.7, rgba(col, a * 0.6));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(x - size, y - size, size * 2, size * 2);
    }
  } else if (id === 'stars') {
    for (let i = 0; i < 260; i++) {
      const x = r() * W;
      const y = r() * H;
      const s = r() < 0.9 ? 1 + r() : 2 + r() * 1.5;
      const k = 1 + Math.floor(r() * 3);
      const ph = r();
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(TAU * (k * t + ph)));
      c.fillStyle = rgba(i % 7 ? p.text : p.accent, a);
      c.beginPath();
      c.arc(x, y, s, 0, TAU);
      c.fill();
    }
    // Two shooting stars, each crossing once per loop.
    for (const [start, y0] of [
      [0.15, 0.18],
      [0.6, 0.35],
    ]) {
      const u = (t - start + 1) % 1;
      if (u > 0.12) continue;
      const q = u / 0.12;
      const x = W * (0.2 + q * 0.6);
      const y = H * (y0 + q * 0.18);
      const g = c.createLinearGradient(x, y, x - 160, y - 48);
      g.addColorStop(0, rgba(p.text, 0.9 * (1 - q)));
      g.addColorStop(1, rgba(p.text, 0));
      c.strokeStyle = g;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - 160, y - 48);
      c.stroke();
    }
  } else if (id === 'waves') {
    const layers = 5;
    for (let l = 0; l < layers; l++) {
      const f = l / (layers - 1);
      const base = H * (0.45 + f * 0.45);
      const amp = 18 + f * 26;
      c.beginPath();
      c.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        const u = x / W;
        const y = base + Math.sin(TAU * (u * (1.2 + l * 0.35) + t * (l % 2 ? 1 : -1) + l * 0.2)) * amp + Math.sin(TAU * (u * 3 - t * 2 + l)) * amp * 0.25;
        c.lineTo(x, y);
      }
      c.lineTo(W, H);
      c.closePath();
      c.fillStyle = rgba(l === layers - 1 ? p.bg : p.accent, l === layers - 1 ? 0.9 : 0.1 + f * 0.12);
      c.fill();
    }
  } else if (id === 'grid') {
    const horizon = H * 0.55;
    // The sun, striped like an old poster.
    const sun = c.createLinearGradient(0, horizon - 260, 0, horizon);
    sun.addColorStop(0, rgba(p.accent, 0.95));
    sun.addColorStop(1, rgba(p.text, 0.55));
    c.fillStyle = sun;
    c.beginPath();
    c.arc(W / 2, horizon, 220, Math.PI, 0);
    c.fill();
    c.fillStyle = rgba(p.bg2);
    for (let i = 0; i < 6; i++) c.fillRect(W / 2 - 230, horizon - 20 - i * 26, 460, 4 + i * 1.2);
    c.fillStyle = rgba(p.bg);
    c.fillRect(0, horizon, W, H - horizon);
    c.strokeStyle = rgba(p.accent, 0.8);
    c.lineWidth = 2;
    c.shadowColor = rgba(p.accent, 0.8);
    c.shadowBlur = 10;
    // Lines across, moving towards you by exactly one gap per loop (the nearest wraps to the horizon).
    for (let i = 0; i < 14; i++) {
      const z = ((((i + 1 - t) % 14) + 14) % 14) / 14;
      const y = horizon + (H - horizon) * z * z;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
    }
    for (let i = -12; i <= 12; i++) {
      c.beginPath();
      c.moveTo(W / 2 + i * 18, horizon);
      c.lineTo(W / 2 + i * 150, H);
      c.stroke();
    }
    c.shadowBlur = 0;
  }
  c.globalCompositeOperation = 'source-over';
}

/** Whether this window can make videos (WebCodecs). */
export const canMakeVideos = () => typeof VideoEncoder !== 'undefined' && typeof OffscreenCanvas !== 'undefined';

/**
 * Makes the moving background as a looping .webm video. `progress` gets 0 to 1. Takes a few
 * seconds; the window stays usable.
 */
export async function makeMovingBg(id: string, p: Palette6, progress: (f: number) => void = () => {}): Promise<Uint8Array> {
  if (!canMakeVideos()) throw new Error('This window can’t make videos.');
  const canvas = new OffscreenCanvas(W, H);
  const c = canvas.getContext('2d')!;
  const configs = [
    { codec: 'vp8', name: 'V_VP8' as const },
    { codec: 'vp09.00.10.08', name: 'V_VP9' as const },
  ];
  let chosen: (typeof configs)[number] | null = null;
  for (const k of configs) {
    const ok = await VideoEncoder.isConfigSupported({ codec: k.codec, width: W, height: H, bitrate: 3_000_000, framerate: FPS }).catch(() => null);
    if (ok?.supported) {
      chosen = k;
      break;
    }
  }
  if (!chosen) throw new Error('This PC can’t make WebM videos.');
  const frames: WebmFrame[] = [];
  let failed: unknown = null;
  const enc = new VideoEncoder({
    output: (chunk) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      frames.push({ data, time: chunk.timestamp / 1000, key: chunk.type === 'key' });
    },
    error: (e) => (failed = e),
  });
  enc.configure({ codec: chosen.codec, width: W, height: H, bitrate: 3_000_000, framerate: FPS, latencyMode: 'quality' });
  const n = FPS * SECS;
  for (let i = 0; i < n; i++) {
    if (failed) break;
    drawMovingBg(c, id, p, i / n);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    enc.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();
    // Let the encoder catch up, and the window draw.
    while (enc.encodeQueueSize > 4) await new Promise((res) => setTimeout(res, 5));
    if (i % 10 === 0) {
      progress(i / n);
      await new Promise((res) => setTimeout(res, 0));
    }
  }
  await enc.flush();
  enc.close();
  if (failed) throw failed;
  progress(1);
  frames.sort((a, b) => a.time - b.time);
  return webmFile({ codec: chosen.name, width: W, height: H, frameMs: 1000 / FPS, frames });
}
