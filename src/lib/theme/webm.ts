// A small WebM file writer: video frames (VP8 or VP9, already encoded) into a file RetroBat's
// video player (VLC) plays. One video track, no sound; a cluster starts at every key frame.

export interface WebmFrame {
  data: Uint8Array;
  /** Milliseconds from the start. */
  time: number;
  key: boolean;
}

export interface WebmVideo {
  codec: 'V_VP8' | 'V_VP9';
  width: number;
  height: number;
  /** Milliseconds per frame. */
  frameMs: number;
  frames: WebmFrame[];
}

const text = new TextEncoder();

/** An unsigned number in as few bytes as it needs. */
function uint(n: number): Uint8Array {
  const out: number[] = [];
  do {
    out.unshift(n % 256);
    n = Math.floor(n / 256);
  } while (n > 0);
  return Uint8Array.from(out);
}

function float64(n: number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, n);
  return b;
}

/** An element size, always written as 8 bytes (allowed, and simple). */
function size(n: number): Uint8Array {
  const b = new Uint8Array(8);
  b[0] = 0x01;
  let v = n;
  for (let i = 7; i >= 1; i--) {
    b[i] = v % 256;
    v = Math.floor(v / 256);
  }
  return b;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** An element: its id (with its length bits, as in the spec), its size and its content. */
function el(id: number, ...content: (Uint8Array | string | number)[]): Uint8Array {
  const body = concat(content.map((c) => (typeof c === 'string' ? text.encode(c) : typeof c === 'number' ? uint(c) : c)));
  return concat([uint(id), size(body.length), body]);
}

/** The whole .webm file. */
export function webmFile(v: WebmVideo): Uint8Array {
  const last = v.frames[v.frames.length - 1];
  const duration = last ? last.time + v.frameMs : 0;
  const header = el(0x1a45dfa3, el(0x4286, 1), el(0x42f7, 1), el(0x42f2, 4), el(0x42f3, 8), el(0x4282, 'webm'), el(0x4287, 4), el(0x4285, 2));
  const info = el(0x1549a966, el(0x2ad7b1, 1_000_000), el(0x4489, float64(duration)), el(0x4d80, 'ChannelCraft Studio'), el(0x5741, 'ChannelCraft Studio'));
  const tracks = el(
    0x1654ae6b,
    el(0xae, el(0xd7, 1), el(0x73c5, 1), el(0x83, 1), el(0x9c, 0), el(0x86, v.codec), el(0x23e383, Math.round(v.frameMs * 1_000_000)), el(0xe0, el(0xb0, v.width), el(0xba, v.height))),
  );
  // A new cluster at each key frame (and at least every 30 s, as block times are 16-bit).
  const clusters: Uint8Array[] = [];
  let start = -1;
  let blocks: Uint8Array[] = [];
  const flush = () => {
    if (start >= 0) clusters.push(el(0x1f43b675, el(0xe7, start), ...blocks));
    blocks = [];
  };
  for (const f of v.frames) {
    const t = Math.round(f.time);
    if (start < 0 || f.key || t - start > 30000) {
      flush();
      start = t;
    }
    const head = new Uint8Array(4);
    head[0] = 0x81;
    new DataView(head.buffer).setInt16(1, t - start);
    head[3] = f.key ? 0x80 : 0;
    blocks.push(el(0xa3, head, f.data));
  }
  flush();
  return concat([header, el(0x18538067, info, tracks, ...clusters)]);
}
