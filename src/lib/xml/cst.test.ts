import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyPatch,
  attr,
  elements,
  parse,
  patchInsertChild,
  patchRemoveAttr,
  patchRemoveNode,
  patchSetAttr,
  patchSetText,
  print,
  textOf,
  type XElement,
} from './cst';

const THEMES = 'M:\\Retrobat\\emulationstation\\.emulationstation\\themes';

function xmlFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) xmlFiles(p, out);
    else if (name.toLowerCase().endsWith('.xml')) out.push(p);
  }
  return out;
}

function read(p: string): string {
  const s = readFileSync(p, 'utf8');
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function find(el: XElement | ReturnType<typeof parse>, ...names: string[]): XElement {
  let cur = el;
  for (const n of names) {
    const next = elements(cur).find((e) => e.name === n || attr(e, 'name') === n);
    if (!next) throw new Error(`missing ${n}`);
    cur = next;
  }
  return cur as XElement;
}

describe.skipIf(!existsSync(THEMES))('round-trip installed themes (read-only)', () => {
  const files = existsSync(THEMES) ? xmlFiles(THEMES) : [];
  it(`finds theme XML files`, () => expect(files.length).toBeGreaterThan(100));
  it('prints every file back byte-for-byte', () => {
    const failures: string[] = [];
    for (const f of files) {
      const src = read(f);
      const doc = parse(src);
      if (print(doc) !== src) failures.push(f);
      if (!doc.root) failures.push(`${f} (no root)`);
    }
    expect(failures).toEqual([]);
  });
});

const SAMPLE = [
  '<!-- header comment before decl -->',
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<theme defaultView="detailed">',
  '  <formatVersion>7</formatVersion>',
  '  <view name="system, basic">',
  '    <image name="logo" extra="true" if="${a} &lt; 3">',
  '      <pos>0.5 0.5</pos>',
  '      <!-- keep me -->',
  '      <size>0.4 0</size>',
  '    </image>',
  '    <text name="t"/>',
  '  </view>',
  '</theme>',
  '',
].join('\r\n');

describe('cst basics', () => {
  it('parses structure, attributes and entities', () => {
    const doc = parse(SAMPLE);
    expect(doc.root!.name).toBe('theme');
    const img = find(doc.root!, 'system, basic', 'logo');
    expect(attr(img, 'if')).toBe('${a} < 3');
    expect(textOf(doc, find(img, 'pos'))).toBe('0.5 0.5');
    expect(print(doc)).toBe(SAMPLE);
  });

  it('tolerates unclosed and stray tags', () => {
    const src = '<theme><view name="x"><image name="a"><pos>1 1</pos></view></oops></theme>';
    const doc = parse(src);
    expect(print(doc)).toBe(src);
    expect(find(doc.root!, 'x', 'a').name).toBe('image');
  });

  it('setText changes only the value span', () => {
    const doc = parse(SAMPLE);
    const pos = find(doc.root!, 'system, basic', 'logo', 'pos');
    const out = applyPatch(SAMPLE, patchSetText(doc, pos, '0.25 0.75'));
    expect(out).toBe(SAMPLE.replace('<pos>0.5 0.5</pos>', '<pos>0.25 0.75</pos>'));
  });

  it('setText on a self-closing element opens it', () => {
    const doc = parse(SAMPLE);
    const t = find(doc.root!, 'system, basic', 't');
    const out = applyPatch(SAMPLE, patchSetText(doc, t, 'A & B'));
    expect(out).toContain('<text name="t">A &amp; B</text>');
  });

  it('setText keeps multi-line padding', () => {
    const src = '<a>\n    hello\n  </a>';
    const doc = parse(src);
    expect(applyPatch(src, patchSetText(doc, doc.root!, 'bye'))).toBe('<a>\n    bye\n  </a>');
  });

  it('sets, adds and removes attributes', () => {
    const doc = parse(SAMPLE);
    const img = find(doc.root!, 'system, basic', 'logo');
    expect(applyPatch(SAMPLE, patchSetAttr(doc, img, 'extra', 'false'))).toContain('<image name="logo" extra="false" if=');
    expect(applyPatch(SAMPLE, patchSetAttr(doc, img, 'zz', 'a"b'))).toContain('if="${a} &lt; 3" zz="a&quot;b">');
    expect(applyPatch(SAMPLE, patchRemoveAttr(doc, img, 'extra')!)).toContain('<image name="logo" if=');
  });

  it('inserts children with the file indentation and EOL', () => {
    const doc = parse(SAMPLE);
    const img = find(doc.root!, 'system, basic', 'logo');
    const out = applyPatch(SAMPLE, patchInsertChild(doc, img, '<color>FFFFFFFF</color>'));
    expect(out).toContain('<size>0.4 0</size>\r\n      <color>FFFFFFFF</color>\r\n    </image>');
    const view = find(doc.root!, 'system, basic');
    const out2 = applyPatch(SAMPLE, patchInsertChild(doc, view, '<text name="n">\n  <pos>0 0</pos>\n</text>'));
    expect(out2).toContain('<text name="t"/>\r\n    <text name="n">\r\n      <pos>0 0</pos>\r\n    </text>\r\n  </view>');
  });

  it('inserts into a self-closing element', () => {
    const doc = parse(SAMPLE);
    const t = find(doc.root!, 'system, basic', 't');
    const out = applyPatch(SAMPLE, patchInsertChild(doc, t, '<pos>0 0</pos>'));
    expect(out).toContain('<text name="t">\r\n      <pos>0 0</pos>\r\n    </text>');
  });

  it('removes a node together with its line', () => {
    const doc = parse(SAMPLE);
    const size = find(doc.root!, 'system, basic', 'logo', 'size');
    const out = applyPatch(SAMPLE, patchRemoveNode(doc, size));
    expect(out).toBe(SAMPLE.replace('      <size>0.4 0</size>\r\n', ''));
  });

  it('keeps one-line elements on one line', () => {
    const src = '<theme>\n  <view name="a">\n    <image name="i"><pos>0 0</pos></image>\n  </view>\n</theme>';
    const doc = parse(src);
    const img = find(doc.root!, 'a', 'i');
    expect(applyPatch(src, patchInsertChild(doc, img, '<size>1 1</size>'))).toContain('<image name="i"><pos>0 0</pos><size>1 1</size></image>');
  });

  it('detects tab indentation', () => {
    const src = '<theme>\n\t<view name="a">\n\t\t<image name="i"/>\n\t</view>\n</theme>';
    const doc = parse(src);
    const view = find(doc.root!, 'a');
    expect(applyPatch(src, patchInsertChild(doc, view, '<text name="x"/>'))).toContain('\t\t<image name="i"/>\n\t\t<text name="x"/>\n\t</view>');
  });
});
