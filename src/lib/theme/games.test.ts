import { describe, expect, it } from 'vitest';
import { gameBinding, parseGamelist } from './games';

const LIST = String.raw`<?xml version="1.0"?>
<gameList>
  <game>
    <path>./Mario.sfc</path>
    <name>Mario</name>
    <rating>0.7</rating>
    <gametime>9000</gametime>
    <image>./images/mario.png</image>
    <video>../videos/mario.mp4</video>
    <marquee>~/media/mario-logo.png</marquee>
    <fanart>D:\Art\mario.jpg</fanart>
  </game>
  <game>
    <path>./Hidden.sfc</path>
    <name>Hidden</name>
    <hidden>true</hidden>
  </game>
</gameList>`;

describe('gamelists read like RetroBat reads them', () => {
  const [g, ...rest] = parseGamelist(LIST, String.raw`M:\Retrobat\roms\snes`);

  it('skips hidden games', () => {
    expect(rest).toEqual([]);
    expect(g.name).toBe('Mario');
  });

  it('finds media with ./, ../, ~/ and absolute paths', () => {
    expect(g.media.image).toBe(String.raw`M:\Retrobat\roms\snes\images\mario.png`);
    expect(g.media.video).toBe(String.raw`M:\Retrobat\roms\videos\mario.mp4`);
    expect(g.media.marquee).toBe(String.raw`M:\Retrobat\roms\snes\media\mario-logo.png`);
    expect(g.media.fanart).toBe(String.raw`D:\Art\mario.jpg`);
  });

  it('keeps the rating as a 0–1 share and play time in seconds', () => {
    expect(gameBinding(g, 'rating')).toBe(0.7);
    expect(gameBinding(g, 'gametime')).toBe('9000');
  });
});
