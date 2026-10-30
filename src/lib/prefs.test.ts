import { describe, expect, it } from 'vitest';
import { readPrefs } from './prefs.svelte';

describe('online pictures preference', () => {
  it('is off for a new install', () => {
    expect(readPrefs(null).onlineArt).toBe(false);
    expect(readPrefs('not json').onlineArt).toBe(false);
  });

  it('is off when saved prefs predate the setting', () => {
    expect(readPrefs(JSON.stringify({ mode: 'dark' })).onlineArt).toBe(false);
  });

  it('keeps the value a user saved', () => {
    expect(readPrefs(JSON.stringify({ onlineArt: true })).onlineArt).toBe(true);
    expect(readPrefs(JSON.stringify({ onlineArt: false })).onlineArt).toBe(false);
  });
});
