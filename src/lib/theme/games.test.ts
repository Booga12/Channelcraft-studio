import { describe, expect, it } from 'vitest';
import { firstWithArt, gameBinding, parseGamelist } from './games';
import { parseEsSystems } from './systems';

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

describe('the game list is built from the ROM files, as in RetroBat (#60)', () => {
  const DIR = 'M:/Retrobat/roms/switch';
  const SWITCH = String.raw`<?xml version="1.0"?>
<gameList>
  <game><path>./Kirby and the Forgotten Land.xci</path><name>Kirby and the Forgotten Land</name><image>./images/kirby.png</image></game>
  <game><path>./Kirby and the Forgotten Land.xci</path><name>Kirby and the Forgotten Land</name><image>./images/kirby2.png</image></game>
  <game><path>./Kirby and the Forgotten Land [v0].nsp</path><name>Kirby and the Forgotten Land</name></game>
  <game><path>./readme.txt</path><name>Readme</name></game>
</gameList>`;

  it('shows each game once, leaving out entries for files that are gone', () => {
    const list = parseGamelist(SWITCH, DIR, ['./Kirby and the Forgotten Land.xci']);
    expect(list.map((g) => g.name)).toEqual(['Kirby and the Forgotten Land']);
    // The later entry for the same file wins.
    expect(list[0].media.image).toMatch(/kirby2\.png$/);
  });

  it('shows ROMs without a gamelist entry or name under their file name', () => {
    const xml = '<gameList><game><path>./sub/Bar.nsp</path><rating>0.5</rating></game></gameList>';
    const list = parseGamelist(xml, DIR, ['./Foo (USA).nsp', './sub/Bar.nsp']);
    expect(list.map((g) => [g.name, g.path])).toEqual([
      ['Bar', './sub/Bar.nsp'],
      ['Foo (USA)', './Foo (USA).nsp'],
    ]);
    expect(list[0].rating).toBe(0.5);
  });

  it('drops hidden games and sorts by sort name or name, ignoring case', () => {
    const xml = `<gameList>
      <game><path>./c.nsp</path><name>c</name></game>
      <game><path>./a.nsp</path><name>a</name></game>
      <game><path>./h.nsp</path><name>Hidden</name><hidden>true</hidden></game>
      <game><path>./z.nsp</path><name>Zelda</name><sortname>0 Zelda</sortname></game>
      <game><path>./b.nsp</path><name>B</name></game>
    </gameList>`;
    const list = parseGamelist(xml, DIR, ['./a.nsp', './b.nsp', './c.nsp', './h.nsp', './z.nsp']);
    expect(list.map((g) => g.name)).toEqual(['Zelda', 'a', 'B', 'c']);
  });

  it('matches paths however they are written', () => {
    for (const p of [String.raw`.\sub\x.nsp`, './sub/x.nsp', 'sub/x.nsp', String.raw`M:\Retrobat\roms\switch\sub\x.nsp`]) {
      const list = parseGamelist(`<gameList><game><path>${p}</path><name>X game</name></game></gameList>`, DIR, ['./sub/x.nsp']);
      expect(list.map((g) => g.name), p).toEqual(['X game']);
    }
  });

  it('without the ROM files, keeps one game per path, sorted by name', () => {
    const list = parseGamelist(SWITCH, DIR);
    expect(list.map((g) => g.path)).toEqual(['./Kirby and the Forgotten Land.xci', './Kirby and the Forgotten Land [v0].nsp', './readme.txt']);
  });

  it('reads each system’s game extensions from es_systems.cfg', () => {
    const [s] = parseEsSystems('<systemList><system><name>switch</name><extension>.nso .NSP,.xci\n .kip</extension></system></systemList>');
    expect(s.extensions).toEqual(['.nso', '.nsp', '.xci', '.kip']);
  });

  it('opens on the first game with artwork', () => {
    const list = parseGamelist(SWITCH, DIR, ['./a.nsp', './Kirby and the Forgotten Land.xci']);
    expect(list.map((g) => g.name)).toEqual(['a', 'Kirby and the Forgotten Land']);
    expect(firstWithArt(list)).toBe(1);
    expect(firstWithArt([])).toBe(0);
  });
});
