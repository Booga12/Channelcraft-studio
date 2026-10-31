<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { ask } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import StartScreen from '$lib/components/StartScreen.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import TaskOverlay from '$lib/components/TaskOverlay.svelte';
  import UpdateBanner from '$lib/components/UpdateBanner.svelte';
  import SettingsDialog from '$lib/components/SettingsDialog.svelte';
  import { installErrorLog } from '$lib/problems';
  import { prefs } from '$lib/prefs.svelte';
  import { api } from '$lib/api';
  // The editor and the dialogs opened now and then are loaded the first time they are needed, so
  // the start screen comes up without waiting for them.

  onMount(() => {
    prefs.applyLook();
    ed.startAutosave();
    if (import.meta.env.DEV && !('__TAURI_INTERNALS__' in window)) {
      // Running in a plain browser during development: use the read-only bridge.
      import('$lib/devmock').then((m) => {
        m.installBrowserMock();
        ed.init();
      });
      return;
    }
    // Errors in the pages go to the problem log on this PC ("Report a problem" can include it).
    installErrorLog(api.logProblem);
    ed.init();
    const win = getCurrentWindow();
    const unlisten = win.onCloseRequested(async (event) => {
      if (ed.busy) {
        // Never close in the middle of a save, backup or restore.
        event.preventDefault();
        ed.notify('ChannelCraft is still saving. Close it again in a moment.', 'error');
        return;
      }
      if (ed.dirtyCount === 0) return;
      const leave = await ask(`You have unsaved changes in ${ed.dirtyCount} file(s). Close without saving?`, {
        title: 'Unsaved changes',
        kind: 'warning',
        okLabel: 'Close without saving',
        cancelLabel: 'Keep editing',
      });
      if (!leave) event.preventDefault();
      // Closing without saving on purpose: don't offer these changes back next time.
      else if (ed.project) await api.clearRecovery(ed.recoveryKey(ed.project.dir)).catch(() => {});
    });
    // Coming back to the window: notice files another program changed.
    const unfocus = win.onFocusChanged(({ payload: focused }) => {
      if (focused) ed.checkExternalChanges();
    });
    return () => {
      unlisten.then((f) => f());
      unfocus.then((f) => f());
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
  {#await import('$lib/components/EditorView.svelte') then m}<m.default />{/await}
{:else}
  <StartScreen />
{/if}
{#if ed.showTour && ed.project}
  {#await import('$lib/components/Tour.svelte') then m}<m.default />{/await}
{/if}
{#if ed.showGuide}
  {#await import('$lib/components/Guide.svelte') then m}<m.default />{/await}
{/if}
{#if ed.showSettings}
  <SettingsDialog />
{/if}
{#if ed.showShortcuts}
  {#await import('$lib/components/ShortcutsDialog.svelte') then m}<m.default />{/await}
{/if}
{#if ed.showReport}
  {#await import('$lib/components/ReportDialog.svelte') then m}<m.default />{/await}
{/if}
{#if ed.showMenuOptions && ed.project}
  {#await import('$lib/components/MenuOptionsDialog.svelte') then m}<m.default />{/await}
{/if}
{#if ed.showHealth && ed.project}
  {#await import('$lib/components/HealthDialog.svelte') then m}<m.default />{/await}
{/if}
{#if ed.showSaveDesign && ed.project}
  {#await import('$lib/components/SaveDesignDialog.svelte') then m}<m.default />{/await}
{/if}
{#if ed.showPublish && ed.project}
  {#await import('$lib/components/PublishDialog.svelte') then m}<m.default />{/await}
{/if}
{#if ed.showMediaCheck && ed.project}
  {#await import('$lib/components/MediaCheckDialog.svelte') then m}<m.default />{/await}
{/if}
{#if ed.showFeatured && ed.project}
  {#await import('$lib/components/FeaturedDialog.svelte') then m}<m.default />{/await}
{/if}
{#if ed.showRestore && ed.project}
  {#await import('$lib/components/RestoreDialog.svelte') then m}<m.default />{/await}
{/if}
{#if ed.project}
  {#await import('$lib/components/SearchPalette.svelte') then m}<m.default />{/await}
{/if}
<Toast />
<TaskOverlay />
<UpdateBanner />
