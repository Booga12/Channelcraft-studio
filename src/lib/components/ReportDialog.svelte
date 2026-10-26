<script lang="ts">
  // "Report a problem": the user writes what happened and picks what to include, sees exactly
  // what will be in the report, and the app opens GitHub's issue form filled in. Nothing is sent
  // until they press Submit on GitHub.
  import { onMount } from 'svelte';
  import { getVersion } from '@tauri-apps/api/app';
  import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
  import { api } from '$lib/api';
  import { ed } from '$lib/editor.svelte';
  import { homeFrom, reportUrl, scrub, windowsName } from '$lib/problems';
  import AppDialog from './AppDialog.svelte';

  let what = $state('');
  let steps = $state('');
  let withVersion = $state(true);
  let withWindows = $state(true);
  let withLog = $state(false);
  let version = $state('');
  let windows = $state('');
  let rawLog = $state('');
  let logPath = $state('');
  let showLog = $state(false);

  onMount(async () => {
    version = await getVersion().catch(() => '');
    const ua = (navigator as Navigator & { userAgentData?: { getHighEntropyValues(h: string[]): Promise<{ platformVersion?: string }> } }).userAgentData;
    windows = windowsName((await ua?.getHighEntropyValues(['platformVersion']).catch(() => null))?.platformVersion);
    rawLog = await api.readProblemLog().catch(() => '');
    logPath = await api.problemLogPath().catch(() => '');
  });

  const log = $derived(scrub(rawLog, homeFrom(logPath)));
  const url = $derived(reportUrl({ what, steps, version: withVersion ? version : '', windows: withWindows ? windows : '', log: withLog ? log : '' }));

  async function send() {
    try {
      await openUrl(url);
      ed.notify('GitHub is open in your browser. Check the report there and press Submit new issue to send it.');
      ed.showReport = false;
    } catch (e) {
      ed.notify(`Couldn't open the browser: ${e}`, 'error');
    }
  }
</script>

<AppDialog title="Report a problem" description="Tell us what went wrong. Your browser opens GitHub with this filled in; nothing is sent until you press Submit there." onclose={() => (ed.showReport = false)} class="sm:max-w-2xl">
  <div class="form">
    <label>
      <span>What happened? <b>*</b></span>
      <textarea rows="4" bind:value={what} placeholder="What you expected, and what happened instead"></textarea>
    </label>
    <label>
      <span>How can we make it happen? <i>(if you know)</i></span>
      <textarea rows="3" bind:value={steps} placeholder={'1. Open a theme\n2. Click …'}></textarea>
    </label>

    <fieldset>
      <legend>Include</legend>
      <label class="chk"><input type="checkbox" bind:checked={withVersion} /> App version <span class="val">{version || '…'}</span></label>
      <label class="chk"><input type="checkbox" bind:checked={withWindows} /> Windows version <span class="val">{windows || '…'}</span></label>
      <label class="chk">
        <input type="checkbox" bind:checked={withLog} disabled={!rawLog} />
        Recent errors from this PC <span class="val">{rawLog ? `${rawLog.trim().split('\n').length} lines` : 'none recorded'}</span>
      </label>
      {#if rawLog}
        <div class="logbar">
          <button class="ghost small" onclick={() => (showLog = !showLog)}>{showLog ? 'Hide' : 'See'} what would be included</button>
          <button class="ghost small" onclick={() => logPath && revealItemInDir(logPath)}>Show the log file</button>
        </div>
        {#if showLog}<pre>{log}</pre>{/if}
        <p class="note">Your user name and home folder are replaced with &lt;you&gt; and ~. GitHub issues are public.</p>
      {/if}
    </fieldset>
    <p class="note">A screenshot helps a lot: once GitHub is open, paste one into the report with Ctrl+V.</p>
  </div>
  {#snippet footer()}
    <button class="secondary" onclick={() => (ed.showReport = false)}>Cancel</button>
    <button class="primary" disabled={!what.trim()} onclick={send}>Open GitHub to send it</button>
  {/snippet}
</AppDialog>

<style>
  .form {
    display: grid;
    gap: 12px;
  }
  label {
    display: grid;
    gap: 4px;
    font-size: 13px;
  }
  label b {
    color: var(--danger);
  }
  label i {
    color: var(--text-faint);
    font-style: normal;
  }
  textarea {
    width: 100%;
    resize: vertical;
  }
  fieldset {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px 12px 10px;
    display: grid;
    gap: 6px;
    margin: 0;
  }
  legend {
    font-size: 12px;
    color: var(--text-faint);
    padding: 0 4px;
  }
  .chk {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .val {
    margin-left: auto;
    color: var(--text-faint);
    font-size: 12px;
  }
  .logbar {
    display: flex;
    gap: 6px;
  }
  pre {
    max-height: 180px;
    overflow: auto;
    margin: 0;
    padding: 8px;
    font-size: 11px;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 6px;
    white-space: pre-wrap;
  }
  .note {
    margin: 0;
    font-size: 12px;
    color: var(--text-faint);
  }
</style>
