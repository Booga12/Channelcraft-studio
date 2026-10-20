<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { ask } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import StartScreen from '$lib/components/StartScreen.svelte';
  import EditorView from '$lib/components/EditorView.svelte';
  import Toast from '$lib/components/Toast.svelte';

  onMount(() => {
    if (import.meta.env.DEV && !('__TAURI_INTERNALS__' in window)) {
      // Running in a plain browser during development: use the read-only bridge.
      import('$lib/devmock').then((m) => {
        m.installBrowserMock();
        ed.init();
      });
      return;
    }
    ed.init();
    const win = getCurrentWindow();
    const unlisten = win.onCloseRequested(async (event) => {
      if (ed.dirtyCount === 0) return;
      const leave = await ask(`You have unsaved changes in ${ed.dirtyCount} file(s). Close without saving?`, {
        title: 'Unsaved changes',
        kind: 'warning',
        okLabel: 'Close without saving',
        cancelLabel: 'Keep editing',
      });
      if (!leave) event.preventDefault();
    });
    return () => {
      unlisten.then((f) => f());
    };
  });

  $effect(() => {
    const name = ed.project?.name;
    const dirty = ed.dirtyCount > 0 ? ' •' : '';
    const title = name ? `${name}${dirty} — ChannelCraft Studio` : 'ChannelCraft Studio';
    document.title = title;
    if ('__TAURI_INTERNALS__' in window) getCurrentWindow().setTitle(title).catch(() => {});
  });
</script>

{#if ed.project}
  <EditorView />
{:else}
  <StartScreen />
{/if}
<Toast />
