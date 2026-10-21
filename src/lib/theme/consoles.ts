// Per-console values, written the way RetroBat reads them: a second definition of the same
// variable or property, right after the shared one, with if="${system.theme} == 'snes'".
// RetroBat honours `if` on single variables (ThemeData::parseVariable) and on single properties
// (ThemeData::parseElement), and the later definition wins, so the console's own value applies
// only on that console and every other console keeps the shared one.

import { attr, escapeAttr, patchInsertAfter, patchInsertChild, type XElement } from '../xml/cst';
import type { Change } from './edits';
import { insertTarget } from './edits';
import type { PropDef, Resolution, ResolvedElement, Source, VarDef } from './resolver';

export function consoleCondition(theme: string): string {
  return `\${system.theme} == '${theme}'`;
}

const COND_RE = /^\s*\$\{system\.theme\}\s*==\s*(['"])([^'"]+)\1\s*$/;

/** The console a definition is limited to, when it has exactly this kind of condition. */
export function consoleOf(node: XElement): string | null {
  const cond = attr(node, 'if');
  return cond ? (cond.match(COND_RE)?.[2] ?? null) : null;
}

/** The definition limited to `theme`, if any, in a property's or variable's history. */
export function overrideIn<T extends Source>(history: T[] | undefined, theme: string): T | undefined {
  return history?.findLast((d) => consoleOf(d.node) === theme);
}

/** The last definition that applies to every console. */
export function sharedIn<T extends Source>(history: T[] | undefined): T | undefined {
  return history?.findLast((d) => consoleOf(d.node) === null);
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function markup(tag: string, theme: string, value: string): string {
  return `<${tag} if="${escapeAttr(consoleCondition(theme))}">${escapeText(value)}</${tag}>`;
}

/** Adds a console's own value of a variable just after its shared definition. */
export function addConsoleVar(res: Resolution, name: string, theme: string, value: string): Change | null {
  const base = sharedIn(res.varHistory.get(name)) ?? res.vars.get(name);
  if (!base) return null;
  return { file: base.file, patch: patchInsertAfter(base.file.doc, base.node, markup(name, theme, value)) };
}

/** Adds a console's own value of a property: after the shared definition, or into the element. */
export function addConsoleProp(el: ResolvedElement, view: string, prop: string, theme: string, value: string): Change | null {
  const base = sharedIn(el.history.get(prop));
  if (base) return { file: base.file, patch: patchInsertAfter(base.file.doc, base.node, markup(prop, theme, value)) };
  const target = insertTarget(el, view);
  if (!target) return null;
  return { file: target.file, patch: patchInsertChild(target.file.doc, target.node, markup(prop, theme, value)) };
}

export interface ConsoleValue {
  kind: 'var' | 'prop';
  name: string;
  /** Element name, for properties. */
  element?: string;
  def: VarDef | PropDef;
}

/** Everything a console has its own value for: variables, and properties on screen `view`. */
export function consoleValues(res: Resolution, view: string, theme: string): ConsoleValue[] {
  const out: ConsoleValue[] = [];
  for (const [name, h] of res.varHistory) {
    const d = overrideIn(h, theme);
    if (d) out.push({ kind: 'var', name, def: d });
  }
  for (const el of res.views.get(view)?.elements.values() ?? []) {
    for (const [prop, h] of el.history) {
      const d = overrideIn(h, theme);
      if (d) out.push({ kind: 'prop', name: prop, element: el.name, def: d });
    }
  }
  return out;
}
