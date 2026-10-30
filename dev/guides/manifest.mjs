#!/usr/bin/env node
// Refreshes the words in the website's clip manifest (titles, "shows", uiLabels, skipped reasons)
// from the guide scripts, without recording again. The clip files and their numbers are kept.
// Lists any step that has no entry yet (record it) and any clip file that is missing.
//
//   node dev/guides/manifest.mjs [--out <website folder>]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2);
const out = resolve(a.includes('--out') ? a[a.indexOf('--out') + 1] : resolve(HERE, '..', '..', '..', 'channelcraft-website'));
const file = join(out, 'src', 'lib', 'guides', 'clips.json');

const guides = [];
for (const f of readdirSync(join(HERE, 'scripts')).filter((f) => f.endsWith('.mjs')).sort()) guides.push((await import(pathToFileURL(join(HERE, 'scripts', f)).href)).default);
guides.sort((x, y) => (x.order ?? 99) - (y.order ?? 99));

const m = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { version: 2, guides: [] };
const problems = [];
m.guides = guides.map((g) => {
  const old = m.guides?.find((x) => x.slug === g.slug);
  const steps = g.steps.map((s) => {
    const prev = old?.steps.find((x) => x.id === s.id);
    if (!prev) {
      problems.push(`${g.slug}/${s.id}: not recorded yet`);
      return null;
    }
    const words = { id: s.id, title: s.title, ...(s.shows ? { shows: s.shows } : {}), ...(s.uiLabels ? { uiLabels: s.uiLabels } : {}) };
    if (s.skipped) return { ...words, skipped: s.skipped, ...(prev.poster ? { poster: prev.poster, width: prev.width, height: prev.height } : {}) };
    if (prev.skipped) problems.push(`${g.slug}/${s.id}: the manifest has it as skipped, the script records it`);
    const { id, title, shows, uiLabels, skipped, ...clip } = prev;
    for (const k of ['webm', 'mp4', 'poster']) if (clip[k] && !existsSync(join(out, 'static', clip[k]))) problems.push(`${g.slug}/${s.id}: ${clip[k]} is missing`);
    return { ...words, ...clip };
  });
  return { slug: g.slug, title: g.title, order: g.order, steps: steps.filter(Boolean) };
});
writeFileSync(file, `${JSON.stringify(m, null, 2)}\n`);
console.log(`[manifest] ${file}: ${m.guides.length} guides, ${m.guides.reduce((n, g) => n + g.steps.filter((s) => s.webm).length, 0)} clips, ${m.guides.reduce((n, g) => n + g.steps.filter((s) => s.skipped).length, 0)} without a clip`);
for (const p of problems) console.log(`[manifest] ${p}`);
if (problems.length) process.exitCode = 1;
