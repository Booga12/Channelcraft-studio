// The recording toolkit used by record.mjs and the guide scripts in ./scripts:
// - Clip: captures the page with Chrome's screencast (JPEG frames with their real times), then
//   encodes a constant 30 fps WebM (VP9) and MP4 (H.264) plus a JPG poster.
// - Actor (ctx in the scripts): moves the visible pointer (cursor.js) with eased glides, clicks
//   with a ripple, types like a person and pauses so viewers can follow.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';

export const FPS = 30;
const MAX_BYTES = 1.5 * 1024 * 1024;

function ffmpeg(args) {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr || r.stdout}\n  ffmpeg ${args.join(' ')}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- capture -------------------------------------------------------------------------------------

export class Clip {
  constructor(page, { width, height, quality = 92 }) {
    this.page = page;
    this.width = width;
    this.height = height;
    this.quality = quality;
    this.frames = [];
    this.marks = {};
    this.cuts = [];
  }

  /**
   * Runs fn (a long wait, e.g. a theme being built) and leaves most of it out of the clip: the
   * first `keep` seconds and the last `tail` seconds stay, the middle is cut (a jump cut).
   */
  async cut(fn, { keep = 1.6, tail = 0.5 } = {}) {
    const a = Date.now() / 1000;
    const r = await fn();
    const b = Date.now() / 1000;
    if (b - a > keep + tail + 0.3) this.cuts.push([a - this.t0 + keep, b - this.t0 - tail]);
    return r;
  }

  async start() {
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.frames = [];
    this.cdp.on('Page.screencastFrame', (f) => {
      this.frames.push({ data: f.data, t: f.metadata.timestamp ?? Date.now() / 1000 });
      this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: this.quality, maxWidth: this.width, maxHeight: this.height, everyNthFrame: 1 });
    // Wait for the first frame, so the clip starts on a real picture.
    for (let i = 0; i < 100 && !this.frames.length; i++) await sleep(20);
    this.t0 = this.frames[0]?.t ?? Date.now() / 1000;
  }

  /** Remembers this moment (e.g. the poster frame). */
  mark(name) {
    this.marks[name] = Date.now() / 1000 - this.t0;
  }

  async stop() {
    this.tEnd = Date.now() / 1000;
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    await sleep(50);
    await this.cdp.detach().catch(() => {});
    if (!this.frames.length) throw new Error('No frames were captured');
    // The screencast clock and the wall clock can differ a little: line them up at the end.
    const last = this.frames[this.frames.length - 1].t;
    if (last > this.tEnd || this.tEnd - last > 30) this.tEnd = last + 0.5;
    // Jump cuts: drop the frames inside each cut and pull everything after it earlier.
    for (const [from, to] of [...this.cuts].sort((x, y) => y[0] - x[0])) {
      const gap = to - from;
      const before = this.frames.filter((f) => f.t - this.t0 < from);
      const after = this.frames.filter((f) => f.t - this.t0 >= to).map((f) => ({ ...f, t: f.t - gap }));
      // The frame showing at the end of the cut starts the part after it.
      const showing = this.frames.filter((f) => f.t - this.t0 < to).pop();
      if (showing && (!after.length || after[0].t - this.t0 > from + 0.001)) after.unshift({ ...showing, t: this.t0 + from });
      this.frames = [...before, ...after];
      this.tEnd -= gap;
      for (const k of Object.keys(this.marks)) if (this.marks[k] >= to) this.marks[k] -= gap;
    }
    return this.tEnd - this.t0;
  }

  /**
   * Writes <base>.webm, <base>.mp4 and <base>.jpg. loop: 'fade' blends the last moments into the
   * first frame, so the clip loops without a jump.
   */
  encode(base, { poster = 'end', loop = 'fade', fade = 0.45, keepFrames = false } = {}) {
    const work = join(tmpdir(), `ccs-clip-${process.pid}-${Date.now()}`);
    mkdirSync(work, { recursive: true });
    mkdirSync(dirname(base), { recursive: true });
    try {
      const list = ['ffconcat version 1.0'];
      this.frames.forEach((f, i) => {
        const name = `f${String(i).padStart(5, '0')}.jpg`;
        writeFileSync(join(work, name), Buffer.from(f.data, 'base64'));
        const next = i + 1 < this.frames.length ? this.frames[i + 1].t : this.tEnd;
        list.push(`file '${name}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
      });
      // The concat format needs the last file twice for its duration to count.
      list.push(`file 'f${String(this.frames.length - 1).padStart(5, '0')}.jpg'`);
      writeFileSync(join(work, 'list.txt'), list.join('\n'));
      const duration = this.tEnd - this.t0;

      const size = `${this.width}:${this.height}`;
      const input = ['-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt')];
      let filter;
      let inputs = input;
      if (loop === 'fade' && duration > fade * 3) {
        inputs = [...input, '-loop', '1', '-t', String(fade + 0.1), '-framerate', String(FPS), '-i', join(work, 'f00000.jpg')];
        filter = `[0:v]fps=${FPS},scale=${size}:flags=lanczos,setsar=1,format=yuv420p,trim=duration=${duration.toFixed(3)}[a];[1:v]fps=${FPS},scale=${size}:flags=lanczos,setsar=1,format=yuv420p[b];[a][b]xfade=transition=fade:duration=${fade}:offset=${(duration - fade).toFixed(3)},trim=duration=${duration.toFixed(3)},format=yuv420p[v]`;
      } else filter = `[0:v]fps=${FPS},scale=${size}:flags=lanczos,setsar=1,format=yuv420p,trim=duration=${duration.toFixed(3)}[v]`;

      const encodeTo = (out, codecArgs) => ffmpeg([...inputs, '-filter_complex', filter, '-map', '[v]', '-an', '-pix_fmt', 'yuv420p', ...codecArgs, out]);
      const sizes = {};
      // Smaller files first try; a busy clip gets a slightly higher CRF until it fits.
      for (const crf of [30, 34, 38]) {
        encodeTo(`${base}.webm`, ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-g', String(FPS * 4)]);
        sizes.webm = statSync(`${base}.webm`).size;
        if (sizes.webm <= MAX_BYTES) break;
      }
      for (const crf of [22, 25, 28]) {
        encodeTo(`${base}.mp4`, ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-tune', 'animation', '-profile:v', 'high', '-movflags', '+faststart', '-g', String(FPS * 4)]);
        sizes.mp4 = statSync(`${base}.mp4`).size;
        if (sizes.mp4 <= MAX_BYTES) break;
      }

      // The poster: the marked moment, the end (the default) or the start.
      const at = typeof poster === 'number' ? poster : poster === 'start' ? 0 : poster === 'end' ? duration - (loop === 'fade' ? fade + 0.05 : 0.05) : (this.marks[poster] ?? duration - fade - 0.05);
      let idx = 0;
      for (let i = 0; i < this.frames.length; i++) if (this.frames[i].t - this.t0 <= at) idx = i;
      ffmpeg(['-i', join(work, `f${String(idx).padStart(5, '0')}.jpg`), '-vf', `scale=${size}:flags=lanczos`, '-q:v', '3', `${base}.jpg`]);
      sizes.poster = statSync(`${base}.jpg`).size;
      return { duration: Math.round(duration * 100) / 100, frames: this.frames.length, bytes: sizes, posterAt: Math.round(at * 100) / 100 };
    } finally {
      if (!keepFrames) rmSync(work, { recursive: true, force: true });
    }
  }
}

// ---- acting --------------------------------------------------------------------------------------

/** A tiny seeded random, so a re-recording types and moves the same way. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Actor {
  constructor(page, { speed = 1 } = {}) {
    this.page = page;
    this.speed = speed;
    this.random = rng(12345);
  }

  /** Waits, scaled by the guide's speed. */
  pause(ms = 600) {
    return sleep(ms / this.speed);
  }

  /** A locator, a CSS/text selector string, or {x, y}: the point to aim at. */
  async point(target, { offset = [0, 0], position } = {}) {
    if (target && typeof target.x === 'number' && typeof target.y === 'number' && !target.boundingBox) return { x: target.x, y: target.y };
    const loc = typeof target === 'string' ? this.page.locator(target).first() : target;
    await loc.waitFor({ state: 'visible', timeout: 15000 });
    await loc.scrollIntoViewIfNeeded();
    const box = await loc.boundingBox();
    if (!box) throw new Error(`No box for ${target}`);
    if (position) return { x: box.x + position[0], y: box.y + position[1] };
    // Aim a little left of centre on wide things (where a person's eye lands), centre otherwise.
    const fx = box.width > 220 ? 0.35 : 0.5;
    return { x: Math.round(box.x + box.width * fx + offset[0]), y: Math.round(box.y + box.height * 0.5 + offset[1]) };
  }

  /** Puts the pointer somewhere at once (between clips). */
  async place(x, y) {
    await this.page.evaluate(([x, y]) => window.__cursor?.set(x, y), [x, y]);
    await this.page.mouse.move(x, y);
  }

  /** Glides the pointer to a target; hover effects follow it. */
  async moveTo(target, opts = {}) {
    const { x, y } = await this.point(target, opts);
    const [sx, sy] = await this.page.evaluate(() => window.__cursor.pos);
    const dist = Math.hypot(x - sx, y - sy);
    const ms = (opts.ms ?? Math.min(1100, Math.max(420, 300 + dist * 0.55))) / this.speed;
    const glide = this.page.evaluate(([x, y, ms]) => window.__cursor.glide(x, y, ms), [x, y, ms]);
    // The real mouse follows in a few steps, so buttons light up as the pointer passes.
    const steps = Math.max(4, Math.round(ms / 45));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      await this.page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
      await sleep(ms / steps);
    }
    await glide;
    await this.page.mouse.move(x, y);
    return { x, y };
  }

  async hover(target, opts = {}) {
    await this.moveTo(target, opts);
    await this.pause(opts.hold ?? 350);
  }

  /** Moves to the target and clicks it, with a ripple. */
  async click(target, opts = {}) {
    const { x, y } = await this.moveTo(target, opts);
    await this.pause(opts.before ?? 160);
    await this.page.evaluate(() => {
      window.__cursor.down();
      window.__cursor.ripple();
    });
    await this.page.mouse.down({ button: opts.button ?? 'left' });
    await sleep(70);
    await this.page.mouse.up({ button: opts.button ?? 'left' });
    await this.page.evaluate(() => window.__cursor.up());
    await this.pause(opts.after ?? 380);
    return { x, y };
  }

  /** Types like a person: a little uneven, a touch slower after spaces. */
  async type(text, { into, clear = false, cps = 11 } = {}) {
    if (into) await this.click(into);
    if (clear) {
      await this.page.keyboard.press('Control+A');
      await sleep(120);
    }
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      const base = 1000 / cps;
      await sleep((base * (0.6 + this.random() * 0.8) + (ch === ' ' ? 90 : 0)) / this.speed);
    }
    await this.pause(250);
  }

  async press(key, after = 300) {
    await this.page.keyboard.press(key);
    await this.pause(after);
  }

  /** Scrolls smoothly by dy pixels over the target. */
  async scroll(target, dy, { ms = 700 } = {}) {
    if (target) await this.moveTo(target);
    const steps = Math.max(6, Math.round(ms / 30));
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.wheel(0, dy / steps);
      await sleep(ms / steps / this.speed);
    }
    await this.pause(250);
  }

  /** Drags from one target to another with the button held. */
  async drag(from, to, opts = {}) {
    await this.moveTo(from);
    await this.pause(150);
    await this.page.evaluate(() => window.__cursor.down());
    await this.page.mouse.down();
    const a = await this.page.evaluate(() => window.__cursor.pos);
    const b = await this.point(to, opts);
    const ms = (opts.ms ?? 900) / this.speed;
    const steps = Math.round(ms / 16);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const x = a[0] + (b.x - a[0]) * e;
      const y = a[1] + (b.y - a[1]) * e;
      await this.page.evaluate(([x, y]) => window.__cursor.set(x, y), [x, y]);
      await this.page.mouse.move(x, y);
      await sleep(ms / steps);
    }
    await this.page.mouse.up();
    await this.page.evaluate(() => window.__cursor.up());
    await this.pause(300);
  }

  /** Answers the next file dialog (open/save) the app asks for; null cancels it. */
  async answerDialog(answer) {
    await this.page.evaluate((a) => window.__ccsDemo.dialogs.push(a), answer);
  }

  /** Clicks a button in a message box (drawn in the page in demo mode): 'ok' or 'cancel'. */
  async answerMessage(which = 'ok', opts = {}) {
    await this.click(this.page.locator(`[data-demo-dialog] [data-demo-button="${which}"]`), opts);
  }
}

// ---- the clip manifest the website reads ------------------------------------------------------
//
// { version: 2, guides: [{ slug, title, order, steps: [
//     { id, title, webm, mp4, poster, seconds, width, height, shows, uiLabels, … }   a clip
//   | { id, title, skipped: "why", poster?, shows?, uiLabels? }                         no clip
// ] }] }
// Guides keep their script order, and steps the order of the guide's script.

export function updateManifest(file, guide, entry) {
  let m = { version: 2, guides: [] };
  if (existsSync(file)) {
    const old = JSON.parse(readFileSync(file, 'utf8'));
    if (Array.isArray(old.guides)) m = old;
  }
  let g = m.guides.find((x) => x.slug === guide.slug);
  if (!g) m.guides.push((g = { slug: guide.slug, steps: [] }));
  g.title = guide.title;
  g.order = guide.order;
  const ids = guide.steps.map((s) => s.id);
  g.steps = [...g.steps.filter((s) => s.id !== entry.id && ids.includes(s.id)), entry].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  m.guides.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  m.guides = m.guides.map(({ slug, title, order, steps }) => ({ slug, title, order, steps }));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(m, null, 2)}\n`);
}
