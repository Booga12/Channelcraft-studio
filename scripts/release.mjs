// Builds a signed release for the in-app updater: the installer, its signature, and latest.json.
// Upload the installer and latest.json to the GitHub release named v<version>; installed copies of
// ChannelCraft Studio find the update through latest.json and check the signature before installing.
//
// The private signing key stays out of the project, at %USERPROFILE%\.tauri\channelcraft-studio.key
// (or set TAURI_SIGNING_PRIVATE_KEY yourself). Keep it safe: without it no further updates can be
// signed, and anyone who has it could sign updates.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const REPO = 'Booga12/Channelcraft-studio';
const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const version = conf.version;
const key = process.env.TAURI_SIGNING_PRIVATE_KEY ?? join(homedir(), '.tauri', 'channelcraft-studio.key');
if (!process.env.TAURI_SIGNING_PRIVATE_KEY && !existsSync(key)) {
  console.error(`No signing key at ${key}. Make one with: pnpm tauri signer generate -w "${key}"`);
  process.exit(1);
}

execSync('pnpm tauri build --config src-tauri/tauri.release.json', {
  stdio: 'inherit',
  env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: process.env.TAURI_SIGNING_PRIVATE_KEY ?? readFileSync(key, 'utf8'), TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? '' },
});

const dir = 'src-tauri/target/release/bundle/nsis';
const exe = readdirSync(dir).find((f) => f.endsWith(`_${version}_x64-setup.exe`));
if (!exe || !existsSync(join(dir, `${exe}.sig`))) {
  console.error(`The installer or its signature for ${version} wasn't found in ${dir}.`);
  process.exit(1);
}
// GitHub turns spaces in uploaded file names into dots.
const asset = exe.replace(/ /g, '.');
const latest = {
  version,
  notes: `ChannelCraft Studio ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: readFileSync(join(dir, `${exe}.sig`), 'utf8').trim(),
      url: `https://github.com/${REPO}/releases/download/v${version}/${encodeURIComponent(asset)}`,
    },
  },
};
writeFileSync(join(dir, 'latest.json'), JSON.stringify(latest, null, 2) + '\n');
console.log(`\nReady. Upload these two files to the GitHub release v${version}:\n  ${join(dir, exe)}\n  ${join(dir, 'latest.json')}`);
