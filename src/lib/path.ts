// Windows-friendly path helpers that work on plain strings (no Node, no disk access).

export function splitPath(p: string): string[] {
  return p.split(/[\\/]+/).filter((s) => s.length > 0);
}

export function isAbsolute(p: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('\\\\') || p.startsWith('/');
}

/** Joins and normalizes, resolving `.` and `..`. Output uses backslashes. */
export function join(base: string, ...parts: string[]): string {
  let prefix = '';
  let segs: string[] = [];
  const push = (p: string) => {
    if (isAbsolute(p)) {
      const m = p.match(/^([A-Za-z]:)[\\/]/);
      prefix = m ? m[1] + '\\' : p.startsWith('\\\\') ? '\\\\' : '\\';
      segs = [];
      p = m ? p.slice(3) : p.replace(/^[\\/]+/, '');
    }
    for (const s of splitPath(p)) {
      if (s === '.') continue;
      if (s === '..') segs.pop();
      else segs.push(s);
    }
  };
  push(base);
  parts.forEach(push);
  return prefix + segs.join('\\');
}

export function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  return i < 0 ? '' : p.slice(0, i);
}

export function basename(p: string): string {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  return p.slice(i + 1);
}

export function stem(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i <= 0 ? b : b.slice(0, i);
}

export function extname(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i <= 0 ? '' : b.slice(i).toLowerCase();
}

/** Case-insensitive key for comparing Windows paths. */
export function pathKey(p: string): string {
  return join(p).toLowerCase();
}

/** `target` relative to `from` directory, with forward slashes and a leading `./`. */
export function relative(fromDir: string, target: string): string {
  const a = splitPath(join(fromDir));
  const b = splitPath(join(target));
  let i = 0;
  while (i < a.length && i < b.length && a[i].toLowerCase() === b[i].toLowerCase()) i++;
  const ups = a.slice(i).map(() => '..');
  const rest = b.slice(i);
  const parts = [...ups, ...rest];
  return ups.length ? parts.join('/') : './' + rest.join('/');
}
