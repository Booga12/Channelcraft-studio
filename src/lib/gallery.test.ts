import { describe, expect, it } from 'vitest';
import { GALLERY_SITE, leftOutNote, nameProblem, publishError } from './gallery';

describe('gallery', () => {
  it('has one https address', () => {
    expect(GALLERY_SITE).toMatch(/^https?:\/\//);
  });

  it('checks the theme name and maker name', () => {
    expect(nameProblem('Neon Nights', 'theme')).toBeNull();
    expect(nameProblem('   ', 'theme')).toBe('Give the theme a name.');
    expect(nameProblem('', 'maker')).toBe('Say who made it.');
    expect(nameProblem('x'.repeat(60), 'theme')).toBeNull();
    expect(nameProblem('x'.repeat(61), 'theme')).toContain('60');
    expect(nameProblem(` ${'y'.repeat(40)} `, 'maker')).toBeNull();
    expect(nameProblem('y'.repeat(41), 'maker')).toContain('40');
  });

  it('says which files were left out', () => {
    expect(leftOutNote([])).toBeNull();
    expect(leftOutNote(undefined)).toBeNull();
    expect(leftOutNote(['_inc/a.psd'])).toBe('1 file the gallery doesn’t take was left out: a.psd.');
    expect(leftOutNote(['a.psd', 'b.bak', 'c.ico'])).toBe('3 files the gallery doesn’t take were left out: a.psd, b.bak, c.ico.');
    expect(leftOutNote(['a.psd', 'b.bak', 'c.ico', 'd.url'])).toBe('4 files the gallery doesn’t take were left out: a.psd, b.bak, c.ico, …');
  });

  it('shows the error sentence as it came', () => {
    expect(publishError("Couldn't reach the gallery. Check your internet connection and try again.")).toMatch(/^Couldn't reach/);
    expect(publishError(new Error('The theme is too big: the limit is 25 MB.'))).toBe('The theme is too big: the limit is 25 MB.');
    expect(publishError('')).toBe('Publishing failed. Please try again.');
    expect(publishError(undefined)).toBe('Publishing failed. Please try again.');
  });
});
