import { describe, expect, it } from 'vitest';
import { currentGameIndex, listRows, listWindow } from './context';
import { MOCK_GAME, MOCK_GAMES } from './systems';
import type { GameInfo } from './games';

const game = (name: string) => ({ path: `./${name}.zip`, name, media: {} }) as unknown as GameInfo;
const games = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map(game);
const names = games.map((g) => g.name);

describe('preview game list', () => {
  it('finds the shown game in the list', () => {
    expect(currentGameIndex({ game: games[3], games, gameNames: names })).toBe(3);
    // Without a match by path, by name in the row names.
    expect(currentGameIndex({ game: game('Charlie'), gameNames: names })).toBe(2);
    // The sample game sits in the sample names.
    expect(MOCK_GAMES[currentGameIndex({})]).toBe(MOCK_GAME.name);
  });

  it('scrolls the text list like RetroBat: no wrapping, stops at the ends', () => {
    const many = Array.from({ length: 20 }, (_, i) => `G${i}`);
    for (let cur = 0; cur < many.length; cur++) {
      const { rows, sel } = listWindow(many, cur, 7);
      expect(rows).toHaveLength(7);
      expect(rows[sel]).toBe(many[cur]);
      expect(new Set(rows).size).toBe(7);
    }
    expect(listWindow(many, 0, 7)).toEqual({ rows: many.slice(0, 7), sel: 0 });
    expect(listWindow(many, 10, 7)).toEqual({ rows: many.slice(7, 14), sel: 3 });
    expect(listWindow(many, 19, 7)).toEqual({ rows: many.slice(13, 20), sel: 6 });
    // Fewer games than rows: each game once, from the top.
    expect(listWindow(names, 4, 8)).toEqual({ rows: names, sel: 4 });
    expect(listWindow([], 0, 3)).toEqual({ rows: [], sel: -1 });
  });

  it('puts the shown game on the highlighted grid tile', () => {
    for (let cur = 0; cur < names.length; cur++) {
      const rows = listRows(names, cur, 8, 2);
      expect(rows).toHaveLength(8);
      expect(rows[2]).toBe(names[cur]);
    }
    expect(listRows(names, 0, 4, 2)).toEqual(['Delta', 'Echo', 'Alpha', 'Bravo']);
    expect(listRows(names, 4, 3, 0)).toEqual(['Echo', 'Alpha', 'Bravo']);
    expect(listRows([], 0, 3, 1)).toEqual([]);
  });
});
