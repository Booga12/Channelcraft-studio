// Builds the public Windows installer and checks it carries only the program.
//
//   pnpm release:check            build, then check
//   pnpm release:check --no-build check the last build
//
// Checks:
// - every bundled open-source licence is permissive (scripts/third-party-notices.mjs --check);
// - nothing personal is inside the installer, the program or the bundled files: this computer's
//   user name and home folder, the git name and e-mail, and any words listed (one per line) in
//   the untracked file .release-private-words (for example a personal theme or brand name);
// - the only theme bundled is the starter theme;
// - the app's own LICENSE is bundled and is the MIT licence.
// The program is built with this computer's folders mapped away (--remap-path-prefix), so source
// paths compiled into Rust panic messages don't name the user.

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TAURI = join(ROOT, 'src-tauri');
const RELEASE = join(TAURI, 'target', 'release');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32', ...opts });
const git = (k) => {
  try {
    return execSync(`git config ${k}`, { cwd: ROOT }).toString().trim();
  } catch {
    return '';
  }
};

// ---- what counts as personal ---------------------------------------------------------------
const home = homedir();
const words = new Set([userInfo().username, home, home.replace(/\\/g, '/'), git('user.email'), git('user.name')].filter((w) => w && w.length >= 3));
const privateFile = join(ROOT, '.release-private-words');
if (existsSync(privateFile)) for (const l of readFileSync(privateFile, 'utf8').split(/\r?\n/)) if (l.trim().length >= 3 && !l.startsWith('#')) words.add(l.trim());
// A user name that is also an everyday word would match everywhere; those are reported, not failed.
const COMMON = new Set(['user', 'admin', 'owner', 'test', 'dev', 'home', 'main']);

// ---- build ---------------------------------------------------------------------------------
if (!process.argv.includes('--no-build')) {
  run('node', ['scripts/third-party-notices.mjs']);
  const cargoHome = process.env.CARGO_HOME ?? join(home, '.cargo');
  const rustupHome = process.env.RUSTUP_HOME ?? join(home, '.rustup');
  const remap = [
    [join(cargoHome, 'registry', 'src'), 'crates'],
    [join(cargoHome, 'git', 'checkouts'), 'git'],
    [rustupHome, 'rustup'],
    [TAURI, 'channelcraft'],
    [home, '~'],
  ].map(([from, to]) => `--remap-path-prefix=${from}=${to}`);
  const env = { ...process.env, RUSTFLAGS: [process.env.RUSTFLAGS, ...remap].filter(Boolean).join(' ') };
  run('pnpm', ['tauri', 'build'], { env });
} else {
  run('node', ['scripts/third-party-notices.mjs', '--check']);
}

// ---- check ---------------------------------------------------------------------------------
const problems = [];
const notes = [];

function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath ?? e.path, e.name));
}

// The one place a personal word may appear: the GitHub releases address the in-app updater checks
// (from the updater endpoints in tauri.conf.json). It's public on the release page anyway.
const allowed = (JSON.parse(readFileSync(join(TAURI, 'tauri.conf.json'), 'utf8')).plugins?.updater?.endpoints ?? [])
  .map((u) => u.match(/github\.com\/[\w.-]+\/[\w.-]+/i)?.[0])
  .filter(Boolean)
  .map((a) => a.toLowerCase());
const strip = (t) => allowed.reduce((s, a) => s.split(a).join(''), t.toLowerCase());

function scan(file) {
  const buf = readFileSync(file);
  // Text as it can be stored: UTF-8 or Latin-1, and UTF-16 at either byte alignment.
  const texts = [buf.toString('utf8'), buf.toString('latin1'), buf.toString('utf16le'), buf.subarray(1).toString('utf16le')].map(strip);
  for (const w of words) {
    const hit = texts.some((t) => t.includes(w.toLowerCase()));
    if (!hit) continue;
    const msg = `${relative(ROOT, file)} contains “${w}”`;
    if (COMMON.has(w.toLowerCase())) notes.push(msg);
    else problems.push(msg);
  }
}

const installers = filesUnder(join(RELEASE, 'bundle', 'nsis')).filter((f) => f.endsWith('.exe'));
const exe = join(RELEASE, 'channelcraft-studio.exe');
if (!installers.length) problems.push('No installer found in src-tauri/target/release/bundle/nsis. Build first.');
if (!existsSync(exe)) problems.push('No program found at src-tauri/target/release/channelcraft-studio.exe.');
const shipped = [...installers, ...(existsSync(exe) ? [exe] : []), ...filesUnder(join(TAURI, 'resources')), ...filesUnder(join(ROOT, 'build')), join(TAURI, 'tauri.conf.json'), join(ROOT, 'LICENSE')];
for (const f of shipped) scan(f);

// Only the starter theme may be bundled.
for (const f of filesUnder(join(TAURI, 'resources'))) {
  const rel = relative(join(TAURI, 'resources'), f).replace(/\\/g, '/');
  if (rel !== 'THIRD-PARTY-NOTICES.txt' && !rel.startsWith('starter-theme/')) problems.push(`Unexpected bundled file: resources/${rel}`);
  if (/\.(mp4|mkv|avi|webm|zip|7z|rar|iso|bin|cue|chd|nes|sfc|smc|gba|gb|gbc|n64|z64|nds|3ds|wbfs|rvz)$/i.test(rel)) problems.push(`Game or media file bundled: resources/${rel}`);
  if (/gamelist\.xml$|es_settings\.cfg$|themesettings/i.test(rel)) problems.push(`RetroBat data bundled: resources/${rel}`);
}

if (!/^MIT License/.test(readFileSync(join(ROOT, 'LICENSE'), 'utf8'))) problems.push('LICENSE is missing or is not the MIT licence.');
if (!JSON.parse(readFileSync(join(TAURI, 'tauri.conf.json'), 'utf8')).bundle?.resources?.['../LICENSE']) problems.push('LICENSE is not bundled with the app.');

const size = (f) => `${(statSync(f).size / 1048576).toFixed(1)} MB`;
console.log('\nRelease check');
for (const f of installers) console.log(`  installer: ${relative(ROOT, f)} (${size(f)})`);
console.log(`  checked ${shipped.length} files for ${words.size} personal words`);
for (const n of notes) console.log(`  note: ${n}`);
if (problems.length) {
  console.error('\nProblems:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('  OK: nothing personal found, licences fine, only the starter theme bundled.');
