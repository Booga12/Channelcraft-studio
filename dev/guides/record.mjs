#!/usr/bin/env node
// Records the website's how-to clips from the app's browser mode (see README.md here).
//
//   node dev/guides/record.mjs                      every guide in ./scripts
//   node dev/guides/record.mjs first-theme          one guide
//   node dev/guides/record.mjs first-theme/open-wizard   one step (earlier steps run unrecorded)
//
// Options: --headed (watch it), --speed 1.2 (faster acting), --keep-frames, --no-demo (don't
// rebuild the demo folder first), --keep-server, --port 1430, --demo-root <folder>,
// --out <website folder> (default ../channelcraft-website).
//
// Each guide gets a fresh demo RetroBat (make-demo.mjs) and a fresh browser profile. The dev
// server runs with CCS_DEMO_ROOT, so the app reads and writes only the demo folder; a server on
// the port that isn't this demo is never used.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright-core';
import { DEFAULT_ROOT, makeDemo } from './make-demo.mjs';
import { Actor, Clip, updateManifest } from './recorder.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO = resolve(HERE, '..', '..');
const WIDTH = 1440;
const HEIGHT = 900;

function options() {
  const a = process.argv.slice(2);
  const val = (k, d) => {
    const i = a.indexOf(k);
    return i >= 0 ? a[i + 1] : d;
  };
  const flags = new Set(['--headed', '--keep-frames', '--no-demo', '--keep-server']);
  const valued = new Set(['--speed', '--port', '--demo-root', '--out']);
  const targets = a.filter((x, i) => !flags.has(x) && !valued.has(x) && !valued.has(a[i - 1]));
  return {
    targets,
    headed: a.includes('--headed'),
    keepFrames: a.includes('--keep-frames'),
    demo: !a.includes('--no-demo'),
    keepServer: a.includes('--keep-server'),
    speed: Number(val('--speed', 1)),
    port: Number(val('--port', 1430)),
    demoRoot: resolve(val('--demo-root', DEFAULT_ROOT)),
    out: resolve(val('--out', resolve(STUDIO, '..', 'channelcraft-website'))),
  };
}

const log = (...a) => console.log('[record]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the dev server in demo mode ---------------------------------------------------------------

const demoId = (root) => createHash('sha256').update(resolve(root).toLowerCase()).digest('hex').slice(0, 12);

async function probe(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/__dev/cmd/__demo`, { method: 'POST', body: '{}' });
    return await r.json();
  } catch {
    return null;
  }
}

async function ensureServer(o) {
  const want = demoId(o.demoRoot);
  const found = await probe(o.port);
  if (found?.ok && found.value?.id === want) {
    log(`using the demo dev server already on port ${o.port}`);
    return null;
  }
  if (found) throw new Error(`Port ${o.port} is in use by a dev server that isn't this demo (${found.ok ? 'another demo folder' : 'not in demo mode'}). Stop it or pass --port.`);
  log(`starting the dev server in demo mode on port ${o.port}…`);
  const child = spawn(process.execPath, [join(STUDIO, 'node_modules', 'vite', 'bin', 'vite.js'), 'dev', '--port', String(o.port), '--strictPort'], {
    cwd: STUDIO,
    env: { ...process.env, CCS_DEMO_ROOT: o.demoRoot, BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const problems = [];
  const watch = (buf) => {
    for (const line of buf.toString().split(/\r?\n/)) if (/\[demo\].*failed|error/i.test(line)) problems.push(line.trim());
  };
  child.stdout.on('data', watch);
  child.stderr.on('data', watch);
  child.problems = problems;
  for (let i = 0; i < 120; i++) {
    const p = await probe(o.port);
    if (p?.ok && p.value?.id === want) return child;
    if (child.exitCode !== null) break;
    await sleep(500);
  }
  child.kill();
  throw new Error(`The dev server didn't start in demo mode. ${problems.join(' | ')}`);
}

// ---- guides ------------------------------------------------------------------------------------

async function loadGuides() {
  const dir = join(HERE, 'scripts');
  const out = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()) {
    const m = await import(pathToFileURL(join(dir, f)).href);
    out.push(m.default);
  }
  return out.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

/** What every guide starts from: dark mode, the default accent, the demo's own art only. */
const BASE_STORAGE = {
  'ccs.prefs': { mode: 'dark', accent: 'channelcraft', realArtwork: true, onlineArt: false, playAnimations: true },
};

async function recordGuide(browser, guide, only, o, server, fresh) {
  if (o.demo && fresh) await makeDemo({ root: o.demoRoot });
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1, colorScheme: 'dark', locale: 'en-US' });
  // The art of the demo library only: no box art from the internet.
  await context.route(/libretro-thumbnails|thumbnails\.libretro\.com/, (r) => r.abort());
  const config = { localStorage: { ...BASE_STORAGE, ...(guide.localStorage ?? {}), 'ccs.prefs': { ...BASE_STORAGE['ccs.prefs'], ...(guide.prefs ?? {}) } }, cursorStart: guide.cursorStart ?? [1100, 640] };
  await context.addInitScript(`window.__ccsRecordConfig = ${JSON.stringify(config)};`);
  await context.addInitScript({ path: join(HERE, 'cursor.js') });
  // A guide can change what the bridge answers (e.g. a first start where RetroBat isn't found).
  if (guide.context) await guide.context(context);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  let reloads = 0;
  page.on('framenavigated', (f) => f === page.mainFrame() && reloads++);

  await page.goto(`http://127.0.0.1:${o.port}/`, { waitUntil: 'networkidle' });
  if (guide.ready) await guide.ready(page);
  else {
    await page.getByText('Welcome to ChannelCraft Studio').waitFor({ timeout: 30000 });
    await page.locator('button[aria-label^="Open "]').first().waitFor({ timeout: 30000 });
  }
  await page.evaluate(() => document.fonts.ready);
  await sleep(500);

  const ctx = new Actor(page, { speed: o.speed * (guide.speed ?? 1) });
  ctx.guide = guide;
  ctx.page = page;
  // Steps that aren't recorded still call ctx.clip.mark / ctx.clip.cut.
  const noClip = { mark() {}, cut: (fn) => fn() };
  ctx.clip = noClip;
  if (guide.setup) await guide.setup(ctx);
  const results = [];
  const manifest = join(o.out, 'src', 'lib', 'guides', 'clips.json');
  const describe = (step) => ({ id: step.id, title: step.title, ...(step.shows ? { shows: step.shows } : {}), ...(step.uiLabels ? { uiLabels: step.uiLabels } : {}) });
  for (const step of guide.steps) {
    const record = !only || only === step.id;
    if (!record && only && guide.steps.findIndex((s) => s.id === only) < guide.steps.indexOf(step)) break;
    if (step.before) await step.before(ctx);
    const errorsBefore = consoleErrors.length;
    await page.evaluate(() => (window.__ccsErrors = []));
    const reloadsBefore = reloads;
    if (!record) {
      log(`  ${guide.slug}/${step.id}: run (not recorded)`);
      ctx.clip = noClip;
      if (step.run) await step.run(ctx);
      if (step.after) await step.after(ctx);
      continue;
    }
    if (step.skipped) {
      // No clip is possible (the installer, RetroBat itself, Windows): a still of the app's own
      // screen for it instead, when the step sets one up.
      const entry = { ...describe(step), skipped: step.skipped };
      if (step.still) {
        ctx.clip = noClip;
        await step.still(ctx);
        await page.evaluate(() => window.__cursor?.show(false));
        await sleep(350);
        const base = join(o.out, 'static', 'guides', guide.slug, step.id);
        mkdirSync(dirname(base), { recursive: true });
        await page.screenshot({ path: `${base}.jpg`, type: 'jpeg', quality: 88 });
        await page.evaluate(() => window.__cursor?.show(true));
        entry.poster = `/guides/${guide.slug}/${step.id}.jpg`;
        entry.width = WIDTH;
        entry.height = HEIGHT;
        if (step.after) await step.after(ctx);
      }
      updateManifest(manifest, guide, entry);
      log(`  ${guide.slug}/${step.id}: no clip (${step.skipped})${entry.poster ? ', still written' : ''}`);
      results.push({ step: step.id, ok: true });
      continue;
    }
    const clip = new Clip(page, { width: WIDTH, height: HEIGHT });
    ctx.clip = clip;
    await clip.start();
    await ctx.pause(step.leadIn ?? 700);
    try {
      await step.run(ctx);
    } catch (e) {
      await clip.stop().catch(() => {});
      const shot = join(tmpdir(), `ccs-fail-${guide.slug}-${step.id}.png`);
      await page.screenshot({ path: shot }).catch(() => {});
      log(`  ${guide.slug}/${step.id}: FAILED (${e.message.split('\n')[0]}); screenshot: ${shot}`);
      results.push({ step: step.id, ok: false, problems: [e.message] });
      break;
    }
    await ctx.pause(step.hold ?? 1300);
    const duration = await clip.stop();
    if (step.after) await step.after(ctx);
    const pageErrors = await page.evaluate(() => window.__ccsErrors);
    const problems = [...pageErrors, ...consoleErrors.slice(errorsBefore).filter((e) => !/Failed to load resource.*libretro|net::ERR_FAILED/.test(e))];
    if (reloads !== reloadsBefore) problems.push('the page reloaded during the clip');
    if (server?.problems?.length) problems.push(...server.problems.splice(0));
    if (duration < 3 || duration > 16) problems.push(`the clip is ${duration.toFixed(1)} s (aim for 4–14 s)`);
    const fatal = problems.filter((p) => !/the clip is/.test(p));
    if (fatal.length && !step.allowErrors) {
      log(`  ${guide.slug}/${step.id}: FAILED, nothing written:\n    ${fatal.join('\n    ')}`);
      results.push({ step: step.id, ok: false, problems });
      continue;
    }
    const base = join(o.out, 'static', 'guides', guide.slug, step.id);
    const info = clip.encode(base, { poster: step.poster ?? 'end', loop: step.loop ?? 'fade', keepFrames: o.keepFrames });
    const url = `/guides/${guide.slug}/${step.id}`;
    updateManifest(manifest, guide, {
      ...describe(step),
      webm: `${url}.webm`,
      mp4: `${url}.mp4`,
      poster: `${url}.jpg`,
      seconds: info.duration,
      width: WIDTH,
      height: HEIGHT,
      frames: info.frames,
      bytes: info.bytes,
      posterAt: info.posterAt,
      appVersion: JSON.parse(readFileSync(join(STUDIO, 'package.json'), 'utf8')).version,
      recorded: new Date().toISOString(),
    });
    const kb = (n) => `${Math.round(n / 1024)} KB`;
    log(`  ${guide.slug}/${step.id}: ${info.duration}s, ${info.frames} frames · webm ${kb(info.bytes.webm)} · mp4 ${kb(info.bytes.mp4)} · jpg ${kb(info.bytes.poster)}${problems.length ? ` (note: ${problems.join('; ')})` : ''}`);
    results.push({ step: step.id, ok: true, ...info });
  }
  await context.close();
  return results;
}

async function main() {
  const o = options();
  const guides = await loadGuides();
  const wanted = o.targets.length ? o.targets.map((t) => t.split('/')) : guides.map((g) => [g.slug]);
  for (const [slug] of wanted) if (!guides.some((g) => g.slug === slug)) throw new Error(`No guide "${slug}" in ${join(HERE, 'scripts')} (have: ${guides.map((g) => g.slug).join(', ')})`);
  if (o.demo) await makeDemo({ root: o.demoRoot });
  const server = await ensureServer(o);
  const browser = await chromium.launch({ channel: 'msedge', headless: !o.headed, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-features=Translate'] });
  let failed = 0;
  try {
    // A warm-up visit, so Vite has compiled everything before the first clip (no reloads or
    // spinners while recording).
    const warm = await browser.newPage();
    await warm.goto(`http://127.0.0.1:${o.port}/`, { waitUntil: 'networkidle' });
    await warm
      .evaluate(() =>
        Promise.allSettled(
          ['EditorView', 'Tour', 'Guide', 'SettingsDialog', 'ShortcutsDialog', 'ReportDialog', 'HealthDialog', 'RestoreDialog', 'MenuOptionsDialog', 'SaveDesignDialog', 'FeaturedDialog', 'MediaCheckDialog'].map((c) => import(/* @vite-ignore */ `/src/lib/components/${c}.svelte`)),
        ),
      )
      .catch(() => {});
    await warm.waitForLoadState('networkidle');
    await warm.close();
    for (const [i, [slug, step]] of wanted.entries()) {
      const guide = guides.find((g) => g.slug === slug);
      log(`${guide.slug}: ${guide.title}`);
      // A fresh demo folder for every guide (the first was made before the server started).
      const res = await recordGuide(browser, guide, step, o, server, i > 0);
      failed += res.filter((r) => !r.ok).length;
    }
  } finally {
    await browser.close();
    if (server && !o.keepServer) server.kill();
  }
  if (failed) {
    log(`${failed} step(s) failed; see above.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[record]', e.stack ?? e);
  process.exit(1);
});
