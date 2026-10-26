// The theme health check in the editor: fixing, showing and ignoring what it finds, and checking
// before the theme leaves the app (Try it in RetroBat, Export).
// Part of the editor (editor.svelte.ts): each function is a method of the editor (`this`),
// attached to it there, so callers use ed.<name>(...).

import type { Editor } from '../editor.svelte';
import type { HealthIssue } from '../theme/health';
import { elementLabel } from '../friendly';

/** Applies one issue's fix as one undo step. The list re-checks by itself afterwards. */
export function fixHealth(this: Editor, issue: HealthIssue) {
  if (issue.kind === 'hard-to-read') return this.fixReadability();
  if (!issue.fix) return;
  this.commit(`fix: ${elementLabel(issue.element)}`, issue.fix.changes);
}

/** Every fix there is, together as one undo step. */
export function fixAllHealth(this: Editor) {
  const issues = this.healthIssues.filter((i) => i.fix);
  if (!issues.length) return;
  this.group(`${issues.length} fixes from the health check`, () => {
    // Each fix was worked out on the theme as it is now, so they go in as one change.
    const changes = issues.flatMap((i) => (i.kind === 'hard-to-read' ? [] : (i.fix?.changes ?? [])));
    if (changes.length) this.commit('health check fixes', changes);
    if (issues.some((i) => i.kind === 'hard-to-read')) this.fixReadability();
  });
  this.notify(`Fixed ${issues.length} thing${issues.length === 1 ? '' : 's'}. Save to keep it, or Ctrl+Z to undo.`);
}

/** Closes the check and shows the part on its screen, selected. */
export function showHealthIssue(this: Editor, issue: HealthIssue) {
  this.showHealth = false;
  this.healthThen = null;
  const view = issue.views[0];
  if (view && view !== this.view) this.showScreen({ view, file: 'theme.xml' });
  if (issue.element) this.selected = issue.element;
}

/**
 * Runs `run` straight away when the theme looks fine; otherwise opens the check first, with a
 * button to carry on anyway.
 */
export function checkFirst(this: Editor, label: string, run: () => void) {
  if (!this.healthIssues.length) return run();
  this.healthThen = { label, run };
  this.showHealth = true;
}
