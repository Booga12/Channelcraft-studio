// Theme health check: things that look broken in RetroBat (missing pictures and fonts, parts off
// the screen), each with a one-click fix where one is safe. Read only; fixes are Changes the
// editor commits as one undo step.
import { basename, dirname, join, relative } from '../path';
import { patchRemoveNode } from '../xml/cst';
import { setTextChange, type Change } from './edits';
import type { Environment } from './context';
import type { ThemeProject } from './project';
import { resolveAsset, type PropDef, type ResolvedElement, type Resolution } from './resolver';
import { parsePair } from './schema';

export type HealthKind = 'missing-file' | 'missing-font' | 'off-screen' | 'cut-off' | 'hard-to-read';

export interface HealthIssue {
  kind: HealthKind;
  /** Stays the same while the theme is edited, to remember an issue you chose to ignore. */
  key: string;
  /** Plain words: what is wrong. */
  text: string;
  /** Screens it shows on (view names). */
  views: string[];
  /** One element it is on, to show it. */
  element: string;
  /** The safe fix, if there is one. */
  fix?: { label: string; changes: Change[] };
}

export const HEALTH_LABEL: Record<HealthKind, string> = {
  'missing-file': 'Missing picture or video',
  'missing-font': 'Missing font',
  'off-screen': 'Off the screen',
  'cut-off': 'Cut off at the edge',
  'hard-to-read': 'Hard to read',
};

/** Properties that name a picture, video or sound file. */
const FILE_PROPS = new Set(['path', 'default', 'filledPath', 'unfilledPath', 'selectorImagePath', 'scrollSound', 'backgroundImage', 'gameImage', 'folderImage']);

/** Values that aren't one file: bindings like {game:image}, {random}, expressions, built-in resources. */
const notAFile = (v: string) => !v.trim() || /\{[^}]*[:}]|\(|"/.test(v.replace(/\$\{[^}]*\}/g, '')) || v.trim().startsWith(':/') || /\$[a-z]/i.test(v.replace(/\$\{/g, ''));

/** Built-in variables that differ per console, game or language: a file named with them may be there for some only. */
const PER_CONSOLE = /\$\{(system|game|lang|region|screen|global)\./i;

/** Whether a value, or a variable it uses (up to a few deep), changes per console or game. */
function perConsole(raw: string, res: Resolution, depth = 0): boolean {
  if (PER_CONSOLE.test(raw)) return true;
  if (depth > 3) return false;
  for (const [, name] of raw.matchAll(/\$\{([^}]+)\}/g)) {
    const v = res.vars.get(name);
    if (v && perConsole(v.raw, res, depth + 1)) return true;
  }
  return false;
}

const shown = (el: ResolvedElement) => {
  const v = el.props.get('visible')?.value.trim().toLowerCase();
  const o = parseFloat(el.props.get('opacity')?.value ?? '1');
  return v !== 'false' && v !== '0' && !(o <= 0);
};

const r3 = (n: number) => String(Math.round(n * 1000) / 1000);

/** Every check, across every screen of the resolved theme. */
export function checkTheme(project: ThemeProject, res: Resolution, env: Environment): HealthIssue[] {
  // One issue per definition in the files, however many screens use it.
  const issues = new Map<object, HealthIssue>();
  const add = (key: object, view: string, make: () => HealthIssue) => {
    const had = issues.get(key);
    if (had) {
      if (!had.views.includes(view)) had.views.push(view);
    } else issues.set(key, make());
  };
  // Theme files by name, to repoint a path that has a typo in its folder.
  const byName = new Map<string, string[]>();
  for (const a of project.assets) {
    const n = basename(a.rel).toLowerCase();
    byName.set(n, [...(byName.get(n) ?? []), join(project.dir, a.rel)]);
  }
  const exists = (d: PropDef) => {
    if (notAFile(d.raw) || notAFile(d.value) || perConsole(d.raw, res) || /^https?:\/\//i.test(d.value.trim())) return true;
    // resolveAsset is lenient (it also tries the folder a variable comes from): fewer false alarms.
    return !!resolveAsset(d, res, project, env);
  };

  for (const [view, v] of res.views) {
    for (const el of v.elements.values()) {
      // Parts of a grid tile or carousel item (gridtile.favorite) fall back to RetroBat's own.
      if (!shown(el) || el.name.includes('.')) continue;
      // Missing files. RetroBat uses the first file it finds among a definition's <path>s.
      for (const [prop, h] of el.history) {
        const isFont = prop === 'fontPath';
        if (!isFont && !FILE_PROPS.has(prop)) continue;
        const last = h[h.length - 1];
        const group = h.filter((d) => d.node.parent === last.node.parent);
        if (group.some(exists)) continue;
        const raw = last.value.trim();
        add(last.node, view, () => {
          const same = byName.get(basename(raw).toLowerCase()) ?? [];
          // A fix only edits the definition itself, never a ${variable} other places share.
          const own = !last.raw.includes('${');
          let fix: HealthIssue['fix'];
          if (own && same.length === 1) {
            fix = { label: 'Use the copy in the theme', changes: [setTextChange(last.file, last.node, relative(dirname(last.file.abs), same[0]))] };
          } else if (own && isFont) {
            fix = { label: 'Use the standard font', changes: [{ file: last.file, patch: patchRemoveNode(last.file.doc, last.node) }] };
          }
          return {
            kind: isFont ? 'missing-font' : 'missing-file',
            key: `missing|${last.file.rel}|${raw}`,
            text: `${isFont ? 'Font' : 'File'} “${basename(raw) || raw}” can't be found${same.length === 1 ? ', but the theme has a file with that name in another folder' : ''}.`,
            views: [view],
            element: el.name,
            fix,
          };
        });
      }

      // Off the screen, for parts the theme adds. Theme makers hide RetroBat's built-in parts by
      // moving them off it, and parts that animate in may start off it.
      if (!el.extra || el.extra === 'false') continue;
      const posDef = el.props.get('pos');
      const pos = parsePair(posDef?.value);
      if (!posDef || !pos || el.complex.some((c) => c.name === 'storyboard')) continue;
      const size = parsePair(el.props.get('size')?.value) ?? [0, 0];
      const origin = parsePair(el.props.get('origin')?.value) ?? [0, 0];
      const [w, h] = [Math.max(0, size[0]), Math.max(0, size[1])];
      const x0 = pos[0] - origin[0] * w;
      const y0 = pos[1] - origin[1] * h;
      const eps = 0.001;
      const off = w && h ? x0 + w <= eps || x0 >= 1 - eps || y0 + h <= eps || y0 >= 1 - eps : pos[0] < -eps || pos[0] > 1 + eps || pos[1] < -eps || pos[1] > 1 + eps;
      const isText = el.type === 'text' || el.type === 'datetime';
      const cut = !off && isText && w > 0 && w <= 1 && (x0 < -0.01 || x0 + w > 1.01);
      if (!off && !cut) continue;
      add(posDef.node, view, () => {
        const nx0 = w <= 1 ? Math.min(Math.max(x0, 0), 1 - w) : x0;
        const ny0 = h <= 1 ? Math.min(Math.max(y0, 0), 1 - h) : y0;
        const to = `${r3(nx0 + origin[0] * w)} ${r3(ny0 + origin[1] * h)}`;
        return {
          kind: off ? 'off-screen' : 'cut-off',
          key: `pos|${posDef.file.rel}|${el.name}`,
          text: off ? 'It is placed outside the screen, so nobody sees it.' : 'The text runs past the edge of the screen.',
          views: [view],
          element: el.name,
          fix: posDef.raw.includes('${') ? undefined : { label: 'Move it onto the screen', changes: [setTextChange(posDef.file, posDef.node, to)] },
        };
      });
    }
  }
  return [...issues.values()];
}
