// Restyling whole screens: designs and their artwork, depth, colours, layouts, palettes and starter themes.
// Part of the editor (editor.svelte.ts): each function is a method of the editor (`this`),
// attached to it there, so callers use ed.<name>(...).

import type { Editor } from '../editor.svelte';
import { type Change, setTextChange } from '../theme/edits';
import { type Depth, DEPTH_VAR, depthLevel, FRAMED, MOTION_FEELS, MOTION_VAR, PARALLAX, PARALLAX_ANIM, SCREEN_FX_VAR, type ScreenFx, screenFxOf, SHADOWED } from '../theme/depth';
import { depthLogoScale, type Design, designAssets, DESIGNS, GAME_VIEWS, recoloured } from '../theme/designs';
import { GAME_LAYOUTS } from '../theme/gameLayouts';
import { appliedDesign, appliedGameLayout, appliedSystemLayout, coloursFromVars, designChanges, hidesOwn, layoutChanges, type LayoutPreset, type Palette, paletteDesignVars } from '../theme/presets';
import { SYSTEM_LAYOUTS } from '../theme/systemLayouts';
import { TILE_DIR, TILE_STYLES, tileArt, type TileColours, tileColoursFrom, tileStyleProps } from '../theme/tiles';
import { patchInsertChild, patchRemoveAttr, patchSetAttr, type XElement } from '../xml/cst';
import { api, registerVirtualFile } from '../api';
import { frameOf } from '../theme/frame';
import { join } from '../path';
import { presetOf, screenOf, tuningOf } from '../theme/animations';
import { shaderOf } from '../theme/shadow';
import { sharedIn } from '../theme/consoles';
import { svgToPngBase64 } from '../raster';
import { task } from '../task.svelte';
import { elementLabel, viewLabel } from '../friendly';
import { basename } from '../path';
import { canMakeVideos, makeMovingBg, MOVING_BGS, MOVING_DIR, MOVING_VAR, MOVING_Z, movingFileName, movingIdOf } from '../theme/movingBg';
import { isVisible, zOf } from '../render';
import type { ResolvedElement } from '../theme/resolver';
import { toBase64 } from '../theme/sounds';

/**
 * Gives a design theme more or less depth on every screen at once, as one undo step. Each screen
 * made from a design is drawn again at the new depth (shadows under art, text and panels,
 * frames, reflections, lifts, layers moving), keeping everything you chose on it.
 */
export async function setDepth(this: Editor, id: Depth) {
  if (this.sharedOnly('Depth settings')) return;
  const p = this.project;
  const res = this.themeRes ?? this.res;
  if (!p || !res || this.depth === null) return void this.notify('Depth works on themes made from a design (New theme, or a design in Presets).', 'error');
  if (this.menuGuard()) return;
  const lv = depthLevel(id);
  if (!['system', ...GAME_VIEWS].some((v) => appliedDesign(p, v))) return this.setDepthPartly(id);
  const v = this.designVarChange(DEPTH_VAR, id);
  const wrote = await this.redesignAll(`depth “${lv.label}”`, { depth: id }, v ? [v] : []);
  if (wrote !== null) this.notify(`Depth “${lv.label}”: ${lv.help}${wrote ? '' : ' (Preview only: files can’t be written here.)'} Ctrl+Z to undo.`);
}

/** Puts a screen effect (CRT, scanlines...) over every screen of a design theme, as one undo step. */
export async function setScreenFx(this: Editor, id: ScreenFx) {
  if (this.sharedOnly('Screen effects')) return;
  const p = this.project;
  if (!p || this.depth === null || !['system', ...GAME_VIEWS].some((v) => appliedDesign(p, v))) return void this.notify('Screen effects work on themes made from a design (New theme, or a design in Presets).', 'error');
  if (this.menuGuard()) return;
  const fx = screenFxOf(id);
  const v = this.designVarChange(SCREEN_FX_VAR, id);
  const wrote = await this.redesignAll(`screen effect “${fx.label}”`, { screenFx: id }, v ? [v] : []);
  if (wrote !== null) this.notify(`Screen effect “${fx.label}”: ${fx.help}${wrote ? '' : ' (Preview only: files can’t be written here.)'} Ctrl+Z to undo.`);
}

/**
 * Draws every screen made from a design again, with a new depth or screen effect, keeping
 * everything you chose on them; one undo step together with `extra` changes. Returns whether the
 * artwork could be written, or null if the theme closed meanwhile.
 */
export async function redesignAll(this: Editor, label: string, o: { depth?: Depth; screenFx?: string; movingBg?: string | null }, extra: Change[]): Promise<boolean | null> {
  const p = this.project;
  if (!p) return null;
  const id = o.depth ?? this.depth ?? 'subtle';
  const views = ['system', ...GAME_VIEWS].filter((v) => appliedDesign(p, v));
  const colours = this.designColours();
  const byDesign = new Map<Design, string[]>();
  for (const v of views) {
    const d = appliedDesign(p, v)!;
    byDesign.set(d, [...(byDesign.get(d) ?? []), v]);
  }
  const has = (dir: string) => p.assets.some((a) => a.rel.toLowerCase().startsWith(`${dir}/`));
  const changes: Change[] = [];
  let wrote = true;
  for (const [d, vs] of byDesign) {
    const artRel = `_inc/ccs/${d.id}`;
    wrote = (await this.writeArt(artRel, designAssets(colours ? recoloured(d, colours) : d, id))) && wrote;
    const font = await this.ensureFont(d.font);
    const titleFont = d.titleFont ? await this.ensureFont(d.titleFont) : null;
    if (this.project !== p) return null;
    const ctx = { vars: true, art: `./${artRel}`, font: font ? `./${font}` : null, titleFont: titleFont ? `./${titleFont}` : null, logos: has('_inc/systems/logos') ? './_inc/systems/logos' : null, consoles: has('_inc/systems/consoles') ? './_inc/systems/consoles' : null, depth: id, motion: this.motionFeel ? MOTION_FEELS[this.motionFeel] : undefined, screenFx: o.screenFx ?? this.screenFx, movingBg: o.movingBg !== undefined ? o.movingBg : this.movingBgPath() };
    const now = this.res;
    if (!now) return null;
    const gameLayouts = Object.fromEntries(vs.map((v) => [v, appliedGameLayout(p, v)]));
    changes.push(...designChanges(p, now, d, ctx, vs, hidesOwn(p, now, vs), appliedSystemLayout(p) ?? undefined, { gameLayouts, carry: 'layout' }));
  }
  this.commit(label, [...extra, ...changes]);
  return wrote;
}

/** Depth on a theme whose screens aren't recognised as a design's: only the parts it can find. */
export function setDepthPartly(this: Editor, id: Depth) {
  const res = this.themeRes ?? this.res;
  if (!res) return;
  const lv = depthLevel(id);
  const from = this.depth ?? 'subtle';
  const keep = { view: this.view, file: this.screenFile, consoleOnly: this.consoleOnly, selected: this.selected, selection: this.selection };
  this.consoleOnly = false;
  this.group(`depth “${lv.label}”`, () => {
    this.setDesignVar(DEPTH_VAR, id);
    if (this.screenFile !== 'theme.xml') this.screenFile = 'theme.xml';
    for (const view of ['system', 'basic', 'detailed', 'video'].filter((v) => this.viewNames.includes(v))) {
      this.view = view;
      const kind = view === 'system' ? 'system' : 'game';
      const el = (n: string) => this.currentView?.elements.get(n);
      for (const n of SHADOWED[kind]) {
        const e = el(n);
        if (!e || e.type !== 'image' || frameOf(e)) continue;
        const sh = shaderOf(e);
        if (lv.shadow && (!sh || sh.shadow)) this.setShadow(n, lv.shadow);
        else if (!lv.shadow && sh?.shadow) this.setShadow(n, null);
      }
      for (const n of FRAMED) {
        const f = el(n) && frameOf(el(n)!);
        if (f && f.frame.shadow !== lv.frameShadow) this.setFrame(n, { ...f.frame, shadow: lv.frameShadow });
      }
      for (const e of [...(this.currentView?.elements.values() ?? [])].filter((x) => x.type === 'carousel')) {
        const now = Number(e.props.get('logoScale')?.value ?? depthLevel(from).logoScale) || depthLevel(from).logoScale;
        this.setProps(e.name, { logoScale: depthLogoScale(now, from, id) });
      }
      const bg = el(PARALLAX[kind]);
      if (bg) {
        const now = presetOf(bg, screenOf(view));
        if (lv.parallax && !now) this.setAnimation(bg.name, PARALLAX_ANIM);
        else if (!lv.parallax && now === PARALLAX_ANIM) this.setAnimation(bg.name, null);
      }
    }
  });
  if (keep.file !== this.screenFile) this.screenFile = keep.file;
  this.view = keep.view;
  this.consoleOnly = keep.consoleOnly;
  this.selection = keep.selection;
  this.selected = keep.selected;
  this.notify(`Depth “${lv.label}”: ${lv.help} Ctrl+Z to undo.`);
}

/** Writes one of the design's own variables (depth, motion feel) next to its colours. */
export function setDesignVar(this: Editor, name: string, value: string) {
  const c = this.designVarChange(name, value);
  if (c) this.commit(name, [c]);
}

/** The change that sets one of the design's own variables, or null when there's nothing to do. */
export function designVarChange(this: Editor, name: string, value: string): Change | null {
  const res = this.themeRes ?? this.res;
  if (!res) return null;
  const def = sharedIn(res.varHistory.get(name)) ?? res.vars.get(name);
  const accent = sharedIn(res.varHistory.get('designAccent')) ?? res.vars.get('designAccent');
  if (def) return def.value.trim() !== value ? setTextChange(def.file, def.node, value) : null;
  if (accent?.node.parent) return { file: accent.file, patch: patchInsertChild(accent.file.doc, accent.node.parent as XElement, `<${name}>${value}</${name}>`, { first: true }) };
  return null;
}

/**
 * One feel for every animation in theme.xml's screens: calm (smaller, slower), normal (each
 * preset's own) or lively (bigger, quicker). One undo step.
 */
export function setMotionFeel(this: Editor, feel: keyof typeof MOTION_FEELS) {
  if (this.sharedOnly('Motion settings')) return;
  const f = MOTION_FEELS[feel];
  const keep = { view: this.view, file: this.screenFile, consoleOnly: this.consoleOnly };
  this.consoleOnly = false;
  let count = 0;
  this.group(`${f.label.toLowerCase()} motion`, () => {
    // Kept with the design, so layouts and designs applied later move the same way.
    if (this.depth !== null) this.setDesignVar(MOTION_VAR, feel);
    if (this.screenFile !== 'theme.xml') this.screenFile = 'theme.xml';
    for (const view of this.viewNames) {
      this.view = view;
      for (const e of [...(this.currentView?.elements.values() ?? [])]) {
        const t = tuningOf(e, screenOf(view));
        // The background's slow zoom keeps its pace: it belongs to the depth setting.
        if (!t || t.preset.id === PARALLAX_ANIM) continue;
        const before = this.history.done.length;
        this.tuneAnimation(e.name, t.preset.amount ? f.amount : 1, f.speed);
        if (this.history.done.length > before) count++;
      }
    }
  });
  if (keep.file !== this.screenFile) this.screenFile = keep.file;
  this.view = keep.view;
  this.consoleOnly = keep.consoleOnly;
  this.notify(count ? `${f.label} motion for ${count} animation${count === 1 ? '' : 's'}. Ctrl+Z to undo.` : 'Nothing to change: no animations here yet, or they already move like this.');
}

/** Writes generated SVG artwork into the theme (and shows it straight away). Returns false if it couldn't be written. */
export async function writeArt(this: Editor, relDir: string, files: Record<string, string>): Promise<boolean> {
  const p = this.project;
  if (!p) return false;
  await this.ensureBackup();
  let wrote = true;
  for (const [file, svg] of Object.entries(files)) {
    const abs = join(p.dir, relDir, file);
    registerVirtualFile(abs, svg);
    try {
      // A .png given as SVG source is drawn to a real PNG first.
      if (file.toLowerCase().endsWith('.png')) await api.writeBinary(abs, await svgToPngBase64(svg));
      else await api.writeText(abs, svg, false);
    } catch {
      wrote = false;
    }
  }
  p.setAssets([...p.assets.filter((a) => !Object.keys(files).some((f) => a.rel === `${relDir}/${f}`)), ...Object.keys(files).map((f) => ({ rel: `${relDir}/${f}`, kind: 'image' as const, size: 0 }))]);
  this.rev++;
  return wrote;
}

/** Applies the choices from the New theme dialog to a freshly created theme and saves it. */
export async function applyStarter(this: Editor, choice: { design: string; artFrom: string | null; systemLayout?: string; gameLayout?: string }) {
  const p = this.project;
  if (!p) return;
  const design = DESIGNS.find((d) => d.id === choice.design);
  // Each step shows in the loading overlay (TaskOverlay) while it runs.
  if (choice.artFrom) {
    task.step('art');
    await this.importConsoleArt(choice.artFrom);
  }
  if (design) {
    task.step('design');
    await this.applyDesign(design, { hideOwn: true, systemLayout: choice.systemLayout, gameLayout: choice.gameLayout });
  }
  task.step('save');
  await this.save();
  this.notify(`“${p.name}” is ready${design ? ` with the ${design.label} design` : ''}. It's saved; your changes from here can be undone.`);
  // The starting point is the saved theme, not something to undo back past.
  this.undoStack = [];
  this.redoStack = [];
  this.view = this.viewNames.includes('detailed') ? 'detailed' : this.view;
}

/** The design artwork folders in this theme and the colours they should be drawn in now. */
/** The theme's design colours (designAccent...), as shared across consoles, if it has them. */
/** @internal */
export function designColours(this: Editor) {
  const res = this.res;
  return res ? coloursFromVars((n) => (sharedIn(res.varHistory.get(n)) ?? res.vars.get(n))?.value) : null;
}

export function designArtNow(this: Editor): { key: string; jobs: { dir: string; files: () => Record<string, string> }[] } | null {
  const p = this.project;
  const colours = this.designColours();
  if (!p || !colours) return null;
  const dirs = new Set(p.assets.map((a) => a.rel.toLowerCase().match(/^_inc\/ccs\/([^/]+)\//)?.[1]).filter(Boolean));
  const tileDirs = new Set(p.assets.map((a) => a.rel.toLowerCase().match(/^_inc\/ccs\/tiles\/([^/]+)\//)?.[1]).filter(Boolean));
  const jobs = [
    ...DESIGNS.filter((d) => dirs.has(d.id)).map((d) => ({ dir: `_inc/ccs/${d.id}`, files: () => designAssets(recoloured(d, colours), this.depth ?? d.depth), id: d.id })),
    ...TILE_STYLES.filter((t) => tileDirs.has(t.id)).map((t) => ({ dir: `${TILE_DIR}/${t.id}`, files: () => tileArt(t, this.tileColours()), id: `tiles/${t.id}` })),
  ];
  if (!jobs.length) return null;
  return { key: `${jobs.map((j) => j.id).join(',')}|${Object.values(colours).join(',')}|${this.depth ?? ''}`, jobs };
}

/** Colours for grid tiles: the design colours, else the tiles' own colours on this screen. */
export function tileColours(this: Editor): TileColours {
  const c = this.designColours();
  if (c) return { tile: c.text, accent: c.accent, text: c.text };
  // Otherwise the theme's accent and text colours when it names them (as the starter theme
  // does), else the tiles' colours as written (white once a style has been applied).
  const els = this.currentView?.elements;
  const v = (n: string) => this.res?.vars.get(n)?.value;
  const bg = (n: string) => els?.get(n)?.props.get('backgroundColor')?.value;
  return tileColoursFrom(v('textColor') ?? bg('default'), v('accentColor') ?? bg('selected'), v('textColor'));
}

/** Gives the image grid on this screen a tile style: new tile pictures and matching settings. */
export async function applyTileStyle(this: Editor, id: string) {
  const style = TILE_STYLES.find((t) => t.id === id);
  const v = this.currentView;
  if (!style || !v || this.tileStyle === null) return;
  if (!v.elements.has('default') || !v.elements.has('selected')) {
    this.notify('This grid has no tile settings (“default” and “selected”) to style. Grids from Presets have them.', 'error');
    return;
  }
  const wrote = await this.writeArt(`${TILE_DIR}/${style.id}`, tileArt(style, this.tileColours()));
  const props = tileStyleProps(style);
  const grid = [...v.elements.values()].find((e) => e.type === 'imagegrid')!;
  const updates: Record<string, Record<string, string>> = {};
  for (const [name, p] of Object.entries(props)) {
    const target = name === 'imagegrid' ? grid.name : name;
    if (v.elements.has(target)) updates[target] = p;
  }
  this.setPropsMany(`tile style “${style.label}”`, updates);
  this.notify(wrote ? `Tiles now use “${style.label}”. Ctrl+Z to undo.` : `Tile style “${style.label}” shown in the preview only (files can’t be written here).`);
}

/** Writes a layout preset into its own block at the end of theme.xml (replacing an earlier one). */
export async function applyLayout(this: Editor, preset: LayoutPreset, views: string[], style: Design | null = null, hideOwn = true) {
  if (this.sharedOnly('Layouts')) return;
  if (this.menuGuard()) return;
  const p = this.project;
  if (!p) return;
  // A system layout can come dressed in a design: its background, colours, fonts and the
  // console name, maker, game count and picture placed to suit the layout.
  if (style && preset.kind === 'system') {
    const same = appliedDesign(p, 'system')?.id === style.id;
    return this.applyDesign(style, { hideOwn, views: ['system'], systemLayout: preset.id, carry: same ? 'layout' : 'design' });
  }
  // A game list layout on a design theme: the same design, laid out the new way.
  if (preset.kind === 'game' && (style ?? appliedDesign(p, views[0]))) {
    const d = style ?? appliedDesign(p, views[0])!;
    return this.applyDesign(d, { hideOwn, views, gameLayout: preset.id, carry: appliedDesign(p, views[0])?.id === d.id ? 'layout' : 'design' });
  }
  if (preset.assets) await this.writeArt('_inc/ccs/common', preset.assets);
  const res = this.res;
  if (!res) return;
  this.commit(`layout “${preset.label}”`, layoutChanges(p, res, preset, views));
  this.selected = null;
}

/** Sets the transition RetroBat uses between screens when its Transition Style is Auto. */
export function setThemeTransition(this: Editor, value: string) {
  const entry = this.project?.fileAt('theme.xml');
  const root = entry?.doc.root;
  if (!entry || !root || value === this.themeTransition) return;
  const patch = value ? patchSetAttr(entry.doc, root, 'defaultTransition', value) : patchRemoveAttr(entry.doc, root, 'defaultTransition');
  if (patch) this.commit('screen transition', [{ file: entry, patch }]);
}

/** Makes a design theme's text readable again: near-black or white, whichever suits the background. */
export function fixReadability(this: Editor) {
  const r = this.readability;
  if (!r) return;
  const changes = [this.varChange('designText', `${r.text}FF`), this.varChange('designDimText', `${r.dim}FF`)].filter((c): c is Change => !!c);
  if (changes.length) this.commit('readable text', changes);
  this.notify('Text colours changed so everything is easy to read. Ctrl+Z to undo.');
}

/**
 * Puts one screen back to its design as it comes, at the theme's colours and depth, keeping its
 * layouts. What you added or changed on that screen goes; other screens aren't touched.
 */
export async function resetScreen(this: Editor, view: string) {
  const p = this.project;
  const d = p ? appliedDesign(p, view) : null;
  if (!p || !d) return;
  await this.applyDesign(d, { views: [view], carry: 'none', systemLayout: view === 'system' ? (appliedSystemLayout(p) ?? undefined) : undefined, gameLayout: appliedGameLayout(p, view) ?? undefined });
  this.notify(`${viewLabel(view)} is back to the ${d.label} design. Ctrl+Z to undo.`);
}

/** A random design with random layouts that go together (Surprise me). */
export async function surprise(this: Editor, opts: { hideOwn?: boolean; group?: string } = {}) {
  const pool = DESIGNS.filter((d) => !opts.group || opts.group === 'all' || d.group === opts.group);
  const d = pool[Math.floor(Math.random() * pool.length)];
  const sys = SYSTEM_LAYOUTS[Math.floor(Math.random() * SYSTEM_LAYOUTS.length)];
  const games = GAME_LAYOUTS.filter((l) => !l.flipOf || Math.random() < 0.3);
  const game = games[Math.floor(Math.random() * games.length)];
  await this.applyDesign(d, { hideOwn: opts.hideOwn ?? true, systemLayout: sys.id, gameLayout: game.id });
  this.notify(`Surprise: ${d.label}, with ${sys.label} and ${game.label}. Press again for another, or Ctrl+Z to undo.`);
}

export function applyPalette(this: Editor, palette: Palette): number {
  const res = this.res;
  if (!res || this.sharedOnly('Colour palettes')) return 0;
  // Themes made from a design draw with the design colours (designAccent...), so those change
  // too; their artwork follows by itself (syncDesignArt).
  const colours: Record<string, string> = { ...palette.colors, ...(res.vars.has('designAccent') ? paletteDesignVars(palette) : {}) };
  const changes = Object.entries(colours)
    .filter(([name]) => res.vars.has(name))
    .map(([name, value]) => this.varChange(name, value))
    .filter((c): c is Change => !!c);
  if (changes.length) this.commit(`palette “${palette.label}”${this.consoleOnly ? ` for ${this.consoleName}` : ''}`, changes);
  return changes.length;
}

/** The moving background video the theme uses (theme-relative, ./...), if its file is there. */
export function movingBgPath(this: Editor): string | null {
  const p = this.project;
  const file = (this.themeRes ?? this.res)?.vars.get(MOVING_VAR)?.value.trim();
  if (!p || !file || file === 'none') return null;
  const rel = `${MOVING_DIR}/${file}`;
  return p.assets.some((a) => a.rel.toLowerCase() === rel.toLowerCase()) ? `./${rel}` : null;
}

/** Which moving background the theme has (an id in MOVING_BGS), or null. */
export function movingBg(this: Editor): string | null {
  void this.rev;
  const path = this.movingBgPath();
  return path ? movingIdOf(basename(path)) : null;
}

/** Whether a picture or video fills (about) the whole screen. */
function fillsScreen(e: ResolvedElement): boolean {
  const nums = (prop: string) => (e.props.get(prop)?.value ?? '').trim().split(/\s+/).map(Number);
  const [x = 0, y = 0] = nums('pos');
  const sized = e.props.has('size') ? nums('size') : nums('maxSize');
  const w = sized[0] || sized[1] || 0;
  const h = sized[1] || sized[0] || 0;
  const [ox = 0, oy = 0] = e.props.has('origin') ? nums('origin') : [0, 0];
  const left = x - ox * w;
  const top = y - oy * h;
  return left <= 0.03 && top <= 0.03 && left + w >= 0.97 && top + h >= 0.97;
}

/**
 * The theme's own full-screen pictures that RetroBat draws over the moving background, so it
 * can't be seen, by screen. Design parts and pictures of the game (paths with {...}) don't count.
 */
export function movingBgCovers(this: Editor): { view: string; names: string[] }[] {
  void this.rev;
  const p = this.project;
  const res = this.themeRes ?? this.res;
  if (!p || !res || !this.movingBgPath()) return [];
  const out: { view: string; names: string[] }[] = [];
  for (const view of ['system', ...GAME_VIEWS].filter((v) => appliedDesign(p, v))) {
    const v = res.views.get(view);
    if (!v) continue;
    const names = [...v.elements.values()]
      .filter((e) => (e.type === 'image' || e.type === 'video') && !e.name.startsWith('ccs_') && !e.name.startsWith('staticBackground') && !e.name.startsWith('md_') && isVisible(e) && zOf(e) > MOVING_Z && !(e.props.get('path')?.value ?? '').includes('{') && fillsScreen(e))
      .map((e) => e.name);
    if (names.length) out.push({ view, names });
  }
  return out;
}

/** The names of the pictures covering the moving background, in words ("Image2, Picture and 3 more"). */
export function movingBgCoverText(this: Editor): string {
  const names = [...new Set(this.movingBgCovers().flatMap((c) => c.names))].map((n) => elementLabel(n));
  if (names.length <= 3) return names.join(names.length === 2 ? ' and ' : ', ').replace(/, ([^,]*)$/, ' and $1');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/** Hides (in RetroBat too) the pictures covering the moving background, on every screen. One undo step. */
export function hideMovingBgCovers(this: Editor) {
  const covers = this.movingBgCovers();
  if (!covers.length) return;
  const count = new Set(covers.flatMap((c) => c.names)).size;
  const keep = { view: this.view, file: this.screenFile, consoleOnly: this.consoleOnly, selected: this.selected, selection: this.selection };
  this.consoleOnly = false;
  this.group(`hide ${count === 1 ? 'a picture' : `${count} pictures`} covering the moving background`, () => {
    if (this.screenFile !== 'theme.xml') this.screenFile = 'theme.xml';
    for (const { view, names } of covers) {
      this.view = view;
      for (const n of names) this.setProp(n, 'visible', 'false', { literal: true });
    }
  });
  if (keep.file !== this.screenFile) this.screenFile = keep.file;
  this.view = keep.view;
  this.consoleOnly = keep.consoleOnly;
  this.selection = keep.selection;
  this.selected = keep.selected;
  this.notify(`Hid ${count === 1 ? 'the picture' : `${count} pictures`} covering the moving background, so it shows in RetroBat now. Ctrl+Z brings them back.`);
}

/**
 * Gives every screen of a design theme a moving background, made now in the theme's colours
 * (a few seconds), or takes it away. One undo step.
 */
export async function setMovingBg(this: Editor, id: string | null) {
  if (this.sharedOnly('Moving backgrounds')) return;
  const p = this.project;
  const colours = this.designColours();
  if (!p || this.depth === null || !colours || !['system', ...GAME_VIEWS].some((v) => appliedDesign(p, v))) return void this.notify('Moving backgrounds work on themes made from a design (New theme, or a design in Presets).', 'error');
  if (this.menuGuard()) return;
  const bg = id ? MOVING_BGS.find((m) => m.id === id) : null;
  if (id && !bg) return;
  let path: string | null = null;
  if (bg) {
    const file = movingFileName(bg.id, colours);
    const rel = `${MOVING_DIR}/${file}`;
    if (!p.assets.some((a) => a.rel.toLowerCase() === rel.toLowerCase())) {
      if (!canMakeVideos()) return void this.notify('This PC can’t make videos here, so moving backgrounds aren’t available.', 'error');
      try {
        await this.ensureBackup();
        const bytes = await makeMovingBg(bg.id, colours, (f) => this.notify(`Making “${bg.label}”… ${Math.round(f * 100)}%`, 'info', 600000));
        await api.writeBinary(join(p.dir, rel), toBase64(bytes));
      } catch (e) {
        return void this.notify(`Couldn’t make the moving background: ${e}`, 'error');
      }
      if (this.project !== p) return;
      p.setAssets([...p.assets, { rel, kind: 'video', size: 0 }]);
    }
    path = `./${rel}`;
  }
  const v = this.designVarChange(MOVING_VAR, path ? basename(path) : 'none');
  const wrote = await this.redesignAll(bg ? `moving background “${bg.label}”` : 'no moving background', { movingBg: path }, v ? [v] : []);
  if (wrote === null) return;
  if (bg && this.movingBgCovers().length) {
    this.notify(`Moving background “${bg.label}” is on, but ${this.movingBgCoverText()} cover${this.movingBgCovers().flatMap((c) => c.names).length === 1 ? 's' : ''} it, so RetroBat won't show it.`, 'info', 15000, { label: 'Hide them', run: () => this.hideMovingBgCovers() });
    return;
  }
  this.notify(bg ? `Moving background “${bg.label}” on every screen. RetroBat plays it; the preview here shows it too. Ctrl+Z to undo.` : 'The moving background is gone; the still one shows again.');
}
