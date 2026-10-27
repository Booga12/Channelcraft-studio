// Moving backgrounds for designs: scenes drawn frame by frame in the design's colours (see
// movingScenes.ts), made into a short video that loops without a jump, and played by RetroBat
// behind everything else.

import type { Palette6 } from './designs';
import { drawScene, H, SCENE_GROUPS, SCENES, W, type Ctx, type SceneGroup } from './movingScenes';
import { webmFile, type WebmFrame } from './webm';

export interface MovingBg {
  id: string;
  label: string;
  help: string;
  group: SceneGroup;
}

export const MOVING_BGS: MovingBg[] = SCENES.map(({ id, label, help, group }) => ({ id, label, help, group }));
export const MOVING_GROUPS = SCENE_GROUPS;

/** Where moving backgrounds go in a theme. */
export const MOVING_DIR = '_inc/ccs/moving';
/** The design variable that remembers which one the theme uses. */
export const MOVING_VAR = 'designMovingBg';
/** Where the video sits: just above the design's still background, under everything else. */
export const MOVING_Z = 0.5;

export { W, H };
export const FPS = 30;
export const SECS = 8;

/** The file name for a scene in these colours, so a change of colours makes a new video. */
export function movingFileName(id: string, p: Palette6): string {
  let h = 2166136261;
  for (const ch of `${id}|${p.bg}|${p.bg2}|${p.accent}|${p.text}|${p.dim}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return `${id}-${(h >>> 0).toString(16).padStart(8, '0').slice(0, 6)}.webm`;
}

/** Which scene a video file is (its name without the colour code), or null. */
export function movingIdOf(file: string): string | null {
  const m = /^(.+)-[0-9a-f]{6}\.webm$/i.exec(file.split(/[\/]/).pop() ?? '');
  return m && MOVING_BGS.some((b) => b.id === m[1]) ? m[1] : null;
}

/** Draws one frame; `t` goes from 0 to 1 over the loop, and 1 looks the same as 0. */
export function drawMovingBg(c: Ctx, id: string, p: Palette6, t: number) {
  drawScene(c, id, p, t);
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
