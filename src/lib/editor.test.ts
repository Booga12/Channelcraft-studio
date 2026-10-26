import { describe, expect, it } from 'vitest';
import * as look from './editor/look';
import * as parts from './editor/parts';
import * as gameLook from './editor/gameLook';
import * as assets from './editor/assets';
import * as saving from './editor/saving';
import * as restyle from './editor/restyle';
import * as themeOptions from './editor/themeOptions';

describe('the editor', () => {
  it('has every method kept in its own files', async () => {
    const { ed } = await import('./editor.svelte');
    for (const mod of [look, parts, gameLook, assets, saving, restyle, themeOptions]) {
      for (const name of Object.keys(mod)) expect(typeof (ed as unknown as Record<string, unknown>)[name], name).toBe('function');
    }
  });
});
