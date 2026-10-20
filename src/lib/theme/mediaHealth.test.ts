import { describe, expect, it } from 'vitest';
import { issuesCsv, scanGamelist } from './mediaHealth';

const LIST = String.raw`<?xml version="1.0"?>
<gameList>
  <game><path>./Good.sfc</path><name>Good</name><desc>Fine.</desc><video>./videos/good.mp4</video><boxart>./box/good.png</boxart></game>
  <game><path>./Broken.sfc</path><name>Broken</name><desc>x</desc><video>./videos/gone.mp4</video><image>./images/broken.png</image><manual>./manuals/broken.pdf</manual></game>
  <game><path>./Bare.sfc</path><name>Bare</name></game>
  <game><path>./good.sfc</path><name>Good again</name><desc>Same file, other case.</desc><video>./videos/good.mp4</video><boxart>./box/good.png</boxart></game>
  <game><path>./Hidden.sfc</path><name>Hidden</name><hidden>true</hidden></game>
</gameList>`;

describe('media check', () => {
  const dir = String.raw`M:\Retrobat\roms\snes`;
  const scan = scanGamelist(LIST, dir, 'snes');
  const have = new Set([String.raw`M:\Retrobat\roms\snes\videos\good.mp4`, String.raw`M:\Retrobat\roms\snes\box\good.png`, String.raw`M:\Retrobat\roms\snes\images\broken.png`]);
  const issues = scan.issues((p) => have.has(p));

  it('counts visible games and lists every file to check', () => {
    expect(scan.games).toBe(4);
    expect(scan.files).toContain(String.raw`M:\Retrobat\roms\snes\manuals\broken.pdf`);
  });

  it('finds missing media, broken paths, duplicates and missing descriptions', () => {
    const of = (game: string) => issues.filter((i) => i.game === game).map((i) => `${i.kind}${i.detail ? ':' + i.detail : ''}`).sort();
    expect(of('Good')).toEqual([]);
    expect(of('Broken')).toEqual(['broken-path:manual', 'broken-path:video']);
    expect(of('Bare')).toEqual(['no-cover', 'no-description', 'no-video']);
    expect(of('Good again')).toEqual(['duplicate']);
    expect(of('Hidden')).toEqual([]);
  });

  it('exports CSV that Excel reads, quoting what needs it', () => {
    const csv = issuesCsv([{ system: 'snes', game: 'Say "hi", ok', kind: 'no-video', detail: '', path: '' }]);
    expect(csv).toBe('System,Game,Issue,Path\r\n"snes","Say ""hi"", ok","No video",""\r\n');
  });

  it('ignores files that are not gamelists', () => {
    expect(scanGamelist('<theme><game/></theme>', dir, 'x').games).toBe(0);
  });
});
