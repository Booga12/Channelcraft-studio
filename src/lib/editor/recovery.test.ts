import { describe, expect, it } from 'vitest';
import { changedSinceKept } from './saving';

describe('crash recovery (#43)', () => {
  const disk: Record<string, string> = { 'theme.xml': '<theme>saved</theme>', '_inc/a.xml': '<theme>a</theme>' };
  const current = (rel: string) => disk[rel];

  it('offers nothing when the kept text is the theme as it is now (edits undone)', () => {
    expect(changedSinceKept([{ rel: 'theme.xml', src: '<theme>saved</theme>' }], current)).toEqual([]);
  });

  it('offers only the files that really differ', () => {
    const kept = [
      { rel: 'theme.xml', src: '<theme>edited</theme>' },
      { rel: '_inc/a.xml', src: '<theme>a</theme>' },
    ];
    expect(changedSinceKept(kept, current).map((f) => f.rel)).toEqual(['theme.xml']);
  });

  it('skips files the theme no longer has', () => {
    expect(changedSinceKept([{ rel: 'gone.xml', src: 'x' }], current)).toEqual([]);
  });
});
