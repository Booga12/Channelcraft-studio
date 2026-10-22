// Small evaluator for Batocera-EmulationStation theme expressions, used in `if="..."`,
// `<visible>`, `<text>` and `<path>` values, e.g.
//   {screen.ratio} == '4/3' && ${subset.music} != 'off'
//   {system:manufacturer} + "  ·  " + {system:releaseYear}
//   firstfile({game:boxart}, {game:image})

export type Value = string | number | boolean | null;

export class UnknownValue extends Error {}

export interface ExprEnv {
  /** Value of `{system:name}`, `{screen.ratio}` and similar bindings; undefined if unknown. */
  binding(name: string): Value | undefined;
  exists(path: string): boolean;
}

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bind'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string };

const OPS = ['==', '!=', '<=', '>=', '&&', '||', '<', '>', '!', '+', '-', '*', '/', '%', '(', ')', ',', '?', ':'];

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const j = s.indexOf(c, i + 1);
      if (j < 0) throw new UnknownValue('unterminated string');
      out.push({ t: 'str', v: s.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (c === '{') {
      const j = s.indexOf('}', i);
      if (j < 0) throw new UnknownValue('unterminated binding');
      out.push({ t: 'bind', v: s.slice(i + 1, j).trim() });
      i = j + 1;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (num) {
      out.push({ t: 'num', v: parseFloat(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_][\w.:]*/.exec(s.slice(i));
    if (id) {
      out.push({ t: 'id', v: id[0] });
      i += id[0].length;
      continue;
    }
    const op = OPS.find((o) => s.startsWith(o, i));
    if (op) {
      out.push({ t: 'op', v: op });
      i += op.length;
      continue;
    }
    if (c === '=') {
      // Tolerate a single `=` as equality.
      out.push({ t: 'op', v: '==' });
      i++;
      continue;
    }
    throw new UnknownValue(`unexpected "${c}"`);
  }
  return out;
}

const BINARY: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '>': 4,
  '<=': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};

export function truthy(v: Value): boolean {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s !== '' && s !== '0' && s !== 'false';
  }
  return !!v;
}

function num(v: Value): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = parseFloat(String(v ?? ''));
  if (Number.isNaN(n)) throw new UnknownValue(`not a number: ${v}`);
  return n;
}

function isNumeric(v: Value): boolean {
  return typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()));
}

function eq(a: Value, b: Value): boolean {
  if (isNumeric(a) && isNumeric(b)) return num(a) === num(b);
  if (typeof a === 'boolean' || typeof b === 'boolean') return truthy(a) === truthy(b);
  return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
}

class Parser {
  i = 0;
  constructor(
    private toks: Tok[],
    private env: ExprEnv,
  ) {}

  peek(): Tok | undefined {
    return this.toks[this.i];
  }

  isOp(v: string): boolean {
    const t = this.peek();
    return !!t && t.t === 'op' && t.v === v;
  }

  expect(v: string) {
    if (!this.isOp(v)) throw new UnknownValue(`expected ${v}`);
    this.i++;
  }

  parse(): Value {
    const v = this.ternary();
    if (this.i < this.toks.length) throw new UnknownValue('trailing tokens');
    return v;
  }

  ternary(): Value {
    const c = this.binary(1);
    if (this.isOp('?')) {
      this.i++;
      const a = this.ternary();
      this.expect(':');
      const b = this.ternary();
      return truthy(c) ? a : b;
    }
    return c;
  }

  binary(minPrec: number): Value {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (!t || t.t !== 'op' || !(t.v in BINARY) || BINARY[t.v] < minPrec) return left;
      this.i++;
      const right = this.binary(BINARY[t.v] + 1);
      left = this.apply(t.v, left, right);
    }
  }

  apply(op: string, a: Value, b: Value): Value {
    switch (op) {
      case '||':
        return truthy(a) || truthy(b);
      case '&&':
        return truthy(a) && truthy(b);
      case '==':
        return eq(a, b);
      case '!=':
        return !eq(a, b);
      case '<':
        return num(a) < num(b);
      case '>':
        return num(a) > num(b);
      case '<=':
        return num(a) <= num(b);
      case '>=':
        return num(a) >= num(b);
      case '+':
        return isNumeric(a) && isNumeric(b) ? num(a) + num(b) : String(a ?? '') + String(b ?? '');
      case '-':
        return num(a) - num(b);
      case '*':
        return num(a) * num(b);
      case '/':
        return num(a) / num(b);
      case '%':
        return num(a) % num(b);
    }
    throw new UnknownValue(op);
  }

  unary(): Value {
    if (this.isOp('!')) {
      this.i++;
      return !truthy(this.unary());
    }
    if (this.isOp('-')) {
      this.i++;
      return -num(this.unary());
    }
    return this.primary();
  }

  args(): Value[] {
    this.expect('(');
    const out: Value[] = [];
    if (this.isOp(')')) {
      this.i++;
      return out;
    }
    for (;;) {
      out.push(this.ternary());
      if (this.isOp(',')) {
        this.i++;
        continue;
      }
      this.expect(')');
      return out;
    }
  }

  primary(): Value {
    const t = this.toks[this.i++];
    if (!t) throw new UnknownValue('unexpected end');
    switch (t.t) {
      case 'num':
      case 'str':
        return t.v;
      case 'bind': {
        const v = this.env.binding(t.v);
        if (v === undefined) throw new UnknownValue(`unknown binding {${t.v}}`);
        return v;
      }
      case 'id': {
        const low = t.v.toLowerCase();
        if (low === 'true') return true;
        if (low === 'false') return false;
        if (low === 'null') return null;
        if (this.isOp('(')) return this.call(low, this.args());
        // Bare words such as a substituted `16/9` piece or an enum value.
        return t.v;
      }
      case 'op':
        if (t.v === '(') {
          const v = this.ternary();
          this.expect(')');
          return v;
        }
    }
    throw new UnknownValue(`unexpected ${t.v}`);
  }

  call(name: string, a: Value[]): Value {
    const s = (k: number) => String(a[k] ?? '');
    switch (name) {
      case 'exists':
      case 'fileexists':
        return !!s(0) && this.env.exists(s(0));
      case 'firstfile': {
        for (const v of a) if (v && this.env.exists(String(v))) return String(v);
        return '';
      }
      case 'empty':
        return s(0).trim() === '';
      case 'isdefined':
        return a[0] !== null && s(0) !== '';
      case 'lower':
      case 'tolower':
        return s(0).toLowerCase();
      case 'upper':
      case 'toupper':
        return s(0).toUpperCase();
      case 'trim':
        return s(0).trim();
      case 'contains':
        return s(0).toLowerCase().includes(s(1).toLowerCase());
      case 'startswith':
        return s(0).toLowerCase().startsWith(s(1).toLowerCase());
      case 'endswith':
        return s(0).toLowerCase().endsWith(s(1).toLowerCase());
      case 'default':
      case 'coalesce':
        return a.find((v) => v !== null && String(v) !== '') ?? '';
      case 'filename':
      case 'stem':
        return s(0).replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '');
      case 'year':
        return s(0).slice(0, 4);
      case 'min':
        return Math.min(...a.map(num));
      case 'max':
        return Math.max(...a.map(num));
    }
    throw new UnknownValue(`unknown function ${name}()`);
  }
}

export function evaluate(expr: string, env: ExprEnv): Value {
  return new Parser(tokenize(expr), env).parse();
}

/** Evaluates a condition; `unknown` is true when it couldn't be decided (it then counts as passing). */
export function evalCondition(expr: string, env: ExprEnv): { pass: boolean; unknown: boolean } {
  try {
    return { pass: truthy(evaluate(expr, env)), unknown: false };
  } catch (e) {
    if (e instanceof UnknownValue) return { pass: true, unknown: true };
    throw e;
  }
}

const BINDING_RE = /\{([a-zA-Z]+[:.][\w.:]+)\}/g;

/** True for values that ES evaluates as expressions rather than plain text. */
export function looksLikeExpression(s: string): boolean {
  BINDING_RE.lastIndex = 0;
  return BINDING_RE.test(s) || /^\s*\w+\(.*\)\s*$/s.test(s);
}

/** Display value for text: evaluates expressions, else substitutes bindings inline. */
export function renderText(s: string, env: ExprEnv): string {
  if (!looksLikeExpression(s)) return s;
  try {
    const v = evaluate(s, env);
    return v === null ? '' : String(v);
  } catch {
    return s.replace(BINDING_RE, (m, name: string) => {
      const v = env.binding(name);
      return v === undefined || v === null ? m : String(v);
    });
  }
}
