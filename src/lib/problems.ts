// Reporting problems: errors in the pages go to the problem log on this PC (problems.rs), and
// "Report a problem" opens a GitHub issue form filled in with what the user chose to include.
// Nothing is sent by the app itself: the user reads it on GitHub and presses Submit there.

/** Written out in full: the release check allows the owner's name only inside this address. */
export const REPO_URL = 'https://github.com/Booga12/Channelcraft-studio';
/** GitHub refuses very long addresses; the log is shortened to fit under this. */
const MAX_URL = 7000;

/** The home folder (C:\Users\<name>) from a path inside it, such as the log's. */
export function homeFrom(path: string): string | null {
  return path.match(/^(.*?[\\/]Users[\\/][^\\/]+)[\\/]/i)?.[1] ?? null;
}

/**
 * Text with the home folder written as ~ and the user name as <you>, so a report doesn't name
 * the person (Windows user names are often real names).
 */
export function scrub(text: string, home: string | null): string {
  if (!home) return text;
  const user = home.split(/[\\/]/).pop() ?? '';
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = text;
  for (const h of [home, home.replace(/\\/g, '/'), home.replace(/\\/g, '\\\\')]) out = out.replace(new RegExp(esc(h), 'gi'), '~');
  if (user.length >= 3) out = out.replace(new RegExp(`\\b${esc(user)}\\b`, 'gi'), '<you>');
  return out;
}

/** "Windows 11" or "Windows 10" from the browser's platform version (13 and up is Windows 11). */
export function windowsName(platformVersion: string | undefined): string {
  const major = parseInt(platformVersion ?? '', 10);
  if (!Number.isFinite(major)) return 'Windows';
  return major >= 13 ? 'Windows 11' : major > 0 ? 'Windows 10' : 'Windows 7 or 8';
}

export interface Report {
  what: string;
  steps: string;
  version: string;
  windows: string;
  /** The problem log, when the user chose to include it. */
  log: string;
}

/** The address of a new GitHub issue filled in with the report (fields of bug_report.yml). */
export function reportUrl(r: Report): string {
  const first = r.what.trim().split(/\r?\n/)[0].slice(0, 70);
  const make = (log: string) => {
    const u = new URL(`${REPO_URL}/issues/new`);
    u.searchParams.set('template', 'bug_report.yml');
    u.searchParams.set('title', first ? `Problem: ${first}` : 'Problem: ');
    u.searchParams.set('what', r.what.trim());
    if (r.steps.trim()) u.searchParams.set('steps', r.steps.trim());
    if (r.version) u.searchParams.set('version', r.version);
    if (r.windows) u.searchParams.set('windows', r.windows);
    if (log) u.searchParams.set('log', log);
    return u.toString();
  };
  let log = r.log.trim();
  let url = make(log);
  // Too long: keep the newest part of the log.
  while (url.length > MAX_URL && log) {
    const cut = Math.max(200, Math.floor(log.length * 0.25));
    log = cut >= log.length ? '' : `…${log.slice(cut).replace(/^[^\n]*\n/, '')}`;
    url = make(log);
  }
  return url;
}

let installed = false;
let logged = 0;
const seen = new Set<string>();

/** Writes uncaught errors of the pages to the problem log (at most 30 a session, no repeats). */
export function installErrorLog(write: (text: string) => Promise<unknown>) {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const note = (msg: string, stack?: string) => {
    if (logged >= 30 || seen.has(msg)) return;
    seen.add(msg);
    logged++;
    write([msg, stack?.split('\n').slice(0, 8).join('\n')].filter(Boolean).join('\n')).catch(() => {});
  };
  window.addEventListener('error', (e) => note(e.message || String(e.error), e.error?.stack));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    note(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined);
  });
}
