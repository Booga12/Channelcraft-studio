import { describe, expect, it } from 'vitest';
import { homeFrom, reportUrl, scrub, windowsName } from './problems';

describe('reporting a problem', () => {
  it('finds the home folder and keeps it out of reports', () => {
    const home = homeFrom('C:\\Users\\Jane Doe\\AppData\\Local\\com.channelcraft.studio\\logs\\problems.log');
    expect(home).toBe('C:\\Users\\Jane Doe');
    const text = 'Failed: C:\\Users\\Jane Doe\\Documents\\x.png and c:/users/jane doe/y and C:\\\\Users\\\\Jane Doe\\\\z';
    expect(scrub(text, home)).toBe('Failed: ~\\Documents\\x.png and ~/y and ~\\\\z');
    expect(scrub('Hello fatbo, fatboy', 'C:\\Users\\fatbo')).toBe('Hello <you>, fatboy');
    expect(scrub('same', null)).toBe('same');
  });

  it('names the Windows version', () => {
    expect(windowsName('15.0.0')).toBe('Windows 11');
    expect(windowsName('10.0.0')).toBe('Windows 10');
    expect(windowsName(undefined)).toBe('Windows');
  });

  it('fills in the GitHub issue form', () => {
    const url = new URL(reportUrl({ what: 'Crash when saving\nmore', steps: '1. Save', version: '0.2.1', windows: 'Windows 11', log: '' }));
    expect(url.origin + url.pathname).toBe('https://github.com/Booga12/Channelcraft-studio/issues/new');
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    expect(url.searchParams.get('title')).toBe('Problem: Crash when saving');
    expect(url.searchParams.get('version')).toBe('0.2.1');
    expect(url.searchParams.has('log')).toBe(false);
  });

  it('shortens a long log to its newest part', () => {
    const lines = Array.from({ length: 800 }, (_, i) => `[2026-10-26] Error: line ${i}`).join('\n');
    const url = reportUrl({ what: 'x', steps: '', version: '1', windows: 'w', log: lines });
    expect(url.length).toBeLessThanOrEqual(7000);
    const log = new URL(url).searchParams.get('log') ?? '';
    expect(log).toContain('line 799');
    expect(log).not.toContain('line 0\n');
  });
});
