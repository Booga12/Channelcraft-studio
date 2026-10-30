// Little chiptune songs for the demo user's Music folder (made-up, generated here, so the music
// guide has something to add). Returns a 16-bit stereo WAV; make-demo.mjs turns it into .ogg.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/** A short looping chiptune: bass, arpeggio, lead and drums. */
export function song({ bpm, key, mood }, seconds = 36, rate = 44100) {
  const r = rng(bpm * 31 + key);
  const n = Math.floor(seconds * rate);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const beat = 60 / bpm;
  const step = beat / 4;
  // i–VI–III–VII in a minor key, or I–V–vi–IV for the calm one.
  const prog = mood === 'calm' ? [0, 7, 9, 5] : [0, 8, 3, 10];
  const minor = mood !== 'calm';
  const chord = (root) => (minor ? [0, 3, 7] : [0, 4, 7]).map((x) => root + x);
  const scale = minor ? [0, 2, 3, 5, 7, 8, 10, 12] : [0, 2, 4, 5, 7, 9, 11, 12];
  const melody = Array.from({ length: 32 }, () => (r() < 0.25 ? null : scale[Math.floor(r() * scale.length)]));
  const add = (buf, i0, len, f, vol, shape, pan = 0) => {
    for (let i = 0; i < len && i0 + i < n; i++) {
      const t = i / rate;
      const ph = (t * f) % 1;
      let v = shape === 'square' ? (ph < 0.5 ? 1 : -1) : shape === 'pulse' ? (ph < 0.25 ? 1 : -1) : shape === 'tri' ? 4 * Math.abs(ph - 0.5) - 1 : Math.sin(2 * Math.PI * ph);
      const env = Math.min(1, i / (rate * 0.004)) * Math.exp((-3 * i) / len);
      v *= vol * env;
      L[i0 + i] += v * (1 - Math.max(0, pan));
      R[i0 + i] += v * (1 + Math.min(0, pan));
    }
  };
  const steps = Math.floor(seconds / step);
  for (let s = 0; s < steps; s++) {
    const i0 = Math.floor(s * step * rate);
    const bar = Math.floor(s / 16) % prog.length;
    const root = key - 12 + prog[bar];
    const c = chord(root + 12);
    // Bass on eighths.
    if (s % 2 === 0) add(L, i0, Math.floor(step * 2 * rate), freq(root - 12 + (s % 8 === 6 ? 12 : 0)), 0.16, 'tri'), add(R, i0, Math.floor(step * 2 * rate), freq(root - 12), 0.0, 'tri');
    // Arpeggio on sixteenths.
    add(L, i0, Math.floor(step * rate), freq(c[s % 3] + 12), 0.035, 'pulse', 0.4);
    add(R, i0, Math.floor(step * rate), freq(c[s % 3] + 12), 0.035, 'pulse', -0.4);
    // Lead on eighths, after the first four bars.
    const m = melody[(s >> 1) % 32];
    if (s >= 64 && s % 2 === 0 && m !== null) {
      const f = freq(key + 12 + m + (prog[bar] > 6 ? 0 : 0));
      add(L, i0, Math.floor(step * 2 * rate), f, 0.05, 'square', -0.2);
      add(R, i0, Math.floor(step * 2 * rate), f, 0.05, 'square', 0.2);
    }
    // Drums: kick on beats, snare on 2 and 4, hats on eighths.
    const len = Math.floor(step * rate);
    if (s % 4 === 0)
      for (let i = 0; i < len * 2 && i0 + i < n; i++) {
        const t = i / rate;
        const v = Math.sin(2 * Math.PI * (50 + 120 * Math.exp(-t * 30)) * t) * Math.exp(-t * 14) * 0.32;
        L[i0 + i] += v;
        R[i0 + i] += v;
      }
    if (s % 8 === 4 || (s % 4 === 2 && mood !== 'calm'))
      for (let i = 0; i < len * 2 && i0 + i < n; i++) {
        const v = (r() * 2 - 1) * Math.exp((-i / rate) * (s % 8 === 4 ? 18 : 60)) * (s % 8 === 4 ? 0.16 : 0.06);
        L[i0 + i] += v;
        R[i0 + i] += v;
      }
  }
  // Fade in and out, so the song loops gently.
  for (let i = 0; i < n; i++) {
    const g = Math.min(1, i / (rate * 0.5), (n - i) / (rate * 2));
    L[i] *= g;
    R[i] *= g;
  }
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.max(-1, Math.min(1, L[i])) * 32767, i * 4);
    data.writeInt16LE(Math.max(-1, Math.min(1, R[i])) * 32767, i * 4 + 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(2, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 4, 28);
  head.writeUInt16LE(4, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}
