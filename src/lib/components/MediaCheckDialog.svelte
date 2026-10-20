<script lang="ts">
  // Checks every console's scraped games for missing or broken media. Read only.
  import { save as saveDialog } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import { api } from '$lib/api';
  import { dirname } from '$lib/path';
  import { ISSUE_LABEL, issuesCsv, MAX_ISSUES, scanGamelist, type Issue, type IssueKind } from '$lib/theme/mediaHealth';

  const systems = ed.systems.filter((s) => ed.gameSystems.includes(s.name));
  let issues = $state.raw<Issue[]>([]);
  let games = $state(0);
  let done = $state(0);
  let running = $state(false);
  let cancelled = $state(false);
  let finished = $state(false);
  let truncated = $state(false);
  let error = $state('');
  let kind = $state<IssueKind | ''>('');
  let system = $state('');

  async function run() {
    running = true;
    cancelled = false;
    finished = false;
    truncated = false;
    error = '';
    issues = [];
    games = 0;
    done = 0;
    const found: Issue[] = [];
    for (const s of systems) {
      if (cancelled) break;
      try {
        const f = await api.readGamelist(s.name, s.path);
        if (f) {
          const scan = scanGamelist(f.text, dirname(f.path), s.fullName);
          games += scan.games;
          const exist = new Set<string>();
          for (let i = 0; i < scan.files.length; i += 2000) {
            const chunk = scan.files.slice(i, i + 2000);
            const ok = await api.existingFiles(chunk);
            chunk.forEach((p, j) => ok[j] && exist.add(p));
          }
          found.push(...scan.issues((p) => exist.has(p)));
          if (found.length > MAX_ISSUES) {
            truncated = true;
            found.length = MAX_ISSUES;
            issues = [...found];
            break;
          }
          issues = [...found];
        }
      } catch (e) {
        error = `${s.fullName}: ${e}`;
      }
      done++;
    }
    running = false;
    finished = !cancelled;
  }

  const counts = $derived.by(() => {
    const c: Partial<Record<IssueKind, number>> = {};
    for (const i of issues) c[i.kind] = (c[i.kind] ?? 0) + 1;
    return c;
  });
  const shown = $derived(issues.filter((i) => (!kind || i.kind === kind) && (!system || i.system === system)));

  async function exportCsv() {
    const dest = await saveDialog({ title: 'Save media report', defaultPath: 'RetroBat media report.csv', filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }] });
    if (!dest) return;
    try {
      await api.writeReport(dest.toLowerCase().endsWith('.csv') ? dest : `${dest}.csv`, issuesCsv(shown));
      ed.notify(`Report saved: ${dest}`);
    } catch (e) {
      ed.notify(String(e), 'error');
    }
  }

  function close() {
    cancelled = true;
    ed.showMediaCheck = false;
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && close()}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Check game media">
    <header>
      <h2>Check game media</h2>
      <p class="dim">
        Looks through the scraped games of your {systems.length} consoles for missing videos and covers, files that can't be found, games listed twice and missing descriptions. It only reads: nothing in your games or gamelists is changed. Use RetroBat's scraper to fill the gaps.
      </p>
      <div class="bar-row">
        {#if running}
          <div class="progress"><div style:width="{(done / Math.max(1, systems.length)) * 100}%"></div></div>
          <span class="faint">{done} of {systems.length} consoles · {games} games</span>
          <button class="small secondary" onclick={() => (cancelled = true)}>Stop</button>
        {:else}
          <button onclick={run} disabled={!systems.length}>{finished || issues.length ? 'Check again' : 'Start check'}</button>
          {#if finished}<span class="faint">Checked {games} games on {systems.length} consoles.</span>{:else if cancelled}<span class="faint">Stopped after {done} consoles.</span>{/if}
        {/if}
      </div>
    </header>
    <div class="body">
      {#if issues.length}
        <div class="chips">
          <button class="chip" class:on={!kind} onclick={() => (kind = '')}>All <b>{issues.length}</b></button>
          {#each Object.entries(ISSUE_LABEL) as [k, label]}
            {#if counts[k as IssueKind]}
              <button class="chip" class:on={kind === k} onclick={() => (kind = k as IssueKind)}>{label} <b>{counts[k as IssueKind]}</b></button>
            {/if}
          {/each}
          <select bind:value={system} aria-label="Console">
            <option value="">All consoles</option>
            {#each [...new Set(issues.map((i) => i.system))] as s}<option value={s}>{s}</option>{/each}
          </select>
        </div>
        {#if truncated}<p class="warn">Showing the first {MAX_ISSUES.toLocaleString()} findings only.</p>{/if}
        <div class="table">
          {#each shown.slice(0, 400) as i}
            <div class="tr">
              <span class="sys">{i.system}</span>
              <span class="game" title={i.game}>{i.game}</span>
              <span class="what">{ISSUE_LABEL[i.kind]}{i.detail ? ` (${i.detail})` : ''}</span>
              <span class="path mono" title={i.path}>{i.path}</span>
            </div>
          {/each}
          {#if shown.length > 400}<p class="faint">…and {shown.length - 400} more (all of them go into the report).</p>{/if}
        </div>
      {:else if finished}
        <p class="good">Everything checked out: every game has a video, a cover and a description, and every file it names is there.</p>
      {:else if !systems.length}
        <p class="dim">None of your consoles has scraped games yet.</p>
      {/if}
      {#if error}<p class="warn">{error}</p>{/if}
      <p class="faint note">A file being there doesn't prove a video plays in RetroBat (that depends on its format), so check playback in RetroBat itself.</p>
    </div>
    <footer>
      <button class="secondary" onclick={exportCsv} disabled={!shown.length}>Save report (CSV)…</button>
      <button class="secondary" onclick={close}>Close</button>
    </footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: grid;
    place-items: center;
    z-index: 400;
  }
  .dialog {
    display: grid;
    grid-template-rows: auto 1fr auto;
    width: min(900px, 95vw);
    height: min(700px, 90vh);
    background: var(--panel);
    border: 1px solid #3a3a3a;
    border-radius: 12px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  header {
    padding: 18px 20px 10px;
    display: grid;
    gap: 8px;
  }
  h2 {
    margin: 0;
    font-size: 16px;
  }
  header p {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
  }
  .bar-row {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 12px;
  }
  .progress {
    width: 220px;
    height: 8px;
    border-radius: 4px;
    background: #333;
    overflow: hidden;
  }
  .progress div {
    height: 100%;
    background: var(--accent);
  }
  .body {
    overflow: auto;
    padding: 4px 16px 8px;
    display: grid;
    align-content: start;
    gap: 8px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .chip {
    background: var(--bg);
    border: 1px solid #3a3a3a;
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 12px;
  }
  .chip.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  .table {
    display: grid;
    font-size: 12px;
  }
  .tr {
    display: grid;
    grid-template-columns: 150px minmax(0, 1.2fr) 150px minmax(0, 1.5fr);
    gap: 10px;
    padding: 4px 6px;
    border-bottom: 1px solid #2c2c2c;
  }
  .tr span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .path {
    color: var(--text-faint);
    font-size: 11px;
  }
  .warn {
    color: var(--warn);
    font-size: 12px;
    margin: 0;
  }
  .good {
    color: var(--ok, #3fb56b);
  }
  .note {
    font-size: 11px;
    margin: 6px 0 0;
  }
  footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 10px 16px 14px;
  }
</style>
