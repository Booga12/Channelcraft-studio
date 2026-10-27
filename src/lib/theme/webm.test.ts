import { describe, expect, it } from 'vitest';
import { webmFile } from './webm';

/** Reads EBML elements back: [id, start of content, size]. */
function read(b: Uint8Array, from = 0, to = b.length) {
  const out: { id: number; at: number; len: number }[] = [];
  let o = from;
  while (o < to) {
    const first = b[o];
    const idLen = first >= 0x80 ? 1 : first >= 0x40 ? 2 : first >= 0x20 ? 3 : 4;
    let id = 0;
    for (let i = 0; i < idLen; i++) id = id * 256 + b[o + i];
    o += idLen;
    const s0 = b[o];
    let sLen = 1;
    while (!(s0 & (0x80 >> (sLen - 1)))) sLen++;
    let len = s0 & (0xff >> sLen);
    for (let i = 1; i < sLen; i++) len = len * 256 + b[o + i];
    o += sLen;
    out.push({ id, at: o, len });
    o += len;
  }
  return out;
}

describe('webm writer', () => {
  it('writes a file with the header, the track and a cluster per key frame', () => {
    const frame = (n: number, key: boolean) => ({ data: new Uint8Array([n, n, n]), time: n * 40, key });
    const f = webmFile({ codec: 'V_VP9', width: 1280, height: 720, frameMs: 40, frames: [frame(0, true), frame(1, false), frame(2, true), frame(3, false)] });
    const top = read(f);
    expect(top.map((e) => e.id)).toEqual([0x1a45dfa3, 0x18538067]);
    const seg = read(f, top[1].at, top[1].at + top[1].len);
    expect(seg.map((e) => e.id)).toEqual([0x1549a966, 0x1654ae6b, 0x1f43b675, 0x1f43b675]);
    // The second cluster starts at 80 ms, its blocks 0 and 40 ms into it.
    const c2 = read(f, seg[3].at, seg[3].at + seg[3].len);
    expect(c2[0].id).toBe(0xe7);
    expect(f[c2[0].at]).toBe(80);
    const blocks = c2.filter((e) => e.id === 0xa3);
    expect(blocks.length).toBe(2);
    expect([...f.slice(blocks[0].at, blocks[0].at + 4)]).toEqual([0x81, 0, 0, 0x80]);
    expect([...f.slice(blocks[1].at, blocks[1].at + 7)]).toEqual([0x81, 0, 40, 0, 3, 3, 3]);
    // Duration in the info: four frames of 40 ms.
    const info = read(f, seg[0].at, seg[0].at + seg[0].len);
    const dur = info.find((e) => e.id === 0x4489)!;
    expect(new DataView(f.buffer, dur.at, 8).getFloat64(0)).toBe(160);
    expect(new TextDecoder().decode(f).includes('V_VP9')).toBe(true);
  });
});
