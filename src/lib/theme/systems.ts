import { elements, parse, textOf } from '../xml/cst';

export interface SystemInfo {
  name: string;
  theme: string;
  fullName: string;
  manufacturer: string;
  releaseYear: string;
  hardwareType: string;
  /** The ROM folder as es_systems.cfg writes it (e.g. `~\..\roms\snes`), if known. */
  path?: string;
}

/** Used when es_systems.cfg can't be read. */
export const FALLBACK_SYSTEMS: SystemInfo[] = [
  ['snes', 'Super Nintendo', 'Nintendo', '1990', 'console'],
  ['nes', 'Nintendo Entertainment System', 'Nintendo', '1983', 'console'],
  ['n64', 'Nintendo 64', 'Nintendo', '1996', 'console'],
  ['gc', 'Nintendo GameCube', 'Nintendo', '2001', 'console'],
  ['wii', 'Nintendo Wii', 'Nintendo', '2006', 'console'],
  ['gba', 'Game Boy Advance', 'Nintendo', '2001', 'portable'],
  ['megadrive', 'Sega Mega Drive', 'Sega', '1988', 'console'],
  ['dreamcast', 'Sega Dreamcast', 'Sega', '1998', 'console'],
  ['psx', 'Sony PlayStation', 'Sony', '1994', 'console'],
  ['ps2', 'Sony PlayStation 2', 'Sony', '2000', 'console'],
  ['arcade', 'Arcade', 'Arcade', '', 'arcade'],
  ['mame', 'MAME', 'Arcade', '', 'arcade'],
].map(([name, fullName, manufacturer, releaseYear, hardwareType]) => ({
  name,
  theme: name,
  fullName,
  manufacturer,
  releaseYear,
  hardwareType,
}));

export function parseEsSystems(text: string): SystemInfo[] {
  const doc = parse(text);
  if (!doc.root) return [];
  const out: SystemInfo[] = [];
  for (const sys of elements(doc.root).filter((e) => e.name === 'system')) {
    const get = (n: string) => {
      const el = elements(sys).find((e) => e.name === n);
      return el ? textOf(doc, el).trim() : '';
    };
    const name = get('name');
    // Some installs list a system twice; the first entry wins.
    if (!name || out.some((s) => s.name === name)) continue;
    out.push({
      name,
      theme: get('theme') || name,
      fullName: get('fullname') || name,
      manufacturer: get('manufacturer'),
      releaseYear: get('release').slice(0, 4),
      hardwareType: get('hardware') || 'console',
      path: get('path') || undefined,
    });
  }
  return out;
}

export interface MockGame {
  name: string;
  description: string;
  rating: number;
  releasedate: string;
  developer: string;
  publisher: string;
  genre: string;
  players: string;
  lastplayed: string;
  playcount: string;
  favorite: boolean;
}

export const MOCK_GAMES: string[] = [
  'Aero Racer DX',
  'Castle of Shadows',
  'Dragon Quest Legends',
  'Fighting Spirit II',
  'Galaxy Patrol',
  'Hyper Kart Rally',
  'Jungle Run',
  'Kingdom Tactics',
  'Mega Puzzle Pop',
  'Neon Blaster',
  'Ocean Odyssey',
  'Pixel Soccer 94',
  'Robo Rumble',
  'Sky Knights',
];

export const MOCK_GAME: MockGame = {
  name: 'Dragon Quest Legends',
  description:
    'A young hero sets out across a vast kingdom to recover the five crystal shards and stop the shadow king. Explore towns, recruit companions and battle monsters in this classic turn-based adventure.',
  rating: 0.8,
  releasedate: '19921121T000000',
  developer: 'Pixel Forge',
  publisher: 'Retro Works',
  genre: 'Role playing game',
  players: '1',
  lastplayed: '20260918T201500',
  playcount: '12',
  favorite: true,
};
