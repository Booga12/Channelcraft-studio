// Animations, shadows, frames, rounded corners, glow and one-click looks of an element.
// Part of the editor (editor.svelte.ts): each function is a method of the editor (`this`),
// attached to it there, so callers use ed.<name>(...).

import type { Editor } from '../editor.svelte';
import { ANIMATIONS, boardsXml, EXIT_EVENTS, EXITS, presetOf, retune, screenOf, STILL_TYPES, storyboardXml, tuningOf } from '../theme/animations';
import { type Change, insertTarget, setTextChange } from '../theme/edits';
import { type Frame, frameOf, frameXml } from '../theme/frame';
import { type Glow, glowProps, hex8, textFxProps, type TextFx, type PictureLook, snapPos, type SnapX, type SnapY, type TextLook } from '../theme/simpleProps';
import { type ResolvedElement } from '../theme/resolver';
import { shaderOf, SHADOW_TYPES, shadowXml } from '../theme/shadow';
import { type ThemeFile } from '../theme/project';
import { attr, elements, patchInsertChild, patchRemoveAttr, patchRemoveNode, patchReplaceSpan, patchSetAttr, type XElement } from '../xml/cst';
import { elementLabel } from '../friendly';
import { fmtNum, parsePair } from '../theme/schema';
import { join } from '../path';

/** A number with at most four decimals, as theme files write them. */
const r4 = (v: number) => String(Math.round(v * 10000) / 10000);

/** Adds, replaces or removes (null) the animation of an element. */
export function setAnimation(this: Editor, name: string, presetId: string | null) {
  const el = this.currentView?.elements.get(name);
  if (!el) return;
  const target = insertTarget(el, this.view);
  if (!target) return;
  // The exit storyboards are kept; the main motion is replaced.
  const existing = el.complex.filter((c) => c.name === 'storyboard' && c.node.parent === target.node && !EXIT_EVENTS.has(attr(c.node, 'event') ?? ''));
  const preset = ANIMATIONS.find((a) => a.id === presetId);
  const removeAll = (list: typeof existing): Change[] => list.map((c) => ({ file: c.file, patch: patchRemoveNode(c.file.doc, c.node) }));
  if (!preset) {
    if (existing.length) this.commit('removing animation', removeAll(existing));
    return;
  }
  if (preset.kind !== 'entrance' && STILL_TYPES.has(el.type)) {
    this.notify('Videos stay still: looping motion makes them stutter. Animate the frame around the video instead.', 'error');
    return;
  }
  const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
  const xml = storyboardXml(preset, pos, 1, 1, screenOf(this.view));
  this.commit(`animation “${preset.label}”`, this.replaceBoards(existing, target, xml, removeAll));
  // Shown straight away, as it will look when you move to a game or console in RetroBat.
  this.replayAnimations();
}

/** Replaces the first storyboard in place (the others go), or adds the markup. */
export function replaceBoards(this: Editor, existing: ResolvedElement['complex'], target: { file: ThemeFile; node: XElement }, xml: string, removeAll: (l: ResolvedElement['complex']) => Change[]): Change[] {
  return existing.length
    ? [{ file: existing[0].file, patch: patchReplaceSpan(existing[0].file.doc, existing[0].node, existing[0].node, xml) }, ...removeAll(existing.slice(1))]
    : [{ file: target.file, patch: patchInsertChild(target.file.doc, target.node, xml) }];
}

/** Adds, replaces or removes (null) how an element leaves a game in a game list. */
export function setExit(this: Editor, name: string, exitId: string | null) {
  const el = this.currentView?.elements.get(name);
  if (!el) return;
  if (screenOf(this.view) === 'console') {
    this.notify('RetroBat only plays leaving animations in game lists.', 'error');
    return;
  }
  const target = insertTarget(el, this.view);
  if (!target) return;
  const existing = el.complex.filter((c) => c.name === 'storyboard' && c.node.parent === target.node && EXIT_EVENTS.has(attr(c.node, 'event') ?? ''));
  const removeAll = (list: typeof existing): Change[] => list.map((c) => ({ file: c.file, patch: patchRemoveNode(c.file.doc, c.node) }));
  const exit = EXITS.find((x) => x.id === exitId);
  if (!exit) {
    if (existing.length) this.commit('removing the leaving animation', removeAll(existing));
    return;
  }
  const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
  this.commit(`leaving animation “${exit.label}”`, this.replaceBoards(existing, target, boardsXml(exit.build(pos, 1)), removeAll));
}

/** Rewrites an animation RetroBat never plays on this screen so that it does. */
export function fixAnimation(this: Editor, name: string) {
  const el = this.currentView?.elements.get(name);
  const t = el ? tuningOf(el, screenOf(this.view)) : null;
  if (!el || !t) return;
  const target = insertTarget(el, this.view);
  if (!target) return;
  const existing = el.complex.filter((c) => c.name === 'storyboard' && c.node.parent === target.node);
  const removeAll = (list: typeof existing): Change[] => list.map((c) => ({ file: c.file, patch: patchRemoveNode(c.file.doc, c.node) }));
  const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
  this.commit(`animation “${t.preset.label}” made to play here`, this.replaceBoards(existing, target, storyboardXml(t.preset, pos, t.amount, t.speed, screenOf(this.view)), removeAll));
  this.playAnimations = true;
}

/** Adds, changes or removes (null) RetroBat's drop shadow on a picture. */
export function setShadow(this: Editor, name: string, offset: number | null, coalesce?: string) {
  const el = this.currentView?.elements.get(name);
  if (!el) return;
  const sh = shaderOf(el);
  if (sh && !sh.shadow) {
    this.notify('This picture already uses another RetroBat shader, so a shadow can’t be added. Remove that shader in Advanced mode first.', 'error');
    return;
  }
  if (offset === null) {
    if (sh) this.commit(`removing the shadow of ${elementLabel(name)}`, [{ file: sh.def.file, patch: patchRemoveNode(sh.def.file.doc, sh.def.node) }]);
    return;
  }
  const xml = shadowXml(offset);
  if (sh) {
    const off = elements(sh.def.node).find((n) => n.name === 'shadowOffset');
    const change: Change = off ? setTextChange(sh.def.file, off, String(Math.round(offset))) : { file: sh.def.file, patch: patchReplaceSpan(sh.def.file.doc, sh.def.node, sh.def.node, xml) };
    this.commit(`shadow of ${elementLabel(name)}`, [change], coalesce);
    return;
  }
  const target = insertTarget(el, this.view);
  if (!target) return;
  this.commit(`shadow on ${elementLabel(name)}`, [{ file: target.file, patch: patchInsertChild(target.file.doc, target.node, xml) }]);
}

/**
 * Adds, changes or removes (null) a frame (RetroBat's border shader) on a picture or video.
 * Its corners take over from `roundCorners`, and go back to it when the frame is removed.
 */
export function setFrame(this: Editor, name: string, frame: Frame | null, coalesce?: string) {
  const el = this.currentView?.elements.get(name);
  if (!el) return;
  const now = frameOf(el);
  const sh = shaderOf(el);
  if (sh && !now && !sh.shadow) {
    this.notify('This picture already uses another RetroBat shader, so it can’t have a frame. Remove that shader in Advanced mode first.', 'error');
    return;
  }
  const round = el.props.get('roundCorners');
  // A picture has one RetroBat shader, and the frame draws its own shadow: it takes the soft
  // shadow's place (and the place of roundCorners, which the frame's corners replace).
  if (frame && sh?.shadow && !now) {
    const { file, node } = sh.def;
    const ownRound = round && round.node.parent === node.parent ? [{ file: round.file, patch: patchRemoveNode(round.file.doc, round.node) }] : [];
    this.commit(`frame on ${elementLabel(name)}`, [{ file, patch: patchReplaceSpan(file.doc, node, node, frameXml(frame)) }, ...ownRound]);
    return;
  }
  if (!frame) {
    if (!now) return;
    const { file, node } = now.def;
    const corners = now.frame.corners > 0 ? r4(now.frame.corners) : null;
    // The frame's corners stay as roundCorners: in place of the shader, or in the existing setting.
    const changes: Change[] =
      corners && !round
        ? [{ file, patch: patchReplaceSpan(file.doc, node, node, `<roundCorners>${corners}</roundCorners>`) }]
        : [{ file, patch: patchRemoveNode(file.doc, node) }, ...(corners && round ? [setTextChange(round.file, round.node, corners)] : [])];
    this.commit(`removing the frame of ${elementLabel(name)}`, changes);
    return;
  }
  const xml = frameXml(frame);
  if (now) {
    this.commit(`frame of ${elementLabel(name)}`, [{ file: now.def.file, patch: patchReplaceSpan(now.def.file.doc, now.def.node, now.def.node, xml) }], coalesce);
    return;
  }
  const target = insertTarget(el, this.view);
  if (!target) return;
  // The frame's corners replace roundCorners (both at once would round twice): the shader goes
  // in its place, as one edit.
  const own = round && round.file === target.file && round.node.parent === target.node;
  const change: Change = own ? { file: round.file, patch: patchReplaceSpan(round.file.doc, round.node, round.node, xml) } : { file: target.file, patch: patchInsertChild(target.file.doc, target.node, xml) };
  this.commit(`frame on ${elementLabel(name)}`, [change]);
}

/** Sets rounded corners: in the frame when there is one, else RetroBat's roundCorners (0 removes). */
export function setCorners(this: Editor, name: string, corners: number, coalesce?: string) {
  const el = this.currentView?.elements.get(name);
  if (!el) return;
  const f = frameOf(el);
  if (f) return this.setFrame(name, { ...f.frame, corners }, coalesce);
  if (corners <= 0) return el.props.get('roundCorners') ? this.removeProp(name, 'roundCorners') : undefined;
  this.setProp(name, 'roundCorners', r4(corners), { coalesce });
}

/**
 * Makes an element's animation bigger or smaller and faster or slower, editing its storyboard's
 * from/to/duration in place (other attributes such as `begin` stay). With `all`, every element
 * on this screen with the same kind of animation gets the same size and speed.
 */
export function tuneAnimation(this: Editor, name: string, amount: number, speed: number, opts: { all?: boolean; coalesce?: string } = {}) {
  const view = this.currentView;
  const el = view?.elements.get(name);
  const screen = screenOf(this.view);
  const mine = el ? tuningOf(el, screen) : null;
  if (!view || !mine) return;
  const targets = opts.all ? [...view.elements.values()].filter((e) => tuningOf(e, screen)?.preset.id === mine.preset.id) : [el!];
  const changes: Change[] = [];
  const seen = new Set<XElement>();
  for (const e of targets) {
    const t = tuningOf(e, screen)!;
    if (seen.has(t.storyboards[0])) continue;
    seen.add(t.storyboards[0]);
    const pos = parsePair(e.props.get('pos')?.value) ?? [0, 0];
    for (const a of retune(t, pos, amount, speed, screen)) {
      const def = e.complex.find((c) => t.storyboards.includes(c.node) && elements(c.node).includes(a.node))!;
      changes.push({ file: def.file, patch: patchSetAttr(def.file.doc, a.node, a.name, a.value) });
    }
  }
  if (!changes.length) return;
  this.commit(opts.all ? `motion of every “${mine.preset.label}”` : `motion of ${elementLabel(name)}`, changes, opts.coalesce);
  this.playAnimations = true;
}

/** When an element's entrance starts, in milliseconds after it shows (each animation's `begin`). */
export function setAnimationDelay(this: Editor, name: string, ms: number) {
  const el = this.currentView?.elements.get(name);
  const t = el ? tuningOf(el, screenOf(this.view)) : null;
  if (!el || !t || t.preset.kind !== 'entrance') return;
  const changes: Change[] = [];
  t.animations.forEach((list, i) => {
    const def = el.complex.find((c) => c.node === t.storyboards[i]);
    if (!def) return;
    for (const a of list) {
      const has = attr(a, 'begin') !== undefined;
      if (ms > 0) changes.push({ file: def.file, patch: patchSetAttr(def.file.doc, a, 'begin', String(Math.round(ms))) });
      else if (has) {
        const patch = patchRemoveAttr(def.file.doc, a, 'begin');
        if (patch) changes.push({ file: def.file, patch });
      }
    }
  });
  if (!changes.length) return;
  this.commit(`start time of ${elementLabel(name)}`, changes);
  this.replayAnimations();
}

/**
 * Gives every part of the same kind on this screen (texts, or pictures and videos) the animation
 * of `name`, starting one after another from the top down. One undo step.
 */
export function animateAllLike(this: Editor, name: string): number {
  const view = this.currentView;
  const el = view?.elements.get(name);
  const t = el ? tuningOf(el, screenOf(this.view)) : null;
  if (!view || !el || !t) return 0;
  const textish = (e: ResolvedElement) => ['text', 'datetime', 'clock'].includes(e.type);
  const pictureish = (e: ResolvedElement) => e.type === 'image' || e.type === 'video';
  const same = textish(el) ? textish : pictureish(el) ? pictureish : (e: ResolvedElement) => e.type === el.type;
  const y = (e: ResolvedElement) => this.rects[e.name]?.y ?? parsePair(e.props.get('pos')?.value)?.[1] ?? 0;
  const names = [...view.elements.values()]
    // Full-screen backgrounds and hidden or locked parts stay as they are.
    .filter((e) => same(e) && !this.locked[e.name] && !(this.rects[e.name]?.w > 0.98 && this.rects[e.name]?.h > 0.98) && this.rects[e.name])
    .sort((a, b) => y(a) - y(b))
    .map((e) => e.name);
  if (names.length < 2) return 0;
  const step = 150;
  this.group(`animation “${t.preset.label}” on ${names.length} parts`, () => {
    names.forEach((n, i) => {
      if (n !== name || presetOf(el, screenOf(this.view)) !== t.preset.id) this.setAnimation(n, t.preset.id);
      const mine = this.currentView?.elements.get(n);
      const tn = mine ? tuningOf(mine, screenOf(this.view)) : null;
      if (tn && (Math.abs(tn.speed - t.speed) > 0.01 || Math.abs(tn.amount - t.amount) > 0.01)) this.tuneAnimation(n, t.amount, t.speed);
      if (t.preset.kind === 'entrance') this.setAnimationDelay(n, Math.min(i, 6) * step);
    });
  });
  this.replayAnimations();
  return names.length;
}

/** Moves an element so its box sits at a spot on the screen (a little in from the edges). */
export function snapTo(this: Editor, name: string, sx: SnapX, sy: SnapY) {
  const el = this.currentView?.elements.get(name);
  const rect = this.rects[name];
  if (!el || !rect || this.locked[name]) return;
  const pos = parsePair(el.props.get('pos')?.value) ?? [0, 0];
  const [x, y] = snapPos(rect, pos, sx, sy);
  this.setProp(name, 'pos', `${fmtNum(x)} ${fmtNum(y)}`);
}

/** Gives a text a glow or a shadow (or none), in its own colour. */
export function setGlow(this: Editor, name: string, glow: Glow) {
  const el = this.currentView?.elements.get(name);
  if (!el) return;
  const props = glowProps(glow, hex8(el.props.get('color')?.value) ?? 'FFFFFFFF', el.props.has('glowOffset'));
  this.setProps(name, props);
}

/** Sets a text's glow, shadow or outline (see TextFx). */
export function setTextFx(this: Editor, name: string, fx: TextFx, coalesce?: string) {
  const el = this.currentView?.elements.get(name);
  if (!el) return;
  this.setProps(name, textFxProps(fx, el.props.has('glowOffset')), coalesce);
}

/** A one-click look for a text: a free font (downloaded), capitals and a glow. One undo step. */
export async function applyTextLook(this: Editor, name: string, look: TextLook) {
  const font = await this.ensureFont(look.font);
  const el = this.currentView?.elements.get(name);
  if (!el) return;
  const props: Record<string, string> = {
    forceUppercase: look.caps ? 'true' : 'false',
    ...glowProps(look.glow, hex8(el.props.get('color')?.value) ?? 'FFFFFFFF', el.props.has('glowOffset')),
  };
  if (font) props.fontPath = this.relativeAssetPath(name, 'fontPath', join(this.project!.dir, font));
  const label = `look “${look.label}” on ${elementLabel(name)}`;
  if (this.gameEditing) this.gameSetMany(label, { [name]: props });
  else this.commit(label, this.propChanges(name, props));
  if (!font) this.notify('The font could not be downloaded (offline?), so only the rest of the look was used.');
}

/** A one-click look for a picture: corners, shadow and see-through. One undo step. */
export function applyPictureLook(this: Editor, name: string, look: PictureLook) {
  const el = this.currentView?.elements.get(name);
  if (!el) return;
  this.group(`look “${look.label}” on ${elementLabel(name)}`, () => {
    this.setCorners(name, look.corners);
    if (SHADOW_TYPES.has(el.type) && !frameOf(el)) {
      const sh = shaderOf(el);
      if (!sh || sh.shadow) this.setShadow(name, look.shadow);
    }
    const now = parseFloat(el.props.get('opacity')?.value ?? '1');
    if (Math.abs(now - look.opacity) > 0.001) this.setProp(name, 'opacity', fmtNum(look.opacity));
  });
}
