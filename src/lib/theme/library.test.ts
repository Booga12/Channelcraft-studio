import { describe, expect, it } from 'vitest';
import { consoleScreenPath, itemsFor, usesGameData } from './library';

describe('game data on the console screen (RetroBat has no current game there)', () => {
  it('spots the current game’s data, not the console’s', () => {
    expect(usesGameData('{game:video}')).toBe(true);
    expect(usesGameData('firstfile({game:boxart}, {game:image})')).toBe(true);
    expect(usesGameData('{system:fullName}')).toBe(false);
    expect(usesGameData('{random:image}')).toBe(false);
  });

  it('switches pictures and videos to a random game of the console, as SystemView.cpp offers', () => {
    expect(consoleScreenPath('video', '{game:video}')).toBe('{random}');
    expect(consoleScreenPath('image', 'firstfile({game:boxart}, {game:image})')).toBe('{random:thumbnail}');
    expect(consoleScreenPath('image', '{game:marquee}')).toBe('{random:marquee}');
    expect(consoleScreenPath('image', '{game:fanart}')).toBe('{random:fanart}');
    expect(consoleScreenPath('image', '{game:image}')).toBe('{random:image}');
    expect(consoleScreenPath('text', '{game:name}')).toBeNull();
    expect(consoleScreenPath('image', './art/bg.png')).toBeNull();
  });
});

describe('the clock item (#58)', () => {
  it("is RetroBat's own clock on the Screen overlay: a text named clock, no extra, no zIndex", () => {
    const clock = itemsFor('screen').find((i) => i.id === 'clock')!;
    expect(clock.type).toBe('text');
    expect(clock.name).toBe('clock');
    expect(clock.native).toBe(true);
    expect(clock.body).toContain('<size>0.3 0.05</size>');
    expect(clock.body).not.toContain('zIndex');
    expect(clock.body).not.toContain('<text>');
  });

  it('is a clock part on other screens', () => {
    const clock = itemsFor('detailed').find((i) => i.id === 'clock')!;
    expect(clock.type).toBe('clock');
    expect(clock.native).toBe(false);
  });
});
