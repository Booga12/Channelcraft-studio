#!/usr/bin/env node
// (Re)creates the demo RetroBat the how-to clips are recorded with (see README.md here).
//
//   node dev/guides/make-demo.mjs [--root <folder>] [--stock <RetroBat folder>] [--regen-art]
//
// <root> (default: ../guides-demo next to this repo, outside both repos) gets:
//   RetroBat\                the demo RetroBat (the page sees it as C:\RetroBat)
//   Users\Player\            the demo user's Music, Pictures, Downloads... (C:\Users\Player)
//   AppData\                 the app's data folder: backups, recovery, asset library
//   .cache\                  kept between runs: stock RetroBat files and the generated art
//
// The library is made up (demo-library.mjs) and its artwork, videos and music are generated here
// (art.js, music.mjs). From a real RetroBat (--stock, default M:\RetroBat) only stock files that
// ship with RetroBat are read, once, into the cache: the carbon theme, EmulationStation's
// resources folder and es_systems.cfg. Nothing is ever written there, and none of its games,
// media, settings or other themes are read.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import AdmZip from 'adm-zip';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from 'playwright-core';
import { SONGS, SYSTEMS, WALLPAPERS } from './demo-library.mjs';
import { song } from './music.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO = resolve(HERE, '..', '..');
export const DEFAULT_ROOT = resolve(STUDIO, '..', 'guides-demo');
const MARKER = '.ccs-demo-root';

const log = (...a) => console.log('[make-demo]', ...a);

function args() {
  const a = process.argv.slice(2);
  const get = (k, d) => {
    const i = a.indexOf(k);
    return i >= 0 ? a[i + 1] : d;
  };
  return { root: resolve(get('--root', DEFAULT_ROOT)), stock: get('--stock', 'M:\\RetroBat'), regenArt: a.includes('--regen-art'), quiet: a.includes('--quiet') };
}

const isInside = (child, parent) => {
  const c = resolve(child).toLowerCase();
  const p = resolve(parent).toLowerCase();
  return c.length > p.length && c.startsWith(p) && c[p.length] === '\\';
};

/** Hard-links a folder tree (copies when links can't be made). Fast, and uses no extra space. */
function linkTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    const d = join(dest, name);
    if (statSync(s).isDirectory()) linkTree(s, d);
    else
      try {
        linkSync(s, d);
      } catch {
        copyFileSync(s, d);
      }
  }
}
const link = (src, dest) => {
  mkdirSync(dirname(dest), { recursive: true });
  try {
    linkSync(src, dest);
  } catch {
    copyFileSync(src, dest);
  }
};

const ffmpeg = (...a) => {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${a.join(' ')}`);
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const date = (iso) => `${iso.replace(/-/g, '')}T000000`;

// ---- stock files (read once from a real RetroBat; never written) ------------------------------

function ensureStock(cache, stock) {
  const dir = join(cache, 'stock');
  const need = [
    ['themes/es-theme-carbon', 'emulationstation/.emulationstation/themes/es-theme-carbon'],
    ['resources', 'emulationstation/resources'],
    ['es_systems.cfg', 'emulationstation/.emulationstation/es_systems.cfg'],
  ];
  for (const [to, from] of need) {
    const target = join(dir, to);
    if (existsSync(target)) continue;
    const src = join(stock, from);
    if (!existsSync(src)) throw new Error(`The stock file ${src} is missing. Pass --stock <a RetroBat folder> (it is only read).`);
    log(`copying stock ${from} from ${stock} (read only, once)…`);
    const tmp = `${target}.partial`;
    rmSync(tmp, { recursive: true, force: true });
    cpSync(src, tmp, { recursive: true });
    renameSync(tmp, target);
  }
  return dir;
}

// ---- generated art, videos and music (cached by the generators' contents) ----------------------

function artVersion() {
  const h = createHash('sha256');
  for (const f of ['art.js', 'demo-library.mjs', 'music.mjs']) h.update(readFileSync(join(HERE, f)));
  return h.digest('hex').slice(0, 12);
}

const slug = (title) => title.replace(/[^A-Za-z0-9 &'-]/g, '').trim();
const dataUrl = (u) => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');

async function ensureArt(cache, regen) {
  const ver = artVersion();
  const dir = join(cache, `art-${ver}`);
  if (existsSync(join(dir, 'done')) && !regen) return dir;
  for (const old of existsSync(cache) ? readdirSync(cache) : []) if (old.startsWith('art-')) rmSync(join(cache, old), { recursive: true, force: true });
  log(`drawing the demo library's artwork (art-${ver})…`);
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body style="margin:0;background:#000"></body></html>');
    await page.addScriptTag({ path: join(HERE, 'art.js') });
    const draw = (fn, ...a) => page.evaluate(([fn, a]) => window.ART[fn](...a), [fn, a]);
    for (const sys of SYSTEMS) {
      const handheld = sys.name === 'gba';
      for (const [gi, g] of sys.games.entries()) {
        const spec = { ...g, band: sys.band };
        const base = join(dir, 'roms', sys.name);
        const name = slug(g.title);
        const out = (rel, buf) => {
          mkdirSync(dirname(join(base, rel)), { recursive: true });
          writeFileSync(join(base, rel), buf);
        };
        out(`images/${name}-thumb.jpg`, dataUrl(await draw('cover', spec)));
        out(`images/${name}-image.png`, dataUrl(await draw('shot', spec, 1.3, handheld)));
        out(`images/${name}-marquee.png`, dataUrl(await draw('logo', spec)));
        out(`images/${name}-fanart.jpg`, dataUrl(await draw('fanart', spec)));
        if (gi < 2) {
          // A short gameplay video: frames of the pixel scene, scaled up sharply.
          const frames = join(tmpdir(), `ccs-demo-frames-${process.pid}`);
          rmSync(frames, { recursive: true, force: true });
          mkdirSync(frames, { recursive: true });
          const n = 150;
          const urls = await page.evaluate(
            ([spec, n, hh]) => {
              const out = [];
              for (let i = 0; i < n; i++) out.push(window.ART.shot(spec, i / 30, hh));
              return out;
            },
            [spec, n, handheld],
          );
          urls.forEach((u, i) => writeFileSync(join(frames, `${String(i).padStart(4, '0')}.png`), dataUrl(u)));
          mkdirSync(join(base, 'videos'), { recursive: true });
          ffmpeg('-framerate', '30', '-i', join(frames, '%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'medium', '-movflags', '+faststart', join(base, 'videos', `${name}-video.mp4`));
          rmSync(frames, { recursive: true, force: true });
        }
      }
      log(`  ${sys.name}: ${sys.games.length} games`);
    }
    for (const wp of WALLPAPERS) {
      mkdirSync(join(dir, 'Pictures'), { recursive: true });
      writeFileSync(join(dir, 'Pictures', wp.file), dataUrl(await draw('wallpaper', wp)));
    }
    // The intro video (RetroBat's video folder) and a second one in the user's Videos.
    const frames = join(tmpdir(), `ccs-demo-intro-${process.pid}`);
    rmSync(frames, { recursive: true, force: true });
    mkdirSync(frames, { recursive: true });
    const n = 120;
    for (let i = 0; i < n; i += 20) {
      const urls = await page.evaluate(([a, b, n]) => Array.from({ length: b - a }, (_, k) => window.ART.intro(a + k, n)), [i, Math.min(n, i + 20), n]);
      urls.forEach((u, k) => writeFileSync(join(frames, `${String(i + k).padStart(4, '0')}.jpg`), dataUrl(u)));
    }
    mkdirSync(join(dir, 'Videos'), { recursive: true });
    ffmpeg('-framerate', '30', '-i', join(frames, '%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', join(dir, 'Videos', 'Arcade Night.mp4'));
    rmSync(frames, { recursive: true, force: true });
  } finally {
    await browser.close();
  }
  mkdirSync(join(dir, 'Music'), { recursive: true });
  for (const s of SONGS) {
    const wav = join(tmpdir(), `ccs-demo-${process.pid}.wav`);
    writeFileSync(wav, song(s));
    ffmpeg('-i', wav, '-c:a', 'libvorbis', '-q:a', '4', join(dir, 'Music', s.file));
    rmSync(wav, { force: true });
  }
  writeFileSync(join(dir, 'done'), new Date().toISOString());
  return dir;
}

// ---- the demo folder ---------------------------------------------------------------------------

function gamelist(sys) {
  const lines = ['<?xml version="1.0"?>', '<gameList>'];
  sys.games.forEach((g, i) => {
    const name = slug(g.title);
    const lastplayed = g.plays ? `202610${String(28 - i * 3).padStart(2, '0')}T${String(18 + (i % 5)).padStart(2, '0')}${String((i * 17) % 60).padStart(2, '0')}00` : '';
    lines.push(
      '\t<game>',
      `\t\t<path>./${esc(name)}${sys.ext}</path>`,
      `\t\t<name>${esc(g.title)}</name>`,
      `\t\t<desc>${esc(g.desc)}</desc>`,
      `\t\t<rating>${g.rating}</rating>`,
      `\t\t<releasedate>${date(g.year)}</releasedate>`,
      `\t\t<developer>${esc(g.dev)}</developer>`,
      `\t\t<publisher>${esc(g.pub)}</publisher>`,
      `\t\t<genre>${esc(g.genre)}</genre>`,
      `\t\t<players>${g.players}</players>`,
      `\t\t<image>./images/${esc(name)}-image.png</image>`,
      `\t\t<thumbnail>./images/${esc(name)}-thumb.jpg</thumbnail>`,
      `\t\t<marquee>./images/${esc(name)}-marquee.png</marquee>`,
      `\t\t<fanart>./images/${esc(name)}-fanart.jpg</fanart>`,
      ...(i < 2 ? [`\t\t<video>./videos/${esc(name)}-video.mp4</video>`] : []),
      ...(g.plays ? [`\t\t<playcount>${g.plays}</playcount>`, `\t\t<lastplayed>${lastplayed}</lastplayed>`, `\t\t<gametime>${g.plays * 1260}</gametime>`] : []),
      ...(g.fav ? ['\t\t<favorite>true</favorite>'] : []),
      '\t</game>',
    );
  });
  lines.push('</gameList>', '');
  return lines.join('\r\n');
}

const ES_SETTINGS = `<?xml version="1.0"?>
<config>
	<string name="ThemeSet" value="es-theme-carbon" />
	<string name="Language" value="en_US" />
	<string name="TransitionStyle" value="auto" />
	<string name="PowerSaverMode" value="disabled" />
	<bool name="DrawClock" value="true" />
	<bool name="ClockMode12" value="false" />
	<bool name="audio.bgmusic" value="true" />
	<int name="MusicVolume" value="60" />
</config>
`.replace(/\n/g, '\r\n');

const RETROBAT_INI = `; RETROBAT GLOBAL CONFIG FILE

[RetroBat]

; At startup RetroBat will detect or not the language used in Windows to set automatically the same language in the frontend and RetroArch emulator.
LanguageDetection=1

; Run automatically RetroBat at Windows startup (0=NO 1=STARTUP 2=REGISTRY).
Autostart=0

[SplashScreen]

; Set if video introduction is played before running the interface.
EnableIntro=1

; The name of the video file to play. RandomVideo must be set on 0 to take effect.
FileName="Arcade Night.mp4"

; If 'default' is set, RetroBat will use the default video path where video files are stored.
; Enter a full path to use a custom directory for video files.
FilePath="default"

; Play video files randomly when RetroBat starts.
RandomVideo=0

; Set the delay between the start of the video and the start of the interface.
VideoDelay=1000

; By default RetroBat loads EmulationStation in parallel of the intro video, setting this to '1' tells RetroBat to wait for the video to finish before loading ES
WaitForVideoEnd=1

; Set this to stop when video automatically when the interface has loaded
KillVideoWhenESReady=0

; Allow killing intro video with Gamepad press (this only works with XInput controllers)
GamepadVideoKill=1
`.replace(/\n/g, '\r\n');

export async function makeDemo({ root = DEFAULT_ROOT, stock = 'M:\\RetroBat', regenArt = false } = {}) {
  root = resolve(root);
  if (isInside(root, STUDIO) || resolve(root).toLowerCase() === STUDIO.toLowerCase()) throw new Error('The demo folder must be outside the studio repo.');
  if (/^[a-z]:\\retrobat$/i.test(root) || (existsSync(root) && readdirSync(root).length && !existsSync(join(root, MARKER)))) {
    throw new Error(`${root} isn't empty and isn't a demo folder (no ${MARKER} in it), so nothing was changed there.`);
  }
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, MARKER), 'The ChannelCraft guides demo folder. make-demo.mjs empties and rebuilds everything here except .cache.\r\n');
  const cache = join(root, '.cache');
  const stockDir = ensureStock(cache, stock);
  const art = await ensureArt(cache, regenArt);

  // Start from nothing (the cache stays).
  for (const name of readdirSync(root)) if (name !== '.cache' && name !== MARKER) rmSync(join(root, name), { recursive: true, force: true });

  const rb = join(root, 'RetroBat');
  const es = join(rb, 'emulationstation', '.emulationstation');
  mkdirSync(join(es, 'themes'), { recursive: true });
  mkdirSync(join(es, 'themesettings'), { recursive: true });
  mkdirSync(join(es, 'music'), { recursive: true });
  writeFileSync(join(rb, 'RetroBat.exe'), '');
  writeFileSync(join(rb, 'retrobat.ini'), RETROBAT_INI);
  writeFileSync(join(es, 'es_settings.cfg'), ES_SETTINGS);
  link(join(stockDir, 'es_systems.cfg'), join(es, 'es_systems.cfg'));
  linkTree(join(stockDir, 'themes', 'es-theme-carbon'), join(es, 'themes', 'es-theme-carbon'));
  linkTree(join(stockDir, 'resources'), join(rb, 'emulationstation', 'resources'));
  link(join(art, 'Videos', 'Arcade Night.mp4'), join(es, 'video', 'Arcade Night.mp4'));
  for (const sys of SYSTEMS) {
    const dir = join(rb, 'roms', sys.name);
    linkTree(join(art, 'roms', sys.name), dir);
    writeFileSync(join(dir, 'gamelist.xml'), gamelist(sys));
    for (const g of sys.games) writeFileSync(join(dir, `${slug(g.title)}${sys.ext}`), '');
  }
  for (const empty of ['bios', 'saves', 'screenshots', 'emulators']) mkdirSync(join(rb, empty), { recursive: true });

  const home = join(root, 'Users', 'Player');
  for (const f of ['Desktop', 'Documents', 'Downloads', 'Music', 'Pictures', 'Videos']) mkdirSync(join(home, f), { recursive: true });
  linkTree(join(art, 'Music'), join(home, 'Music'));
  linkTree(join(art, 'Pictures'), join(home, 'Pictures'));
  linkTree(join(art, 'Videos'), join(home, 'Videos'));
  // A theme someone shared, for the import guide: the app's own starter theme, renamed.
  const zip = new AdmZip();
  const starter = join(STUDIO, 'src-tauri', 'resources', 'starter-theme');
  const addDir = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) addDir(p);
      else zip.addFile(`Sunset Drive/${relative(starter, p).replace(/\\/g, '/')}`, readFileSync(p));
    }
  };
  addDir(starter);
  zip.writeZip(join(home, 'Downloads', 'Sunset Drive.zip'));

  const appData = join(root, 'AppData');
  mkdirSync(join(appData, 'backups'), { recursive: true });
  copyFileSync(join(STUDIO, 'src-tauri', 'resources', 'THIRD-PARTY-NOTICES.txt'), join(appData, 'THIRD-PARTY-NOTICES.txt'));
  log(`ready: ${rb} (the app sees C:\\RetroBat)`);
  return { root, retrobat: rb };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const a = args();
  makeDemo(a).catch((e) => {
    console.error('[make-demo]', e.message ?? e);
    process.exit(1);
  });
}

