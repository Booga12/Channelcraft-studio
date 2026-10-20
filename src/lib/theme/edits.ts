import { applyPatch, attr, patchInsertChild, patchSetText, type Patch, type XElement } from '../xml/cst';
import type { ThemeFile, ThemeProject } from './project';
import { splitNames, type ResolvedElement, type Resolution, type Source } from './resolver';

export interface Change {
  file: ThemeFile;
  patch: Patch;
}

/** A recorded change, as offsets into the file text after the transaction ran. */
export interface Applied {
  key: string;
  start: number;
  end: number;
  oldText: string;
  newText: string;
}

/**
 * Applies several patches atomically. Patches in one file must not overlap; they're applied from
 * the end of the file backwards so earlier offsets stay valid. Returns the inverse transaction.
 */
export function applyChanges(project: ThemeProject, changes: Change[]): Applied[] {
  const byFile = new Map<ThemeFile, Patch[]>();
  for (const c of changes) {
    const list = byFile.get(c.file) ?? [];
    list.push(c.patch);
    byFile.set(c.file, list);
  }
  const applied: Applied[] = [];
  for (const [file, patches] of byFile) {
    patches.sort((a, b) => b.start - a.start);
    let src = file.src;
    const deltas = patches.map((p) => p.text.length - (p.end - p.start));
    patches.forEach((p, i) => {
      const oldText = src.slice(p.start, p.end);
      src = applyPatch(src, p);
      // Offsets of this patch after the patches before it in the file (applied later) shift it.
      let shift = 0;
      for (let j = i + 1; j < patches.length; j++) shift += deltas[j];
      applied.push({ key: file.key, start: p.start + shift, end: p.start + shift + p.text.length, oldText, newText: p.text });
    });
    project.setSource(file, src);
  }
  return applied;
}

/** Changes that undo `applied`. */
export function inverse(project: ThemeProject, applied: Applied[]): Change[] {
  return applied.map((a) => ({ file: project.files.get(a.key)!, patch: { start: a.start, end: a.end, text: a.oldText } }));
}

/** `${name}` when a value is exactly one variable reference. */
export function varRef(raw: string): string | null {
  const m = raw.trim().match(/^\$\{([^}]+)\}$/);
  return m ? m[1].trim() : null;
}

/** Views, element names and file a definition node is shared with, for warnings in the UI. */
export function sharing(src: Source): { views: string[]; names: string[] } {
  const names = splitNames(attr(src.node, 'name'));
  const parent = src.node.parent;
  const views = parent && (parent.name === 'view' || parent.name === 'customView') ? splitNames(attr(parent, 'name')) : [];
  return { views, names };
}

/** Where a new property for this element goes: the last definition used only by this element in this view, if any. */
export function insertTarget(el: ResolvedElement, view: string): Source | null {
  const scored = el.defs.map((d, i) => {
    const s = sharing(d);
    const solo = s.names.length <= 1;
    const viewOnly = s.views.length === 1 && s.views[0] === view;
    return { d, score: (solo ? 2 : 0) + (viewOnly ? 1 : 0), i };
  });
  scored.sort((a, b) => b.score - a.score || b.i - a.i);
  return scored[0]?.d ?? null;
}

export function setTextChange(file: ThemeFile, node: XElement, value: string): Change {
  return { file, patch: patchSetText(file.doc, node, value) };
}

export function addPropChange(target: Source, prop: string, value: string): Change {
  return { file: target.file, patch: patchInsertChild(target.file.doc, target.node, `<${prop}>${escapeXml(value)}</${prop}>`) };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Where a new element goes in `view`: the last `<view>` block in theme.xml that names only this
 * view, or a new block at the end of theme.xml.
 */
export function addElementChange(project: ThemeProject, res: Resolution, view: string, type: string, name: string, body: string, extra = true): Change {
  const entry = project.entry!;
  const v = res.views.get(view);
  const blocks = (v?.defs ?? []).filter((d) => d.file === entry && splitNames(attr(d.node, 'name')).length === 1);
  const markup = `<${type} name="${name}"${extra ? ' extra="true"' : ''}>\n${body
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n')}\n</${type}>`;
  const block = blocks[blocks.length - 1];
  if (block) return { file: entry, patch: patchInsertChild(entry.doc, block.node, markup) };
  const root = entry.doc.root!;
  const tag = v?.custom ? 'customView' : 'view';
  const wrapped = `<${tag} name="${view}">\n${markup
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n')}\n</${tag}>`;
  return { file: entry, patch: patchInsertChild(entry.doc, root, wrapped) };
}

/** A name not used yet in the view. */
export function uniqueName(res: Resolution, view: string, base: string): string {
  const used = res.views.get(view)?.elements ?? new Map();
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`;
}
