<script lang="ts">
  import { tick } from 'svelte';
  import { ed } from '$lib/editor.svelte';
  import { lineOf } from '$lib/xml/cst';

  let box: HTMLDivElement;

  const file = $derived.by(() => {
    ed.rev;
    const p = ed.project;
    if (!p) return null;
    return (ed.sourceFile ? p.files.get(ed.sourceFile) : null) ?? p.entry ?? null;
  });

  // File objects are edited in place, so these re-read on every edit (rev).
  const lines = $derived.by(() => {
    ed.rev;
    return file ? file.src.split(/\r?\n/) : [];
  });

  /** Lines covered by the selected element's definitions in this file. */
  const marked = $derived.by(() => {
    ed.rev;
    const set = new Set<number>();
    const el = ed.selectedElement;
    if (!el || !file) return set;
    for (const d of el.defs) {
      if (d.file !== file) continue;
      const a = lineOf(file.src, d.node.start);
      const b = lineOf(file.src, d.node.end);
      for (let i = a; i <= b; i++) set.add(i);
    }
    return set;
  });

  $effect(() => {
    const line = ed.sourceLine;
    file;
    if (!line) return;
    tick().then(() => {
      const row = box?.querySelector<HTMLElement>(`[data-line="${line}"]`);
      row?.scrollIntoView({ block: 'center' });
    });
  });
</script>

<div class="source">
  <div class="bar">
    <select aria-label="File" value={file?.key} onchange={(e) => ((ed.sourceFile = e.currentTarget.value), (ed.sourceLine = 1))}>
      {#each ed.project?.xmlFiles ?? [] as f (f.key)}
        <option value={f.key}>{f.rel}{f.dirty ? ' •' : ''}</option>
      {/each}
    </select>
    <span class="faint">{lines.length} lines · {file?.bom ? 'UTF-8 with BOM' : 'UTF-8'} · {file?.src.includes('\r\n') ? 'CRLF' : 'LF'} · read-only</span>
    <span class="spacer"></span>
    <button class="ghost small" onclick={() => (ed.showSource = false)} title="Hide" aria-label="Hide">✕</button>
  </div>
  <div class="code" bind:this={box}>
    {#each lines as l, i}
      <div class="ln" data-line={i + 1} class:mark={marked.has(i + 1)} class:target={ed.sourceLine === i + 1}>
        <span class="no">{i + 1}</span><span class="tx">{l || ' '}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .source {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 8px;
    border-bottom: 1px solid var(--line);
    font-size: 11.5px;
  }
  .bar select {
    max-width: 320px;
  }
  .spacer {
    flex: 1;
  }
  .code {
    flex: 1;
    overflow: auto;
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.55;
    background: var(--bg);
    padding: 4px 0;
  }
  /* The code scrolls with the keyboard once focused (WebView2 makes scrollers focusable). */
  .code:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: -2px;
  }
  .ln {
    display: flex;
    white-space: pre;
  }
  .ln.mark {
    background: color-mix(in srgb, var(--brand) 8%, transparent);
  }
  .ln.target {
    background: color-mix(in srgb, var(--brand) 22%, transparent);
  }
  .no {
    width: 52px;
    flex: none;
    text-align: right;
    padding-right: 12px;
    color: var(--text-faint);
    user-select: none;
  }
  .tx {
    color: var(--text);
    padding-right: 20px;
  }
</style>
