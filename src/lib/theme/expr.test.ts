import { describe, expect, it } from 'vitest';
import { evalCondition, evaluate, renderText, type ExprEnv } from './expr';

const env: ExprEnv = {
  binding: (n) => ({ 'screen.ratio': '16/9', 'screen.height': 1080, 'system:manufacturer': 'Nintendo', 'system:releaseYear': '1990', 'game:image': '' } as Record<string, string | number>)[n],
  exists: (p) => p === 'yes.png',
};

describe('expressions', () => {
  it('compares bindings and strings', () => {
    expect(evaluate("{screen.ratio} == '4/3'", env)).toBe(false);
    expect(evaluate("{screen.ratio} == '16/9' && {screen.height} >= 900", env)).toBe(true);
    expect(evaluate("!({screen.height} < 900) || false", env)).toBe(true);
    expect(evaluate("'Nintendo' == 'nintendo'", env)).toBe(true);
  });

  it('calls functions', () => {
    expect(evaluate("exists({game:image}) || exists('yes.png')", env)).toBe(true);
    expect(evaluate("firstfile('no.png', 'yes.png')", env)).toBe('yes.png');
  });

  it('flags what it cannot decide', () => {
    expect(evalCondition('{weird:thing} == 1', env)).toEqual({ pass: true, unknown: true });
    expect(evalCondition("{screen.ratio} == '4/3'", env)).toEqual({ pass: false, unknown: false });
  });

  it('renders text expressions', () => {
    expect(renderText('{system:manufacturer} + "  ·  " + {system:releaseYear}', env)).toBe('Nintendo  ·  1990');
    expect(renderText('Plain text', env)).toBe('Plain text');
    expect(renderText('Made by {system:manufacturer}', env)).toBe('Made by Nintendo');
  });
});
