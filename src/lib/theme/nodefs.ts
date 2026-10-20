// Node implementation of ThemeFs, for tests only (read-only).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join as pjoin, relative } from 'node:path';
import type { FileEntry, TextFile, ThemeFs } from '../api';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = pjoin(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function kind(p: string): FileEntry['kind'] {
  const ext = p.toLowerCase().split('.').pop() ?? '';
  if (ext === 'xml') return 'xml';
  if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['ttf', 'otf'].includes(ext)) return 'font';
  if (['mp4', 'webm', 'mkv', 'avi'].includes(ext)) return 'video';
  if (['ogg', 'wav', 'mp3', 'flac'].includes(ext)) return 'sound';
  return 'other';
}

export function readTextFile(p: string): TextFile {
  const s = readFileSync(p, 'utf8');
  const bom = s.charCodeAt(0) === 0xfeff;
  return { path: p, text: bom ? s.slice(1) : s, bom };
}

export const nodeFs: ThemeFs = {
  async listFiles(dir) {
    return walk(dir).map((p) => ({ rel: relative(dir, p).replace(/\\/g, '/'), kind: kind(p), size: statSync(p).size }));
  },
  async readXmlFiles(dir) {
    return walk(dir)
      .filter((p) => p.toLowerCase().endsWith('.xml'))
      .map(readTextFile);
  },
};
