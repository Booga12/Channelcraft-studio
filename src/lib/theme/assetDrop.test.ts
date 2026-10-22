import { describe, expect, it } from 'vitest';
import { dropFit } from './assetDrop';

describe('dropFit', () => {
  it('links matching kinds to the main path', () => {
    expect(dropFit('video', 'myvideo', 'video')).toEqual({ ok: true, prop: 'path' });
    expect(dropFit('image', 'logo', 'image')).toEqual({ ok: true, prop: 'path' });
    expect(dropFit('ninepatch', 'frame', 'image')).toEqual({ ok: true, prop: 'path' });
    expect(dropFit('sound', 'bgsound', 'sound')).toEqual({ ok: true, prop: 'path' });
    expect(dropFit('text', 'title', 'font')).toEqual({ ok: true, prop: 'fontPath' });
  });

  it('uses the side properties that fit', () => {
    expect(dropFit('video', 'v', 'image')).toMatchObject({ ok: true, prop: 'default' });
    expect(dropFit('textlist', 'gamelist', 'sound')).toMatchObject({ ok: true, prop: 'scrollSound' });
    expect(dropFit('textlist', 'gamelist', 'font')).toMatchObject({ ok: true, prop: 'fontPath' });
  });

  it("keeps RetroBat's game media and sets only their fallback picture", () => {
    expect(dropFit('video', 'md_video', 'video').ok).toBe(false);
    expect(dropFit('image', 'md_image', 'image')).toMatchObject({ ok: true, prop: 'default' });
  });

  it('explains a mismatch', () => {
    const f = dropFit('image', 'logo', 'video');
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.hint).toMatch(/video element/);
    expect(dropFit('text', 'title', 'video').ok).toBe(false);
    expect(dropFit('container', 'box', 'font').ok).toBe(false);
  });

  it('checks a forced property', () => {
    expect(dropFit('rating', 'r', 'image', 'filledPath')).toEqual({ ok: true, prop: 'filledPath' });
    expect(dropFit('video', 'v', 'image', 'path').ok).toBe(false);
  });
});
