import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { paintedLogo } from './splashLogo';
import { LOGO_COLOURS } from './logo';

// The splash window (#61) loads before the app, so static/splash.html carries its own copy of the
// painted logo and the logo colours: they must match the app's.
describe('start-up splash', () => {
  const html = readFileSync('static/splash.html', 'utf8');

  it('has the painted logo the app makes', () => {
    expect(html).toContain(paintedLogo('aurora'));
  });

  it('knows every logo colour', () => {
    const colours = JSON.parse(html.match(/const COLOURS = (\{.*?\});/)![1]);
    expect(colours).toEqual(Object.fromEntries(Object.entries(LOGO_COLOURS).map(([k, v]) => [k, v.stops])));
  });

  it('stays at least 4 seconds and hands over to the app window', () => {
    expect(html).toContain('const MIN = 4000;');
    expect(html).toContain("invoke('splash_state')");
    expect(html).toContain("invoke('splash_done')");
  });
});
