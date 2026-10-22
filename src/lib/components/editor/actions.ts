// Editor actions that ask before throwing away unsaved work, shared by the menu and the top bar.
import { ask } from '@tauri-apps/plugin-dialog';
import { ed } from '$lib/editor.svelte';

export async function closeTheme() {
  if (ed.dirtyCount > 0) {
    const leave = await ask(`Close ${ed.project?.name} without saving your changes?`, {
      title: 'Unsaved changes',
      kind: 'warning',
      okLabel: 'Close without saving',
      cancelLabel: 'Keep editing',
    });
    if (!leave) return;
  }
  ed.closeTheme();
}

export async function launchRetroBat() {
  if (ed.dirtyCount > 0) {
    const go = await ask('You have unsaved changes, which RetroBat will not show. Launch anyway?', { title: 'Launch RetroBat', kind: 'warning', okLabel: 'Launch', cancelLabel: 'Cancel' });
    if (!go) return;
  }
  ed.launch();
}

export async function reloadFromDisk() {
  if (ed.dirtyCount) {
    const ok = await ask(`Read the theme from disk again? Your unsaved changes in ${ed.dirtyCount} file(s) will be lost.`, {
      title: 'Reload from disk',
      kind: 'warning',
      okLabel: 'Reload',
      cancelLabel: 'Keep editing',
    });
    if (!ok) return;
  }
  await ed.reloadFromDisk();
}

export const isActiveTheme = () => !!ed.project && ed.root?.activeTheme?.toLowerCase() === ed.project.name.toLowerCase();
