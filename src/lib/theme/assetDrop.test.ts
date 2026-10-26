import { describe, expect, it } from 'vitest';
import { addsAsNew, dropFit, kindOfFile, nameFromFile, newAssetBody } from './assetDrop';

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

describe('adding a file as a new element', () => {
  it('adds pictures and videos, not sounds or fonts', () => {
    expect(addsAsNew('image')).toBe(true);
    expect(addsAsNew('video')).toBe(true);
    expect(addsAsNew('sound')).toBe(false);
    expect(addsAsNew('font')).toBe(false);
    expect(kindOfFile('C:\\pics\\Logo.PNG')).toBe('image');
    expect(kindOfFile('clip.mp4')).toBe('video');
    expect(kindOfFile('notes.txt')).toBe(null);
  });

  it('names the layer after the file', () => {
    expect(nameFromFile('C:\\pics\\My Logo (1).png', 'image')).toBe('my_logo_1');
    expect(nameFromFile('/x/123.png', 'image')).toBe('picture');
    expect(nameFromFile('_.mp4', 'video')).toBe('video');
  });

  it('centres it where dropped, keeps it on screen, keeps its shape and puts it on top', () => {
    const body = newAssetBody('image', './_inc/images/logo.png', { x: 0.25, y: 0.6 }, 46);
    expect(body).toContain('<pos>0.25 0.6</pos>');
    expect(body).toContain('<origin>0.5 0.5</origin>');
    expect(body).toContain('<maxSize>0.3 0.3</maxSize>');
    expect(body).toContain('<path>./_inc/images/logo.png</path>');
    expect(body).toContain('<zIndex>46</zIndex>');
    expect(newAssetBody('image', 'a.png', { x: 0.99, y: -0.2 }, 1)).toContain('<pos>0.85 0.15</pos>');
    expect(newAssetBody('video', 'v.mp4', { x: 0.5, y: 0.5 }, 1)).toContain('<maxSize>0.4 0.4</maxSize>');
  });

  it('writes XML RetroBat can read, even for odd file names', () => {
    const body = newAssetBody('image', './_inc/images/a&b<c>.png', { x: 0.5, y: 0.5 }, 1);
    expect(body).toContain('<path>./_inc/images/a&amp;b&lt;c>.png</path>');
    // Only the element's own tags remain.
    expect(body.match(/<[a-zA-Z]+>/g)).toEqual(['<pos>', '<origin>', '<maxSize>', '<path>', '<zIndex>']);
  });
});
