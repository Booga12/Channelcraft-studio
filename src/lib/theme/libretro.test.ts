import { describe, expect, it } from 'vitest';
import { libretroArt, thumbnailName, withOnlineArt } from './libretro';
import type { GameInfo } from './games';

const game = (path: string, media: Record<string, string> = {}): GameInfo => ({ path, name: path, description: '', rating: 0, releasedate: '', developer: '', publisher: '', genre: '', players: '', playcount: '', lastplayed: '', gametime: '', favorite: false, media });

describe('libretro-thumbnails', () => {
  it('names pictures after the ROM, as libretro does', () => {
    expect(thumbnailName('./Super Mario Kart (USA).zip')).toBe('Super Mario Kart (USA)');
    expect(thumbnailName('C:\\roms\\snes\\Mario & Luigi: RPG (USA).sfc')).toBe('Mario _ Luigi_ RPG (USA)');
  });

  it('builds the box art, title and snap addresses for a known system only', () => {
    const a = libretroArt('snes', './Super Mario Kart (USA).zip')!;
    expect(a.boxart).toBe('https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Super_Nintendo_Entertainment_System/master/Named_Boxarts/Super%20Mario%20Kart%20(USA).png');
    expect(a.image).toContain('/Named_Snaps/');
    expect(libretroArt('mame', './sf2.zip')).toBeNull();
  });

  it('only fills what a game is missing; its own pictures win', () => {
    const [g] = withOnlineArt('snes', [game('./Super Mario Kart (USA).zip', { thumbnail: 'C:\\media\\smk.png', image: 'C:\\media\\smk-shot.png' })]);
    expect(g.media.boxart).toBeUndefined();
    expect(g.media.image).toBe('C:\\media\\smk-shot.png');
    expect(g.media.titleshot).toContain('/Named_Titles/');
  });
});
