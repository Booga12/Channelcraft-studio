import { describe, expect, it } from 'vitest';
import { compareIgnoreCase, firstWithArt, gameBinding, parseGamelist } from './games';
import { isArcadeSystem, parseEsSystems } from './systems';

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

  it('reads a repeated entry into the same game, keeping what the later one lacks', () => {
    const xml = `<gameList>
      <game><path>./Kirby.xci</path><name>Kirby</name><desc>Pink</desc><image>./images/kirby.png</image><video>./videos/kirby.mp4</video></game>
      <game><path>./Kirby.xci</path><name>Kirby!</name><playcount>3</playcount><marquee>./images/logo.png</marquee></game>
    </gameList>`;
    for (const roms of [['./Kirby.xci'], undefined]) {
      const [g, ...rest] = parseGamelist(xml, DIR, roms);
      expect(rest).toEqual([]);
      expect([g.name, g.description, g.playcount]).toEqual(['Kirby!', 'Pink', '3']);
      expect(Object.keys(g.media).sort()).toEqual(['image', 'marquee', 'video']);
      expect(firstWithArt([g])).toBe(0);
    }
  });

  it('sorts like RetroBat: upper-cased, then by code point', () => {
    const xml = ['_Test', 'Zelda', 'Éclair', 'eagle', '[Hack] Mario', 'Pokémon', 'Pokemon Red'].map((n, i) => `<game><path>./${i}.nsp</path><name>${n}</name></game>`).join('');
    const list = parseGamelist(`<gameList>${xml}</gameList>`, DIR, ['./0.nsp', './1.nsp', './2.nsp', './3.nsp', './4.nsp', './5.nsp', './6.nsp']);
    expect(list.map((g) => g.name)).toEqual(['eagle', 'Pokemon Red', 'Pokémon', 'Zelda', '[Hack] Mario', '_Test', 'Éclair']);
    expect(compareIgnoreCase('abc', 'ABC')).toBe(0);
    expect(compareIgnoreCase('ab', 'abc')).toBeLessThan(0);
  });

  it('on arcade systems, leaves out ROM files without an entry (BIOS and devices)', () => {
    const xml = '<gameList><game><path>./mslug.zip</path><name>Metal Slug</name></game><game><path>./kof98.zip</path></game></gameList>';
    const roms = ['./kof98.zip', './mslug.zip', './neogeo.zip', './qsound.zip'];
    expect(parseGamelist(xml, DIR, roms, true).map((g) => g.name)).toEqual(['kof98', 'Metal Slug']);
    expect(parseGamelist(xml, DIR, roms).map((g) => g.name)).toEqual(['kof98', 'Metal Slug', 'neogeo', 'qsound']);
  });

  it('knows which systems RetroBat treats as arcade or Neo Geo', () => {
    const cfg = `<systemList>
      <system><name>fbneo</name><platform>arcade</platform></system>
      <system><name>neogeo</name><platform>neogeo</platform></system>
      <system><name>daphne</name><platform>alg, daphne, arcade</platform></system>
      <system><name>neogeocd</name><platform>neogeocd</platform></system>
      <system><name>snes</name><platform>snes</platform></system>
      <system><name>mame</name></system>
      <system><name>psx</name></system>
    </systemList>`;
    const systems = parseEsSystems(cfg);
    expect(systems[2].platforms).toEqual(['alg', 'daphne', 'arcade']);
    expect(systems.filter(isArcadeSystem).map((s) => s.name)).toEqual(['fbneo', 'neogeo', 'daphne', 'mame']);
  });

  it('opens on the first game with artwork', () => {
    const list = parseGamelist(SWITCH, DIR, ['./a.nsp', './Kirby and the Forgotten Land.xci']);
    expect(list.map((g) => g.name)).toEqual(['a', 'Kirby and the Forgotten Land']);
    expect(firstWithArt(list)).toBe(1);
    expect(firstWithArt([])).toBe(0);
  });
});
