// Free game artwork from the libretro-thumbnails project (github.com/libretro-thumbnails): box art,
// title screens and in-game snaps, named after No-Intro/Redump ROM names. Used only to fill the
// preview where a game has no scraped picture; nothing from here is written into a theme.

import type { GameInfo } from './games';

/** RetroBat system names to libretro-thumbnails repositories. */
const REPOS: Record<string, string> = {
  nes: 'Nintendo_-_Nintendo_Entertainment_System',
  famicom: 'Nintendo_-_Nintendo_Entertainment_System',
  fds: 'Nintendo_-_Family_Computer_Disk_System',
  snes: 'Nintendo_-_Super_Nintendo_Entertainment_System',
  sfc: 'Nintendo_-_Super_Nintendo_Entertainment_System',
  satellaview: 'Nintendo_-_Satellaview',
  n64: 'Nintendo_-_Nintendo_64',
  gb: 'Nintendo_-_Game_Boy',
  gbc: 'Nintendo_-_Game_Boy_Color',
  gba: 'Nintendo_-_Game_Boy_Advance',
  nds: 'Nintendo_-_Nintendo_DS',
  '3ds': 'Nintendo_-_Nintendo_3DS',
  gamecube: 'Nintendo_-_GameCube',
  wii: 'Nintendo_-_Wii',
  virtualboy: 'Nintendo_-_Virtual_Boy',
  pokemini: 'Nintendo_-_Pokemon_Mini',
  megadrive: 'Sega_-_Mega_Drive_-_Genesis',
  genesis: 'Sega_-_Mega_Drive_-_Genesis',
  mastersystem: 'Sega_-_Master_System_-_Mark_III',
  gamegear: 'Sega_-_Game_Gear',
  sega32x: 'Sega_-_32X',
  segacd: 'Sega_-_Mega-CD_-_Sega_CD',
  saturn: 'Sega_-_Saturn',
  dreamcast: 'Sega_-_Dreamcast',
  sg1000: 'Sega_-_SG-1000',
  psx: 'Sony_-_PlayStation',
  ps2: 'Sony_-_PlayStation_2',
  psp: 'Sony_-_PlayStation_Portable',
  pcengine: 'NEC_-_PC_Engine_-_TurboGrafx_16',
  pcenginecd: 'NEC_-_PC_Engine_CD_-_TurboGrafx-CD',
  supergrafx: 'NEC_-_PC_Engine_SuperGrafx',
  atari2600: 'Atari_-_2600',
  atari5200: 'Atari_-_5200',
  atari7800: 'Atari_-_7800',
  lynx: 'Atari_-_Lynx',
  jaguar: 'Atari_-_Jaguar',
  ngp: 'SNK_-_Neo_Geo_Pocket',
  ngpc: 'SNK_-_Neo_Geo_Pocket_Color',
  wswan: 'Bandai_-_WonderSwan',
  wswanc: 'Bandai_-_WonderSwan_Color',
  colecovision: 'Coleco_-_ColecoVision',
  intellivision: 'Mattel_-_Intellivision',
  vectrex: 'GCE_-_Vectrex',
  '3do': 'The_3DO_Company_-_3DO',
  msx: 'Microsoft_-_MSX',
  msx1: 'Microsoft_-_MSX',
  msx2: 'Microsoft_-_MSX2',
  c64: 'Commodore_-_64',
  amiga: 'Commodore_-_Amiga',
};

const BASE = 'https://raw.githubusercontent.com/libretro-thumbnails';

/** A ROM file name as libretro-thumbnails names its pictures: no extension, and characters Windows can't use in names (& * / : ` < > ? \ |) as _. */
export function thumbnailName(romPath: string): string {
  const file = romPath.replace(/[\\/]+$/, '').replace(/^.*[\\/]/, '');
  const stem = file.includes('.') ? file.slice(0, file.lastIndexOf('.')) : file;
  return stem.replace(/[&*/:`<>?\\|]/g, '_');
}

/** Online box art, title screen and snap for a game on a system, or null for systems not covered. */
export function libretroArt(system: string, romPath: string): { boxart: string; titleshot: string; image: string } | null {
  const repo = REPOS[system.toLowerCase()];
  const name = thumbnailName(romPath);
  if (!repo || !name) return null;
  const url = (dir: string) => `${BASE}/${repo}/master/${dir}/${encodeURIComponent(name)}.png`;
  return { boxart: url('Named_Boxarts'), titleshot: url('Named_Titles'), image: url('Named_Snaps') };
}

/** The games with missing pictures filled from libretro-thumbnails (their own pictures always win). */
export function withOnlineArt(system: string, games: GameInfo[]): GameInfo[] {
  return games.map((g) => {
    const art = libretroArt(system, g.path);
    if (!art) return g;
    const media = { ...g.media };
    if (!media.boxart && !media.thumbnail) media.boxart = art.boxart;
    if (!media.image) media.image = art.image;
    if (!media.titleshot) media.titleshot = art.titleshot;
    return { ...g, media };
  });
}

export const isRemote = (p: string) => /^https?:\/\//i.test(p.trim());
