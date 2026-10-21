// Writes src-tauri/resources/THIRD-PARTY-NOTICES.txt: every Rust crate and npm package that is
// compiled into the Windows app, with its licence text, and fails when a licence isn't one of the
// permissive ones below (so nothing copyleft slips into a release unnoticed).
//
//   node scripts/third-party-notices.mjs          write the file
//   node scripts/third-party-notices.mjs --check  only check (exit 1 on problems)

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src-tauri', 'resources', 'THIRD-PARTY-NOTICES.txt');
const ALLOWED = new Set([
  'MIT', 'MIT-0', 'Apache-2.0', 'Apache-2.0 WITH LLVM-exception', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Zlib', '0BSD', 'BSL-1.0',
  'Unicode-3.0', 'Unicode-DFS-2016', 'CC0-1.0', 'Unlicense', 'MPL-2.0', 'CDLA-Permissive-2.0', 'BlueOak-1.0.0',
]);
const LICENCE_FILE = /^(licen[cs]e|copying|notice|unlicense)([-._].*)?$/i;

/** Whether an SPDX expression can be met with allowed licences (OR: any side, AND: both). */
function allowed(expr) {
  if (!expr) return false;
  const e = expr.replace(/\//g, ' OR ').trim();
  const strip = (s) => s.trim().replace(/^\((.*)\)$/, '$1').trim();
  const or = splitTop(strip(e), ' OR ');
  if (or.length > 1) return or.some(allowed);
  const and = splitTop(strip(e), ' AND ');
  if (and.length > 1) return and.every(allowed);
  return ALLOWED.has(strip(e));
}

function splitTop(s, sep) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    if (s[i] === ')') depth--;
    if (depth === 0 && s.startsWith(sep, i)) {
      out.push(cur);
      cur = '';
      i += sep.length - 1;
    } else cur += s[i];
  }
  out.push(cur);
  return out;
}

function licenceTexts(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => LICENCE_FILE.test(f))
    .sort()
    .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8').trim() }));
}

// ---- Rust: the crates linked into the Windows app (no build or dev dependencies) ----------
function rustPackages() {
  const meta = JSON.parse(
    execFileSync('cargo', ['metadata', '--format-version', '1', '--filter-platform', 'x86_64-pc-windows-msvc'], { cwd: join(ROOT, 'src-tauri'), maxBuffer: 1 << 28 }).toString(),
  );
  const byId = new Map(meta.packages.map((p) => [p.id, p]));
  const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
  const seen = new Set();
  const stack = [meta.resolve.root];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const d of nodes.get(id)?.deps ?? []) {
      if (d.dep_kinds.some((k) => k.kind === null)) stack.push(d.pkg);
    }
  }
  seen.delete(meta.resolve.root);
  return [...seen].map((id) => {
    const p = byId.get(id);
    return { kind: 'Rust crate', name: p.name, version: p.version, license: p.license ?? (p.license_file ? `see ${p.license_file}` : null), url: p.repository ?? p.homepage ?? '', texts: licenceTexts(dirname(p.manifest_path)) };
  });
}

// ---- npm: packages whose code is bundled into the window's JavaScript ---------------------
function npmPackages() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  // Svelte and SvelteKit's client runtime end up in the bundle too, though they are dev dependencies.
  const start = [...Object.keys(pkg.dependencies ?? {}), 'svelte', '@sveltejs/kit'];
  const seen = new Map();
  // Like Node: look in node_modules next to the package and in every folder above it (pnpm keeps
  // a package's dependencies as its siblings in its store folder).
  const resolve = (name, from) => {
    for (let d = from; ; d = dirname(d)) {
      const c = join(d, 'node_modules', name);
      if (existsSync(join(c, 'package.json'))) return realpathSync(c);
      if (dirname(d) === d) return null;
    }
  };
  const visit = (name, from) => {
    const dir = resolve(name, from);
    if (!dir) return;
    const p = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const key = `${p.name}@${p.version}`;
    if (seen.has(key)) return;
    const license = typeof p.license === 'string' ? p.license : p.license?.type ?? (Array.isArray(p.licenses) ? p.licenses.map((l) => l.type).join(' OR ') : null);
    const url = typeof p.repository === 'string' ? p.repository : (p.repository?.url ?? p.homepage ?? '');
    seen.set(key, { kind: 'npm package', name: p.name, version: p.version, license, url, texts: licenceTexts(dir) });
    for (const d of Object.keys(p.dependencies ?? {})) visit(d, dir);
  };
  for (const n of start) visit(n, ROOT);
  return [...seen.values()];
}

const all = [...rustPackages(), ...npmPackages()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const problems = all.filter((p) => !allowed(p.license)).map((p) => `${p.kind} ${p.name} ${p.version}: licence "${p.license}" isn't on the allowed list`);
const noText = all.filter((p) => !p.texts.length).map((p) => `${p.name} ${p.version}`);

const counts = {};
for (const p of all) counts[p.license] = (counts[p.license] ?? 0) + 1;
console.log(`${all.length} packages (${all.filter((p) => p.kind === 'Rust crate').length} Rust, ${all.filter((p) => p.kind === 'npm package').length} npm)`);
for (const [l, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${l}`);
if (noText.length) console.log(`${noText.length} ship no licence file of their own; their SPDX licence's standard text applies: ${noText.join(', ')}`);

if (problems.length) {
  console.error('\nLicence problems:\n' + problems.join('\n'));
  process.exit(1);
}
if (process.argv.includes('--check')) process.exit(0);

const lines = [
  'ChannelCraft Studio includes the following open-source software.',
  'Each is listed with its licence; the licence texts follow each entry.',
  '',
];
for (const p of all) {
  lines.push('='.repeat(78), `${p.name} ${p.version} (${p.kind})`, `Licence: ${p.license}`);
  if (p.url) lines.push(`Source: ${p.url}`);
  lines.push('');
  for (const t of p.texts) lines.push(`--- ${t.file} ---`, t.text, '');
  if (!p.texts.length) lines.push(`(No licence file in the package; the standard ${p.license} text applies.)`, '');
}
writeFileSync(OUT, lines.join('\r\n'), 'utf8');
console.log(`Wrote ${OUT}`);
