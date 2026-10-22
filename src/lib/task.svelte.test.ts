import { describe, expect, it } from 'vitest';
import { task } from './task.svelte';
import { QuipBag, STEP_QUIPS } from './quips';

describe('task steps', () => {
  it('ticks off earlier steps, skips ones that never ran, and counts progress', () => {
    task.start('Building', [
      ['a', 'A'],
      ['b', 'B'],
      ['c', 'C'],
      ['d', 'D'],
    ]);
    expect(task.progress).toBe(0);
    task.step('a');
    expect(task.running?.id).toBe('a');
    task.step('c');
    expect(task.current!.steps.map((s) => s.state)).toEqual(['done', 'skipped', 'running', 'waiting']);
    // a done, c half way, of the three that ran or will run.
    expect(task.progress).toBeCloseTo(1.5 / 3);
    task.step('nope');
    expect(task.running?.id).toBe('c');
    task.finish();
    expect(task.progress).toBe(1);
    expect(task.current!.steps.map((s) => s.state)).toEqual(['done', 'skipped', 'done', 'skipped']);
    task.close();
    expect(task.current).toBeNull();
  });

  it('marks the running step failed and ignores later steps', () => {
    task.start('Building', [
      ['a', 'A'],
      ['b', 'B'],
    ]);
    task.step('a');
    task.fail(new Error('Disk full'));
    task.step('b');
    expect(task.current!.error).toBe('Disk full');
    expect(task.current!.steps.map((s) => s.state)).toEqual(['failed', 'waiting']);
    task.close();
  });

  it('does nothing without a task', () => {
    task.close();
    task.step('a');
    task.finish();
    expect(task.current).toBeNull();
  });
});

describe('quips', () => {
  it('gives the step lines first, then general ones without repeats', () => {
    const bag = new QuipBag();
    const first = STEP_QUIPS.fonts.map(() => bag.next('fonts'));
    expect(new Set(first)).toEqual(new Set(STEP_QUIPS.fonts));
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const q = bag.next('fonts');
      expect(seen.has(q)).toBe(false);
      seen.add(q);
    }
  });
});
