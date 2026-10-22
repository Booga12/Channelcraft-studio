// A long job the whole window waits on (creating a theme, for now), shown by TaskOverlay with
// its steps and real progress. The code doing the work reports which step it's on.

export type StepState = 'waiting' | 'running' | 'done' | 'skipped' | 'failed';

export interface TaskStep {
  id: string;
  label: string;
  state: StepState;
}

export interface Task {
  title: string;
  steps: TaskStep[];
  /** Set when the job failed; the overlay shows it and a Close button. */
  error: string | null;
  /** All steps done; the overlay celebrates briefly, then goes. */
  finished: boolean;
  startedAt: number;
}

class TaskStore {
  current = $state<Task | null>(null);
  #closeTimer: ReturnType<typeof setTimeout> | undefined;

  /** Starts a job with its steps in order. Steps that turn out not to apply are skipped. */
  start(title: string, steps: [id: string, label: string][]) {
    clearTimeout(this.#closeTimer);
    this.current = { title, steps: steps.map(([id, label]) => ({ id, label, state: 'waiting' })), error: null, finished: false, startedAt: Date.now() };
  }

  /** Moves on to step `id`: steps before it count as done, or skipped if they never ran. */
  step(id: string) {
    const t = this.current;
    if (!t || t.error) return;
    const i = t.steps.findIndex((s) => s.id === id);
    if (i < 0 || t.steps[i].state === 'running') return;
    t.steps.forEach((s, j) => {
      if (j < i) s.state = s.state === 'waiting' ? 'skipped' : s.state === 'running' ? 'done' : s.state;
    });
    t.steps[i].state = 'running';
  }

  /** The step currently running, if any. */
  get running(): TaskStep | null {
    return this.current?.steps.find((s) => s.state === 'running') ?? null;
  }

  /** 0 to 1: finished steps count whole, the running one half. */
  get progress(): number {
    const t = this.current;
    if (!t) return 0;
    if (t.finished) return 1;
    const steps = t.steps.filter((s) => s.state !== 'skipped');
    if (!steps.length) return 0;
    const done = steps.filter((s) => s.state === 'done').length + (steps.some((s) => s.state === 'running') ? 0.5 : 0);
    return done / steps.length;
  }

  finish() {
    const t = this.current;
    if (!t || t.error) return;
    for (const s of t.steps) s.state = s.state === 'waiting' || s.state === 'skipped' ? 'skipped' : 'done';
    t.finished = true;
    // Long enough to see every step ticked off.
    this.#closeTimer = setTimeout(() => {
      if (this.current === t) this.current = null;
    }, 1100);
  }

  fail(error: unknown) {
    const t = this.current;
    if (!t) return;
    for (const s of t.steps) if (s.state === 'running') s.state = 'failed';
    t.error = String(error instanceof Error ? error.message : error);
  }

  close() {
    clearTimeout(this.#closeTimer);
    this.current = null;
  }
}

export const task = new TaskStore();
