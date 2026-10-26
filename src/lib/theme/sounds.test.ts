import { describe, expect, it } from 'vitest';
import { MUSIC, RATE, SCROLL_SOUNDS, wavBytes } from './sounds';

describe('the app’s own sounds', () => {
  it('makes every scroll sound short and every song a loop of half a minute or so, never clipping', () => {
    for (const s of SCROLL_SOUNDS) {
      const a = s.make();
      expect(a.length / RATE, s.id).toBeLessThan(0.35);
      expect(Math.max(...a.map(Math.abs)), s.id).toBeLessThanOrEqual(1);
    }
    for (const m of MUSIC) {
      const t0 = performance.now();
      const a = m.make();
      expect(performance.now() - t0, `${m.id} is quick to make`).toBeLessThan(3000);
      const secs = a.length / RATE;
      expect(secs, m.id).toBeGreaterThan(20);
      expect(secs, m.id).toBeLessThan(60);
      let peak = 0;
      let sum = 0;
      for (const v of a) {
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, m.id).toBeLessThanOrEqual(1);
      // Not silent.
      expect(Math.sqrt(sum / a.length), m.id).toBeGreaterThan(0.05);
      // The same every time.
      expect(m.make()[1234]).toBe(a[1234]);
    }
  });

  it('writes a playable .wav file', () => {
    const w = wavBytes(new Float32Array([0, 0.5, -0.5, 1]));
    const v = new DataView(w.buffer);
    expect(String.fromCharCode(...w.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...w.slice(8, 12))).toBe('WAVE');
    expect(v.getUint32(24, true)).toBe(RATE);
    expect(v.getUint32(40, true)).toBe(8);
    expect(v.getInt16(44 + 6, true)).toBe(32767);
  });
});
