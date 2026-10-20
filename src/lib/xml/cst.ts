// Lossless, lenient XML parser for EmulationStation theme files.
// Every node records its source offsets so the original text can be edited in place:
// untouched bytes (comments, whitespace, attribute order, line endings) are never rewritten.

interface Base {
  start: number;
  end: number;
  parent: XElement | null;
}

export interface XText extends Base {
  kind: 'text';
}

export interface XComment extends Base {
  kind: 'comment';
}

export interface XOther extends Base {
  kind: 'pi' | 'doctype' | 'cdata';
}

export interface XAttr {
  name: string;
  value: string;
  /** Offset of the attribute name. */
  start: number;
  /** Offset just after the closing quote (or the unquoted value). */
  end: number;
  /** Raw value span, excluding quotes. */
  valueStart: number;
  valueEnd: number;
  quote: '"' | "'" | '';
}

export interface XElement extends Base {
  kind: 'element';
  name: string;
  attrs: XAttr[];
  children: XNode[];
  /** Offset just after the start tag's `>`. */
  openEnd: number;
  /** Offset of the closing tag's `</`, or `end` when self-closing / unclosed. */
  closeStart: number;
  selfClosing: boolean;
}

export type XNode = XElement | XText | XComment | XOther;

export interface XDoc {
  src: string;
  children: XNode[];
  root: XElement | null;
}

export interface Patch {
  start: number;
  end: number;
  text: string;
}

const NAME_RE = /[A-Za-z_:][-\w:.]*/y;
const ATTR_NAME_RE = /[^\s=/>"']+/y;
const UNQUOTED_RE = /[^\s>]+/y;
const WS_RE = /\s*/y;

function matchAt(re: RegExp, src: string, pos: number): string | null {
  re.lastIndex = pos;
  const m = re.exec(src);
  return m ? m[0] : null;
}

export function parse(src: string): XDoc {
  const len = src.length;
  const doc: XDoc = { src, children: [], root: null };
  const stack: XElement[] = [];

  const add = (n: XNode) => {
    const p = stack.length ? stack[stack.length - 1] : null;
    n.parent = p;
    (p ? p.children : doc.children).push(n);
  };
  const addSimple = (kind: XNode['kind'], start: number, end: number) =>
    add({ kind, start, end, parent: null } as XNode);
  const until = (needle: string, from: number) => {
    const k = src.indexOf(needle, from);
    return k < 0 ? len : k + needle.length;
  };

  let i = 0;
  while (i < len) {
    const lt = src.indexOf('<', i);
    if (lt < 0) {
      addSimple('text', i, len);
      break;
    }
    if (lt > i) addSimple('text', i, lt);

    if (src.startsWith('<!--', lt)) {
      i = until('-->', lt + 4);
      addSimple('comment', lt, i);
      continue;
    }
    if (src.startsWith('<![CDATA[', lt)) {
      i = until(']]>', lt + 9);
      addSimple('cdata', lt, i);
      continue;
    }
    if (src.startsWith('<?', lt)) {
      i = until('?>', lt + 2);
      addSimple('pi', lt, i);
      continue;
    }
    if (src.startsWith('<!', lt)) {
      i = until('>', lt + 2);
      addSimple('doctype', lt, i);
      continue;
    }

    if (src[lt + 1] === '/') {
      const gt = src.indexOf('>', lt);
      const end = gt < 0 ? len : gt + 1;
      const name = src.slice(lt + 2, gt < 0 ? len : gt).trim();
      let idx = -1;
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].name === name) {
          idx = s;
          break;
        }
      }
      if (idx < 0) {
        // Stray closing tag: keep it as text so the bytes survive.
        addSimple('text', lt, end);
      } else {
        for (let s = stack.length - 1; s > idx; s--) {
          stack[s].closeStart = lt;
          stack[s].end = lt;
        }
        stack[idx].closeStart = lt;
        stack[idx].end = end;
        stack.length = idx;
      }
      i = end;
      continue;
    }

    const name = matchAt(NAME_RE, src, lt + 1);
    if (!name) {
      addSimple('text', lt, lt + 1);
      i = lt + 1;
      continue;
    }

    const el: XElement = {
      kind: 'element',
      name,
      attrs: [],
      children: [],
      start: lt,
      end: len,
      openEnd: len,
      closeStart: len,
      selfClosing: false,
      parent: null,
    };
    let j = lt + 1 + name.length;
    while (j < len) {
      j += matchAt(WS_RE, src, j)!.length;
      if (src[j] === '>') {
        el.openEnd = j + 1;
        break;
      }
      if (src.startsWith('/>', j)) {
        el.openEnd = j + 2;
        el.selfClosing = true;
        break;
      }
      const an = matchAt(ATTR_NAME_RE, src, j);
      if (!an) {
        j++;
        continue;
      }
      const attrStart = j;
      j += an.length;
      const afterName = j;
      j += matchAt(WS_RE, src, j)!.length;
      if (src[j] !== '=') {
        el.attrs.push({ name: an, value: '', start: attrStart, end: afterName, valueStart: afterName, valueEnd: afterName, quote: '' });
        j = afterName;
        continue;
      }
      j++;
      j += matchAt(WS_RE, src, j)!.length;
      const q = src[j];
      if (q === '"' || q === "'") {
        const k = src.indexOf(q, j + 1);
        const vEnd = k < 0 ? len : k;
        el.attrs.push({ name: an, value: decode(src.slice(j + 1, vEnd)), start: attrStart, end: Math.min(len, vEnd + 1), valueStart: j + 1, valueEnd: vEnd, quote: q });
        j = Math.min(len, vEnd + 1);
      } else {
        const raw = matchAt(UNQUOTED_RE, src, j) ?? '';
        el.attrs.push({ name: an, value: decode(raw), start: attrStart, end: j + raw.length, valueStart: j, valueEnd: j + raw.length, quote: '' });
        j += raw.length;
      }
    }
    if (j >= len) el.openEnd = len;
    add(el);
    if (el.selfClosing) {
      el.closeStart = el.end = el.openEnd;
    } else {
      el.end = el.closeStart = el.openEnd;
      stack.push(el);
    }
    i = el.openEnd;
  }
  // Unclosed elements run to the end of the file.
  for (const el of stack) el.closeStart = el.end = len;

  doc.root = (doc.children.find((n) => n.kind === 'element') as XElement) ?? null;
  return doc;
}

/** Rebuilds the text from the tree. Equal to `doc.src` when every byte is covered by a node. */
export function print(doc: XDoc): string {
  const out: string[] = [];
  const walk = (n: XNode) => {
    if (n.kind !== 'element') {
      out.push(doc.src.slice(n.start, n.end));
      return;
    }
    out.push(doc.src.slice(n.start, n.openEnd));
    n.children.forEach(walk);
    out.push(doc.src.slice(n.closeStart, n.end));
  };
  doc.children.forEach(walk);
  return out.join('');
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

export function decode(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(s: string, quote: string = '"'): string {
  let r = s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  r = quote === "'" ? r.replace(/'/g, '&apos;') : r.replace(/"/g, '&quot;');
  return r;
}

export function elements(el: XElement | XDoc): XElement[] {
  return el.children.filter((n): n is XElement => n.kind === 'element');
}

export function attr(el: XElement, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

/** Decoded text content of an element's direct text and CDATA children. */
export function textOf(doc: XDoc, el: XElement): string {
  let s = '';
  for (const c of el.children) {
    if (c.kind === 'text') s += decode(doc.src.slice(c.start, c.end));
    else if (c.kind === 'cdata') s += doc.src.slice(c.start + 9, Math.max(c.start + 9, c.end - 3));
  }
  return s;
}

export function hasElementChildren(el: XElement): boolean {
  return el.children.some((c) => c.kind === 'element');
}

export function detectEol(src: string): string {
  return src.includes('\r\n') ? '\r\n' : '\n';
}

export function detectIndentUnit(src: string): string {
  const m = src.match(/\n(\t+|  +)</);
  if (!m) return '  ';
  if (m[1][0] === '\t') return '\t';
  // Smallest space indent seen is the unit.
  let min = Infinity;
  for (const mm of src.matchAll(/\n( +)</g)) min = Math.min(min, mm[1].length);
  return ' '.repeat(Number.isFinite(min) && min > 0 && min <= 8 ? min : 2);
}

/** Whitespace from the start of the line to `pos`, or '' if other text precedes it. */
export function lineIndent(src: string, pos: number): string {
  const ls = src.lastIndexOf('\n', pos - 1) + 1;
  const s = src.slice(ls, pos);
  return /^[ \t]*$/.test(s) ? s : '';
}

export function lineOf(src: string, pos: number): number {
  let n = 1;
  for (let k = src.indexOf('\n'); k >= 0 && k < pos; k = src.indexOf('\n', k + 1)) n++;
  return n;
}

export function applyPatch(src: string, p: Patch): string {
  return src.slice(0, p.start) + p.text + src.slice(p.end);
}

/** Sets an element's text, keeping surrounding whitespace and any comments inside it. */
export function patchSetText(doc: XDoc, el: XElement, value: string): Patch {
  const src = doc.src;
  const esc = escapeText(value);
  if (el.selfClosing) {
    const tag = src.slice(el.start, el.openEnd).replace(/\s*\/>$/, '>');
    return { start: el.start, end: el.end, text: `${tag}${esc}</${el.name}>` };
  }
  const textKids = el.children.filter((c) => c.kind === 'text' || c.kind === 'cdata');
  const meaningful = textKids.filter((c) => src.slice(c.start, c.end).trim() !== '');
  if (el.children.every((c) => c.kind === 'text') || meaningful.length === 0) {
    const inner = src.slice(el.openEnd, el.closeStart);
    if (el.children.some((c) => c.kind !== 'text')) {
      // Only comments/elements inside: put the text right after the start tag.
      return { start: el.openEnd, end: el.openEnd, text: esc };
    }
    const lead = inner.match(/^\s*/)![0];
    const trail = inner.length > lead.length ? inner.match(/\s*$/)![0] : '';
    return { start: el.openEnd + lead.length, end: el.closeStart - trail.length, text: esc };
  }
  const first = meaningful[0];
  const raw = src.slice(first.start, first.end);
  if (first.kind === 'cdata') return { start: first.start, end: first.end, text: esc };
  const lead = raw.match(/^\s*/)![0];
  const trail = raw.match(/\s*$/)![0];
  return { start: first.start + lead.length, end: first.end - trail.length, text: esc };
}

export function patchSetAttr(doc: XDoc, el: XElement, name: string, value: string): Patch {
  const a = el.attrs.find((x) => x.name === name);
  if (a) {
    if (a.quote) return { start: a.valueStart, end: a.valueEnd, text: escapeAttr(value, a.quote) };
    return { start: a.valueStart, end: a.valueEnd, text: `"${escapeAttr(value)}"` };
  }
  const last = el.attrs[el.attrs.length - 1];
  const pos = last ? last.end : el.start + 1 + el.name.length;
  const q = last?.quote === "'" ? "'" : '"';
  return { start: pos, end: pos, text: ` ${name}=${q}${escapeAttr(value, q)}${q}` };
}

export function patchRemoveAttr(doc: XDoc, el: XElement, name: string): Patch | null {
  const a = el.attrs.find((x) => x.name === name);
  if (!a) return null;
  let s = a.start;
  while (s > 0 && /[ \t]/.test(doc.src[s - 1])) s--;
  return { start: s, end: a.end, text: '' };
}

/**
 * Inserts child markup into `parent`. `xml` may span lines, using two spaces per nesting level;
 * indentation is converted to the file's own unit and line endings to the file's own EOL.
 */
export function patchInsertChild(doc: XDoc, parent: XElement, xml: string, opts: { first?: boolean } = {}): Patch {
  const src = doc.src;
  const eol = detectEol(src);
  const unit = detectIndentUnit(src);
  const parentIndent = lineIndent(src, parent.start);
  const kids = elements(parent);
  const anchor = opts.first ? kids[0] : kids[kids.length - 1];
  const childIndent = anchor ? lineIndent(src, anchor.start) || parentIndent + unit : parentIndent + unit;
  const body = (ind: string) =>
    xml
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line, k) => {
        const m = line.match(/^((?: {2})*)(.*)$/)!;
        return (k === 0 ? '' : ind) + unit.repeat(m[1].length / 2) + m[2];
      })
      .join(eol);

  if (parent.selfClosing) {
    const tag = src.slice(parent.start, parent.openEnd).replace(/\s*\/>$/, '>');
    return { start: parent.start, end: parent.end, text: `${tag}${eol}${childIndent}${body(childIndent)}${eol}${parentIndent}</${parent.name}>` };
  }
  if (anchor && opts.first) {
    return { start: anchor.start, end: anchor.start, text: `${body(childIndent)}${eol}${childIndent}` };
  }
  if (anchor) {
    return { start: anchor.end, end: anchor.end, text: `${eol}${childIndent}${body(childIndent)}` };
  }
  const inner = src.slice(parent.openEnd, parent.closeStart);
  if (inner.trim() === '') {
    return { start: parent.openEnd, end: parent.closeStart, text: `${eol}${childIndent}${body(childIndent)}${eol}${parentIndent}` };
  }
  return { start: parent.closeStart, end: parent.closeStart, text: `${eol}${childIndent}${body(childIndent)}${eol}${parentIndent}` };
}

/** Removes a node; when it sits alone on its line(s), the whole line goes with it. */
export function patchRemoveNode(doc: XDoc, node: XNode): Patch {
  const src = doc.src;
  const ls = src.lastIndexOf('\n', node.start - 1) + 1;
  const before = src.slice(ls, node.start);
  let le = src.indexOf('\n', node.end);
  if (le < 0) le = src.length;
  else le += 1;
  const after = src.slice(node.end, le);
  if (/^[ \t]*$/.test(before) && /^[ \t]*\r?\n?$/.test(after)) {
    return { start: ls, end: le, text: '' };
  }
  return { start: node.start, end: node.end, text: '' };
}

/** Finds the element whose span encloses `pos` most tightly. */
export function elementAt(doc: XDoc, pos: number): XElement | null {
  let best: XElement | null = null;
  const walk = (nodes: XNode[]) => {
    for (const n of nodes) {
      if (n.kind === 'element' && n.start <= pos && pos < n.end) {
        best = n;
        walk(n.children);
        return;
      }
    }
  };
  walk(doc.children);
  return best;
}

/** Path of child-element indexes from the document root, stable across re-parses of unchanged structure. */
export function pathOf(el: XElement, doc: XDoc): number[] {
  const path: number[] = [];
  let cur: XElement | null = el;
  while (cur) {
    const siblings = cur.parent ? elements(cur.parent) : elements(doc);
    path.unshift(siblings.indexOf(cur));
    cur = cur.parent;
  }
  return path;
}

export function nodeAtPath(doc: XDoc, path: number[]): XElement | null {
  let list = elements(doc);
  let cur: XElement | null = null;
  for (const i of path) {
    cur = list[i] ?? null;
    if (!cur) return null;
    list = elements(cur);
  }
  return cur;
}
