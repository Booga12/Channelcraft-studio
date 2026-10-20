// Media check: reads a console's gamelist.xml and reports what's missing or broken. It only reads;
// gamelists, ROMs and scraper settings are never changed. A file being there doesn't prove that a
// video plays in RetroBat (codecs), so this checks presence only.

import { join } from '../path';
import { elements, parse, textOf } from '../xml/cst';

export type IssueKind = 'no-video' | 'no-cover' | 'broken-path' | 'duplicate' | 'no-description';

export interface Issue {
  system: string;
  game: string;
  kind: IssueKind;
  /** The tag (for broken paths) or extra detail. */
  detail: string;
  path: string;
}

export const ISSUE_LABEL: Record<IssueKind, string> = {
  'no-video': 'No video',
  'no-cover': 'No cover art',
  'broken-path': 'File not found',
  duplicate: 'Listed twice',
  'no-description': 'No description',
};

/** Gamelist tags that point at files. */
const FILE_TAGS = ['image', 'thumbnail', 'marquee', 'video', 'fanart', 'boxart', 'boxback', 'wheel', 'titleshot', 'cartridge', 'mix', 'map', 'bezel', 'manual', 'magazine'];

/** Findings shown at most, so huge libraries stay usable. */
export const MAX_ISSUES = 10_000;

function filePath(systemDir: string, v: string): string {
  if (/^[A-Za-z]:[\\/]|^\\\\/.test(v)) return v;
  return join(systemDir, v.replace(/^~[\\/]/, './'));
}

export interface GamelistScan {
  games: number;
  /** Every file path named in the gamelist, to check on disk. */
  files: string[];
  /** Issues once `exists` is known. */
  issues: (exists: (path: string) => boolean) => Issue[];
}

/** Reads one gamelist (hidden games are skipped, as RetroBat hides them). */
export function scanGamelist(text: string, systemDir: string, system: string): GamelistScan {
  const doc = parse(text);
  const games = doc.root && doc.root.name === 'gameList' ? elements(doc.root).filter((e) => e.name === 'game') : [];
  const rows: { name: string; path: string; tags: Record<string, string> }[] = [];
  for (const g of games) {
    const tags: Record<string, string> = {};
    for (const c of elements(g)) {
      const v = textOf(doc, c).trim();
      if (v) tags[c.name] = v;
    }
    if (tags.hidden === 'true') continue;
    rows.push({ name: tags.name ?? tags.path ?? '(no name)', path: tags.path ?? '', tags });
  }
  const files = [...new Set(rows.flatMap((r) => FILE_TAGS.filter((t) => r.tags[t]).map((t) => filePath(systemDir, r.tags[t]))))];
  return {
    games: rows.length,
    files,
    issues(exists) {
      const out: Issue[] = [];
      const seen = new Map<string, number>();
      for (const r of rows) {
        const add = (kind: IssueKind, detail = '', path = '') => out.push({ system, game: r.name, kind, detail, path });
        const key = r.path.toLowerCase();
        if (key) {
          seen.set(key, (seen.get(key) ?? 0) + 1);
          if (seen.get(key) === 2) add('duplicate', '', r.path);
        }
        if (!r.tags.video) add('no-video');
        if (!r.tags.boxart && !r.tags.thumbnail && !r.tags.image) add('no-cover');
        if (!r.tags.desc) add('no-description');
        for (const t of FILE_TAGS) {
          if (!r.tags[t]) continue;
          const p = filePath(systemDir, r.tags[t]);
          if (!exists(p)) add('broken-path', t, p);
        }
      }
      return out;
    },
  };
}

/** The findings as a CSV file (Excel opens it). */
export function issuesCsv(issues: Issue[]): string {
  const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = issues.map((i) => [i.system, i.game, ISSUE_LABEL[i.kind] + (i.detail ? ` (${i.detail})` : ''), i.path].map(cell).join(','));
  return ['System,Game,Issue,Path', ...rows].join('\r\n') + '\r\n';
}
