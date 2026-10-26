// Free sounds for themes, made by the app itself (nothing is downloaded, and nobody else owns
// them): short scroll sounds for carousels, lists and grids, and music loops for RetroBat's menus.
// Both are written into the theme as .wav files, which RetroBat plays.

export const RATE = 22050;

export interface SoundPreset {
  id: string;
  label: string;
  help: string;
  /** The sound as samples from -1 to 1 at RATE. */
  make: () => Float32Array;
}

// ---- building blocks ------------------------------------------------------------------------

type Wave = 'sine' | 'square' | 'triangle' | 'saw' | 'pulse';

function osc(w: Wave, phase: number): number {
  const p = phase - Math.floor(phase);
  switch (w) {
    case 'sine':
      return Math.sin(2 * Math.PI * p);
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'pulse':
      return p < 0.25 ? 1 : -1;
    case 'triangle':
      return 4 * Math.abs(p - 0.5) - 1;
    case 'saw':
      return 2 * p - 1;
  }
}

/** A seeded random source, so every sound comes out the same each time. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Adds a note into `out`: a wave with an attack and a decay, from `start` seconds for `len` seconds. */
function note(out: Float32Array, start: number, len: number, freq: number, o: { wave?: Wave; vol?: number; attack?: number; release?: number; decay?: number; detune?: number; slide?: number; vibrato?: number }) {
  const { wave = 'sine', vol = 0.3, attack = 0.005, release = 0.05, decay = 0, detune = 0, slide = 0, vibrato = 0 } = o;
  const i0 = Math.floor(start * RATE);
  const n = Math.floor((len + release) * RATE);
  let ph = 0;
  let ph2 = 0.37;
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / RATE;
    const env = (t < attack ? t / attack : 1) * (decay ? Math.exp(-t / decay) : 1) * (t > len ? Math.max(0, 1 - (t - len) / release) : 1);
    const f = freq * (1 + slide * t) * (1 + vibrato * Math.sin(2 * Math.PI * 5.5 * t));
    ph += f / RATE;
    let v = osc(wave, ph);
    if (detune) {
      ph2 += (f * (1 + detune)) / RATE;
      v = (v + osc(wave, ph2)) / 2;
    }
    out[i0 + i] += v * env * vol;
  }
}

/** A soft noise burst (snare, hat, click). `tone` near 1 is bright, near 0 dull. */
function noise(out: Float32Array, start: number, len: number, o: { vol?: number; tone?: number; seed?: number }) {
  const { vol = 0.2, tone = 0.6, seed = 7 } = o;
  const r = rng(seed + Math.floor(start * 1000));
  const i0 = Math.floor(start * RATE);
  const n = Math.floor(len * RATE);
  let lp = 0;
  let prev = 0;
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const w = r() * 2 - 1;
    lp += (w - lp) * (1 - tone * 0.9);
    // Bright noise keeps the highs (a high-pass), dull noise is the low-passed part.
    const v = tone > 0.5 ? w - prev * 0.95 : lp;
    prev = w;
    out[i0 + i] += v * vol * Math.exp((-i / RATE) * (6 / len));
  }
}

/** A kick drum: a quick falling sine. */
function kick(out: Float32Array, start: number, vol = 0.6) {
  const i0 = Math.floor(start * RATE);
  let ph = 0;
  for (let i = 0; i < 0.25 * RATE && i0 + i < out.length; i++) {
    const t = i / RATE;
    ph += (45 + 110 * Math.exp(-t * 30)) / RATE;
    out[i0 + i] += Math.sin(2 * Math.PI * ph) * Math.exp(-t * 14) * vol;
  }
}

/** Keeps the loudest moment just under full, with soft edges at the start and end. */
function finish(out: Float32Array, fade = 0.004): Float32Array {
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? 0.89 / peak : 1;
  const f = Math.floor(fade * RATE);
  for (let i = 0; i < out.length; i++) {
    const e = Math.min(1, i / Math.max(1, f), (out.length - 1 - i) / Math.max(1, f));
    // A gentle soft clip keeps loud chords from sounding harsh.
    out[i] = Math.tanh(out[i] * g * 1.1) * e;
  }
  return out;
}

const buf = (secs: number) => new Float32Array(Math.ceil(secs * RATE));

// ---- scroll sounds ---------------------------------------------------------------------------

export const SCROLL_SOUNDS: SoundPreset[] = [
  { id: 'click', label: 'Soft click', help: 'A quiet, short click', make: () => { const o = buf(0.05); noise(o, 0, 0.03, { vol: 0.5, tone: 0.3 }); note(o, 0, 0.01, 2200, { vol: 0.15, decay: 0.008 }); return finish(o); } },
  { id: 'tick', label: 'Wood tick', help: 'Like a wooden block', make: () => { const o = buf(0.07); note(o, 0, 0.02, 1500, { vol: 0.5, decay: 0.012, release: 0.02 }); note(o, 0, 0.02, 3100, { vol: 0.15, decay: 0.006 }); return finish(o); } },
  { id: 'blip', label: '8-bit blip', help: 'A classic console beep', make: () => { const o = buf(0.06); note(o, 0, 0.04, 988, { wave: 'square', vol: 0.3, release: 0.01 }); return finish(o); } },
  { id: 'pop', label: 'Bubble pop', help: 'A round, rising pop', make: () => { const o = buf(0.08); note(o, 0, 0.05, 520, { vol: 0.5, slide: 9, decay: 0.03, release: 0.02 }); return finish(o); } },
  { id: 'chime', label: 'Glass chime', help: 'A small, bright bell', make: () => { const o = buf(0.3); note(o, 0, 0.02, 1760, { vol: 0.4, decay: 0.09, release: 0.2 }); note(o, 0, 0.02, 2637, { vol: 0.2, decay: 0.06, release: 0.15 }); return finish(o); } },
  { id: 'swish', label: 'Swish', help: 'A soft whoosh', make: () => { const o = buf(0.14); noise(o, 0, 0.13, { vol: 0.5, tone: 0.75 }); return finish(o, 0.03); } },
  { id: 'coin', label: 'Arcade coin', help: 'Two quick rising notes', make: () => { const o = buf(0.14); note(o, 0, 0.04, 988, { wave: 'square', vol: 0.25, release: 0.005 }); note(o, 0.045, 0.07, 1319, { wave: 'square', vol: 0.25, decay: 0.08, release: 0.02 }); return finish(o); } },
];

// ---- music -------------------------------------------------------------------------------------

/** A chord as MIDI notes (root first). */
const chord = (root: number, kind: 'maj' | 'min' | 'maj7' | 'min7' | 'sus') => [root, root + (kind === 'min' || kind === 'min7' ? 3 : kind === 'sus' ? 5 : 4), root + 7, ...(kind === 'maj7' ? [root + 11] : kind === 'min7' ? [root + 10] : [])];

interface Song {
  bpm: number;
  bars: number;
  chords: number[][];
  /** Everything played in one bar, given its chord, bar number and start time. */
  bar: (o: Float32Array, c: number[], bar: number, t0: number, beat: number) => void;
}

/** The song being made, so each song gets its own tune. */
let songSeed = 0;

function render(s: Song, seed: number): Float32Array {
  songSeed = seed;
  const beat = 60 / s.bpm;
  const o = buf(s.bars * 4 * beat + 0.3);
  for (let b = 0; b < s.bars; b++) s.bar(o, s.chords[b % s.chords.length], b, b * 4 * beat, beat);
  // Cut at the bar line so the loop joins up; the tail is folded back onto the start.
  const end = Math.floor(s.bars * 4 * beat * RATE);
  for (let i = end; i < o.length; i++) o[i - end] += o[i];
  return finish(o.slice(0, end), 0.002);
}

/** A melody line that keeps to the chord on the beat: phrases repeat (A A B A) so it sings along. */
function melody(c: number[], bar: number, steps: number, octave: number): (number | null)[] {
  const phrase = [0, 0, 1, 0][Math.floor(bar / 2) % 4];
  const rr = rng(songSeed * 977 + phrase * 31 + (bar % 2) * 7);
  const tones = [...c.slice(0, 3), c[0] + 12].map((n) => n + octave);
  return Array.from({ length: steps }, (_, i) => (rr() < (i % 2 ? 0.45 : 0.85) ? tones[Math.floor(rr() * tones.length)] : null));
}

const SONGS: Record<string, { label: string; help: string; seed: number; song: Song }> = {
  chiptune: {
    label: 'Arcade Hero',
    help: 'Upbeat 8-bit chiptune',
    seed: 11,
    song: {
      bpm: 140,
      bars: 16,
      chords: [chord(57, 'min'), chord(53, 'maj'), chord(48, 'maj'), chord(55, 'maj')],
      bar(o, c, b, t0, beat) {
        const e = beat / 2;
        melody(c, b, 8, 24).forEach((n, i) => n && note(o, t0 + i * e, e * 0.8, hz(n), { wave: 'pulse', vol: 0.16, release: 0.02 }));
        for (let i = 0; i < 8; i++) note(o, t0 + i * e, e * 0.9, hz(c[0] - 12 + (i % 2 ? 12 : 0)), { wave: 'triangle', vol: 0.35, release: 0.01 });
        for (let i = 0; i < 16; i++) note(o, t0 + (i * beat) / 4, beat / 4.5, hz(c[i % 3] + 12), { wave: 'square', vol: 0.05, release: 0.005 });
        for (let i = 0; i < 4; i++) {
          if (i % 2 === 0) kick(o, t0 + i * beat, 0.5);
          else noise(o, t0 + i * beat, 0.12, { vol: 0.35, tone: 0.4 });
          noise(o, t0 + i * beat + e, 0.03, { vol: 0.12, tone: 0.9 });
        }
      },
    },
  },
  synthwave: {
    label: 'Night Drive',
    help: 'Synthwave with warm pads and a steady beat',
    seed: 23,
    song: {
      bpm: 100,
      bars: 16,
      chords: [chord(57, 'min'), chord(53, 'maj7'), chord(48, 'maj'), chord(55, 'sus')],
      bar(o, c, b, t0, beat) {
        for (const n of c) note(o, t0, beat * 3.8, hz(n), { wave: 'saw', vol: 0.07, attack: 0.3, release: 0.5, detune: 0.006 });
        for (let i = 0; i < 8; i++) note(o, t0 + (i * beat) / 2, beat / 2.4, hz(c[0] - 24), { wave: 'saw', vol: 0.18, release: 0.03 });
        if (b >= 4) melody(c, b, 4, 12).forEach((n, i) => n && note(o, t0 + i * beat, beat * 0.9, hz(n), { wave: 'triangle', vol: 0.18, release: 0.2, vibrato: 0.004 }));
        for (let i = 0; i < 4; i++) {
          kick(o, t0 + i * beat, 0.45);
          if (i % 2) noise(o, t0 + i * beat, 0.25, { vol: 0.3, tone: 0.45 });
        }
      },
    },
  },
  lofi: {
    label: 'Cosy Lo-fi',
    help: 'Slow, mellow keys with a lazy beat',
    seed: 37,
    song: {
      bpm: 78,
      bars: 12,
      chords: [chord(53, 'maj7'), chord(52, 'min7'), chord(50, 'min7'), chord(48, 'maj7')],
      bar(o, c, b, t0, beat) {
        // Soft keys: each chord note a little after the last, like a hand on a piano.
        c.forEach((n, k) => note(o, t0 + k * 0.025, beat * 1.8, hz(n), { vol: 0.12, decay: 1.4, release: 0.4 }));
        c.forEach((n, k) => note(o, t0 + 2 * beat + k * 0.025, beat * 1.6, hz(n), { vol: 0.09, decay: 1.2, release: 0.4 }));
        note(o, t0, beat * 1.5, hz(c[0] - 24), { wave: 'triangle', vol: 0.3, release: 0.1 });
        note(o, t0 + 2.5 * beat, beat, hz(c[2] - 24), { wave: 'triangle', vol: 0.25, release: 0.1 });
        melody(c, b, 4, 12).forEach((n, i) => n && i % 2 === 0 && note(o, t0 + i * beat + 0.06, beat * 0.8, hz(n), { vol: 0.08, decay: 0.6, release: 0.3 }));
        kick(o, t0, 0.4);
        kick(o, t0 + 2.6 * beat, 0.3);
        noise(o, t0 + beat, 0.2, { vol: 0.18, tone: 0.3 });
        noise(o, t0 + 3 * beat, 0.2, { vol: 0.18, tone: 0.3 });
        // Swung hats.
        for (let i = 0; i < 4; i++) {
          noise(o, t0 + i * beat, 0.04, { vol: 0.06, tone: 0.9 });
          noise(o, t0 + i * beat + beat * 0.62, 0.03, { vol: 0.04, tone: 0.9 });
        }
      },
    },
  },
  ambient: {
    label: 'Calm Space',
    help: 'Slow, floating pads and bells, no drums',
    seed: 41,
    song: {
      bpm: 60,
      bars: 10,
      chords: [chord(50, 'sus'), chord(48, 'maj7'), chord(45, 'min7'), chord(47, 'sus'), chord(48, 'maj')],
      bar(o, c, b, t0, beat) {
        for (const n of c) note(o, t0, beat * 3.6, hz(n), { wave: 'triangle', vol: 0.1, attack: 1.2, release: 1.2, detune: 0.004 });
        note(o, t0, beat * 3.6, hz(c[0] - 12), { vol: 0.16, attack: 1, release: 1.2 });
        melody(c, b, 4, 24).forEach((n, i) => n && i % 2 === b % 2 && note(o, t0 + i * beat, 0.05, hz(n), { vol: 0.07, decay: 1.1, release: 1.5 }));
      },
    },
  },
};

export const MUSIC: SoundPreset[] = Object.entries(SONGS).map(([id, s]) => ({ id, label: s.label, help: s.help, make: () => render(s.song, s.seed) }));

// ---- files ---------------------------------------------------------------------------------------

/** 16-bit mono .wav file bytes. */
export function wavBytes(samples: Float32Array, rate = RATE): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(out.buffer);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Where the app's own sounds go in a theme. */
export const SOUND_DIR = '_inc/ccs/sounds';
export const MUSIC_DIR = '_inc/ccs/music';

/** Parts that can have a scroll sound: the console carousel or grid, and the game lists. */
export const SCROLL_TYPES = new Set(['carousel', 'textlist', 'imagegrid']);
