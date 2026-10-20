import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ThemeProject } from './project';
import { resolveTheme } from './resolver';
import { nodeFs } from './nodefs';
import { FALLBACK_SYSTEMS } from './systems';
import { addElementChange, addPropChange, applyChanges, insertTarget, inverse, setTextChange } from './edits';
import type { Environment } from './context';

const ROOT = 'M:\\Retrobat';
const V5 = `${ROOT}\\emulationstation\\.emulationstation\\themes\\Booga's WiiTheme v5`;

const env: Environment = {
  esHome: `${ROOT}\\emulationstation\\.emulationstation`,
  resourcesDir: `${ROOT}\\emulationstation\\resources`,
  settings: { system: FALLBACK_SYSTEMS[0], subsets: {}, lang: 'en', region: 'us', ratio: '16/9', tinyScreen: false, verticalScreen: false, helpPrompts: true, cheevos: false },
};

/** Lines that differ between two texts. */
function diffLines(a: string, b: string): string[] {
  const x = a.split('\n');
  const y = b.split('\n');
  const out: string[] = [];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) out.push(`${i + 1}: ${y[i]}`);
  return out;
}

// Everything here edits the in-memory copy only; nothing is written to disk.
describe.skipIf(!existsSync(V5))('editing v5 in memory', () => {
  it('changes one value, re-resolves, and undoes back to the exact original bytes', async () => {
    const p = await ThemeProject.load(V5, nodeFs);
    const entry = p.entry!;
    const original = entry.src;
    const bar = resolveTheme(p, env).views.get('detailed')!.elements.get('bottom-bar')!;
    const pos = bar.props.get('pos')!;
    const applied = applyChanges(p, [setTextChange(pos.file, pos.node, '0 0.8')]);
    expect(diffLines(original, entry.src)).toHaveLength(1);
    expect(entry.dirty).toBe(true);
    expect(resolveTheme(p, env).views.get('detailed')!.elements.get('bottom-bar')!.props.get('pos')!.value).toBe('0 0.8');
    applyChanges(p, inverse(p, applied));
    expect(entry.src).toBe(original);
    expect(entry.dirty).toBe(false);
  });

  it('applies and undoes a multi-patch transaction in one file', async () => {
    const p = await ThemeProject.load(V5, nodeFs);
    const entry = p.entry!;
    const original = entry.src;
    const r = resolveTheme(p, env);
    const sys = r.views.get('system')!.elements.get('bottom-bar')!;
    const det = r.views.get('detailed')!.elements.get('bottom-bar')!;
    const applied = applyChanges(p, [setTextChange(entry, sys.props.get('pos')!.node, '0 0.6'), setTextChange(entry, det.props.get('size')!.node, '1 0.25000')]);
    const r2 = resolveTheme(p, env);
    expect(r2.views.get('system')!.elements.get('bottom-bar')!.props.get('pos')!.value).toBe('0 0.6');
    expect(r2.views.get('detailed')!.elements.get('bottom-bar')!.props.get('size')!.value).toBe('1 0.25000');
    const redo = applyChanges(p, inverse(p, applied));
    expect(entry.src).toBe(original);
    applyChanges(p, inverse(p, redo));
    expect(resolveTheme(p, env).views.get('system')!.elements.get('bottom-bar')!.props.get('pos')!.value).toBe('0 0.6');
  });

  it('adds a property to the definition that belongs to the element', async () => {
    const p = await ThemeProject.load(V5, nodeFs);
    const r = resolveTheme(p, env);
    const bar = r.views.get('detailed')!.elements.get('bottom-bar')!;
    const target = insertTarget(bar, 'detailed')!;
    expect(target.node.parent?.attrs.find((a) => a.name === 'name')?.value).toBe('detailed');
    const before = target.file.src;
    const [a] = applyChanges(p, [addPropChange(target, 'rotation', '5')]);
    // Exactly one insertion, everything else untouched.
    const after = target.file.src;
    expect(after.slice(0, a.start) + after.slice(a.end)).toBe(before);
    // v5 writes this definition on one line; it stays on one line.
    expect(a.newText).toBe('<rotation>5</rotation>');
    expect(resolveTheme(p, env).views.get('detailed')!.elements.get('bottom-bar')!.props.get('rotation')!.value).toBe('5');
  });

  it('adds a new element to the view', async () => {
    const p = await ThemeProject.load(V5, nodeFs);
    const r = resolveTheme(p, env);
    applyChanges(p, [addElementChange(p, r, 'detailed', 'text', 'label', '<pos>0.1 0.1</pos>\n<text>Hi</text>')]);
    const el = resolveTheme(p, env).views.get('detailed')!.elements.get('label')!;
    expect(el.type).toBe('text');
    expect(el.props.get('text')!.value).toBe('Hi');
    expect(el.extra).toBe('true');
  });
});
