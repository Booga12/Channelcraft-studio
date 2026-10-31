import { describe, expect, it } from 'vitest';
import { elementLabel, propHelp, propLabel, SIMPLE_PROPS } from './friendly';

describe('plain words for settings', () => {
  it('explains every setting Simple mode shows ("What\'s this?")', () => {
    const missing = [...SIMPLE_PROPS].filter((p) => !propHelp(p));
    expect(missing).toEqual([]);
  });

  it('gives each one a name that is not its code name', () => {
    for (const p of SIMPLE_PROPS) expect(propLabel(p), p).not.toBe(p);
  });

  it('names RetroBat’s detail labels in plain words', () => {
    expect(elementLabel('md_lbl_genre')).toBe('Genre label');
    expect(elementLabel('md_lbl_developer')).toBe('Developer label');
    expect(elementLabel('md_lbl_players')).toBe('Players label');
  });
});
