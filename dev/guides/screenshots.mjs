#!/usr/bin/env node
// Takes the website's home page screenshots (static/screenshots/*.png) from the demo RetroBat,
// the same way record.mjs records the clips: Edge through Playwright, 1440x900, dark mode.
//
//   node dev/guides/screenshots.mjs              every screenshot
//   node dev/guides/screenshots.mjs editor home  only these
//
// Options: --headed, --no-demo, --keep-server, --port 1430, --demo-root <folder>,
// --out <website folder> (default ../channelcraft-website).
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { renameSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from 'playwright-core';
import { dialog, dockButton, editorReady, inspector, NO_TOUR, panel, quickClear, quickScreen } from './helpers.mjs';
import { DEFAULT_ROOT, makeDemo } from './make-demo.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO = resolve(HERE, '..', '..');
const WIDTH = 1440;
const HEIGHT = 900;
const ALL = ['wizard', 'editor', 'game-list', 'properties', 'colours', 'safe-edit', 'home'];

const a = process.argv.slice(2);
const val = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const o = {
  only: a.filter((x, i) => !x.startsWith('--') && !['--port', '--demo-root', '--out'].includes(a[i - 1])),
  headed: a.includes('--headed'),
  demo: !a.includes('--no-demo'),
  keepServer: a.includes('--keep-server'),
  port: Number(val('--port', 1430)),
  demoRoot: resolve(val('--demo-root', DEFAULT_ROOT)),
  out: resolve(val('--out', resolve(STUDIO, '..', 'channelcraft-website'))),
};
const want = (name) => !o.only.length || o.only.includes(name);
const log = (...x) => console.log('[screenshots]', ...x);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the dev server in demo mode (as in record.mjs) ---------------------------------------------

const demoId = (root) => createHash('sha256').update(resolve(root).toLowerCase()).digest('hex').slice(0, 12);

async function probe(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/__dev/cmd/__demo`, { method: 'POST', body: '{}' });
    return await r.json();
  } catch {
    return null;
  }
}

async function ensureServer() {
  const id = demoId(o.demoRoot);
  const found = await probe(o.port);
  if (found?.ok && found.value?.id === id) return null;
  if (found) throw new Error(`Port ${o.port} is in use by a dev server that isn't this demo. Stop it or pass --port.`);
  log(`starting the dev server in demo mode on port ${o.port}…`);
  const child = spawn(process.execPath, [join(STUDIO, 'node_modules', 'vite', 'bin', 'vite.js'), 'dev', '--port', String(o.port), '--strictPort'], {
    cwd: STUDIO,
    env: { ...process.env, CCS_DEMO_ROOT: o.demoRoot, BROWSER: 'none' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 120; i++) {
    const p = await probe(o.port);
    if (p?.ok && p.value?.id === id) return child;
    if (child.exitCode !== null) break;
    await sleep(500);
  }
  child.kill();
  throw new Error("The dev server didn't start in demo mode.");
}

// ---- helpers -------------------------------------------------------------------------------------

/** Saves a PNG, made smaller with a 256-colour palette when it is over 600 KB. */
async function shot(page, name) {
  await page.mouse.move(WIDTH - 2, HEIGHT - 2);
  await page.evaluate(() => document.fonts.ready);
  await sleep(700);
  const errs = await page.locator('[data-sonner-toast][data-type=error]').count();
  if (errs) throw new Error(`An error message is showing before "${name}".`);
  const file = join(o.out, 'static', 'screenshots', `${name}.png`);
  await page.screenshot({ path: file });
  if (statSync(file).size > 600 * 1024) {
    const tmp = `${file}.tmp.png`;
    spawnSync(ffmpegPath, ['-loglevel', 'error', '-y', '-i', file, '-vf', 'split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a', tmp]);
    renameSync(tmp, file);
  }
  log(`${name}.png: ${Math.round(statSync(file).size / 1024)} KB`);
}

async function dismissToasts(page) {
  await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click()));
  await page.locator('[data-sonner-toast]').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
}

async function themeMenu(page, ...path) {
  await page.getByRole('button', { name: 'Theme menu' }).click();
  for (const [i, label] of path.entries()) {
    const item = page.getByRole('menuitem', { name: label, exact: i < path.length - 1 }).first();
    if (i < path.length - 1) await item.hover();
    else await item.click();
    await sleep(300);
  }
}

/** Saves the theme, makes its preview.png from the screen showing and goes back home. */
async function finishTheme(page) {
  await dismissToasts(page);
  await themeMenu(page, 'File', 'Make preview.png from this screen');
  await page.locator('[data-sonner-toast]').filter({ hasText: 'Saved preview.png' }).first().waitFor({ timeout: 30000 });
  await page.keyboard.press('Control+s');
  await sleep(1500);
  await dismissToasts(page);
  await themeMenu(page, 'Close theme');
  await page.getByText('Welcome to ChannelCraft Studio').waitFor({ timeout: 30000 });
  await sleep(800);
}

/** Opens the wizard, names the theme and picks a design (left open on the Design step). */
async function wizardTo(page, name, design) {
  await page.getByRole('button', { name: /Start a new theme/ }).click();
  const d = dialog(page);
  await d.locator('input').first().waitFor();
  await sleep(300);
  await d.locator('input').first().fill(name);
  await d.getByRole('button', { name: 'Next', exact: true }).click();
  await sleep(400);
  const card = d.locator('label').filter({ hasText: design }).first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await sleep(600);
}

async function createAndOpen(page, name) {
  await dialog(page).getByRole('button', { name: 'Create and open', exact: true }).click();
  await editorReady(page, name);
  await dismissToasts(page);
  await quickClear(page);
}

// ---- the screenshots -----------------------------------------------------------------------------

async function main() {
  if (o.demo) await makeDemo({ root: o.demoRoot });
  const server = await ensureServer();
  const browser = await chromium.launch({ channel: 'msedge', headless: !o.headed, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-features=Translate'] });
  try {
    const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1, colorScheme: 'dark', locale: 'en-US' });
    await context.route(/libretro-thumbnails|thumbnails\.libretro\.com/, (r) => r.abort());
    // askCopy stays on (unlike the guides), for the safe-edit screenshot; it is read when the app starts.
    const storage = { ...NO_TOUR, 'ccs.askCopy': '1', 'ccs.prefs': JSON.stringify({ mode: 'dark', accent: 'channelcraft', realArtwork: true, onlineArt: false, playAnimations: true }) };
    await context.addInitScript((s) => {
      if (sessionStorage.getItem('ccs.shots.init')) return;
      sessionStorage.setItem('ccs.shots.init', '1');
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    }, storage);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !/libretro|net::ERR_FAILED/.test(m.text()) && errors.push(m.text()));
    await page.goto(`http://127.0.0.1:${o.port}/`, { waitUntil: 'networkidle' });
    await page.getByText('Welcome to ChannelCraft Studio').waitFor({ timeout: 60000 });
    await page.locator('button[aria-label^="Open "]').first().waitFor({ timeout: 30000 });
    await sleep(800);

    // 1. Make my theme, on the Design step; then the editor screenshots from that theme.
    await wizardTo(page, 'Neon Sunset', 'Synthwave Sunset');
    if (want('wizard')) await shot(page, 'wizard');
    await createAndOpen(page, 'Neon Sunset');

    // 2. The System menu with the designs in Presets.
    await quickScreen(page, 'System menu');
    await dockButton(page, 'presets').click();
    await sleep(800);
    const on = panel(page).locator('button.dcard.on').first();
    if (await on.count()) await on.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 0);
    await sleep(1200);
    if (want('editor')) await shot(page, 'editor');

    // 3. A game list with the Showcase layout, and the layouts in Presets.
    await quickClear(page);
    await quickScreen(page, 'Game list (detailed)');
    await dockButton(page, 'presets').click();
    await sleep(800);
    const showcase = panel(page).locator('button.card').filter({ hasText: 'Showcase' }).first();
    await showcase.scrollIntoViewIfNeeded();
    await showcase.click();
    await sleep(1500);
    await dismissToasts(page);
    await showcase.scrollIntoViewIfNeeded();
    await page.mouse.move(WIDTH - 2, HEIGHT - 2);
    await sleep(1500);
    if (want('game-list')) await shot(page, 'game-list');

    // 4. The box art selected, with its settings on the right and Layers on the left.
    await quickClear(page);
    await dockButton(page, 'elements').click();
    await sleep(600);
    await panel(page).locator('button.row[title^="ccs_boxart "], button.row[title^="md_image "]').first().click();
    await inspector(page).waitFor();
    await sleep(1200);
    if (want('properties')) await shot(page, 'properties');

    // 5. Colours shared by the whole design.
    await quickClear(page);
    await dockButton(page, 'variables').click();
    await sleep(1200);
    if (want('colours')) await shot(page, 'colours');
    await quickClear(page);
    await finishTheme(page);

    // More themes for the home screen, each with its own preview.
    for (const [name, design] of [
      ['Arcade Nights', 'Arcade Marquee'],
      ['Rainy Sunday', 'Cosy Cabin'],
      ['Pocket Pixels', 'Pocket LCD'],
    ]) {
      await wizardTo(page, name, design);
      await createAndOpen(page, name);
      await quickScreen(page, 'Game list (detailed)');
      await sleep(1200);
      await finishTheme(page);
    }

    // 6. Editing the theme RetroBat uses: the offer to make a copy first.
    const active = page.locator('article').filter({ hasText: 'Active in RetroBat' }).first();
    await active.getByRole('button', { name: 'Edit', exact: true }).click();
    await dialog(page).waitFor();
    await sleep(900);
    if (want('safe-edit')) await shot(page, 'safe-edit');
    // Its own preview too, so no card on the home screen is empty.
    await dialog(page).getByRole('button', { name: /Edit the original/ }).click();
    await page.locator('header').waitFor({ timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('[role=dialog]'), null, { timeout: 120000 });
    await sleep(2500);
    await quickClear(page);
    // The stock theme's System menu makes a clearer preview card than its game list.
    await quickScreen(page, 'System menu');
    await sleep(1500);
    await finishTheme(page);

    // 7. The home screen with the themes.
    await sleep(1500);
    if (want('home')) await shot(page, 'home');

    if (errors.length) log(`page errors:\n  ${errors.join('\n  ')}`);
    await context.close();
  } finally {
    await browser.close();
    if (server && !o.keepServer) server.kill();
  }
}

main().catch((e) => {
  console.error('[screenshots]', e.stack ?? e);
  process.exit(1);
});
