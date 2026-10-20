<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import { dirname, relative } from '$lib/path';
  import { varRef } from '$lib/theme/edits';
  import { resolveAsset, type PropDef, type ResolvedElement } from '$lib/theme/resolver';
  import { lineOf } from '$lib/xml/cst';
  import type { PropSpec } from '$lib/theme/schema';
  import ColorInput from './ColorInput.svelte';
  import PairInput from './PairInput.svelte';
  import AssetInput from './AssetInput.svelte';
  import { humanize, propHelp, propLabel } from '$lib/friendly';

  let { el, spec, def }: { el: ResolvedElement; spec: PropSpec; def: PropDef } = $props();

  const varName = $derived(varRef(def.raw));
  const varDef = $derived(varName ? ed.res?.vars.get(varName) : undefined);
  /** What the editor shows and changes: the variable's own text when linked, else the property text. */
  const editValue = $derived(varDef ? varDef.raw : def.raw);
  const dynamic = $derived(/\$\{|\{[a-z]+[:.]/i.test(editValue) || /^\s*\w+\(/.test(editValue));
  const history = $derived(el.history.get(spec.name) ?? []);
  const line = $derived(lineOf(def.file.src, def.node.start));

  let editAnyway = $state(false);

  function set(v: string) {
    ed.setProp(el.name, spec.name, v);
  }

  function unlink() {
    ed.setProp(el.name, spec.name, def.value, { literal: true });
  }

  const assetKind = $derived(spec.kind === 'path' ? 'image' : spec.kind === 'font' ? 'font' : spec.kind === 'sound' ? 'sound' : spec.kind === 'video' ? 'video' : null);
  const resolved = $derived.by(() => {
    if (!assetKind || !ed.res || !ed.project) return null;
    return resolveAsset(def, ed.res, ed.project, ed.env);
  });
  function toRelative(abs: string) {
    if (varDef) return relative(dirname(varDef.file.abs), abs);
    return ed.relativeAssetPath(el.name, spec.name, abs);
  }
</script>

<div class="row">
  <div class="label">
    {#if ed.simple}
      <span class="name" title={spec.name}>{propLabel(spec.name)}</span>
    {:else}
      <span class="name" title={spec.hint ?? propLabel(spec.name)}>{spec.name}</span>
      {#if def.conditional}<span class="badge" title="This value only applies under a condition">if</span>{/if}
      {#if history.length > 1}<span class="badge" title="Set {history.length} times for this element; this is the value that wins">×{history.length}</span>{/if}
    {/if}
    <span class="spacer"></span>
    {#if !ed.simple}
      <button class="src ghost small mono" title="Show in source: {def.file.rel} line {line}" onclick={() => ed.showInSource(def.file, def.node.start)}>{def.file.rel.split('/').pop()}:{line}</button>
      <button class="ghost small x" title="Remove this property from the file" onclick={() => ed.removeProp(el.name, spec.name)}>✕</button>
    {/if}
  </div>
  {#if ed.simple && (propHelp(spec.name) ?? spec.hint)}
    <p class="help">{propHelp(spec.name) ?? spec.hint}</p>
  {/if}

  {#if varDef}
    <div class="link">
      {#if ed.simple}
        <span class="badge accent" title="Theme colour “{varName}”">Shared: {humanize(varName ?? '')}</span>
        <span class="faint">changes it everywhere</span>
        <button class="ghost small" onclick={unlink} title="Give only this element its own value">Only here</button>
      {:else}
        <span class="badge accent" title="Defined in {varDef.file.rel}">${'{'}{varName}{'}'}</span>
        <span class="faint">edits the variable</span>
        <button class="ghost small" onclick={unlink} title="Write the value here instead of using the variable">Set here instead</button>
      {/if}
    </div>
  {/if}

  <div class="editor">
    {#if dynamic && ed.simple && !editAnyway}
      <div class="auto">
        <span class="dim">Set automatically by the theme{def.value && def.value !== editValue && !def.value.includes('{') ? `: ${def.value}` : ''}</span>
        <button class="ghost small" onclick={() => (editAnyway = true)}>Edit anyway</button>
      </div>
    {:else if dynamic}
      <input class="mono wide" value={editValue} spellcheck="false" onchange={(e) => set(e.currentTarget.value)} title="Contains variables or an expression" />
      {#if def.value !== editValue}<div class="faint mono resolved">= {def.value}</div>{/if}
    {:else if spec.kind === 'color'}
      <ColorInput value={editValue} onchange={set} />
    {:else if spec.kind === 'pair'}
      {@const isPos = spec.name === 'pos'}
      {@const screenPair = ed.simple && ['pos', 'size', 'maxSize', 'minSize'].includes(spec.name)}
      <PairInput
        value={editValue}
        onchange={set}
        percent={screenPair}
        labels={ed.simple ? (isPos ? ['from left', 'from top'] : spec.name.toLowerCase().includes('size') ? ['width', 'height'] : ['x', 'y']) : spec.name.toLowerCase().includes('size') ? ['w', 'h'] : ['x', 'y']}
      />
    {:else if spec.kind === 'bool'}
      {@const on = editValue.trim().toLowerCase() === 'true' || editValue.trim() === '1'}
      <label class="chk"><input type="checkbox" checked={on} onchange={(e) => set(e.currentTarget.checked ? 'true' : 'false')} /> {ed.simple ? (on ? 'Yes' : 'No') : editValue}</label>
    {:else if spec.kind === 'float' || spec.kind === 'int'}
      <input type="number" class="num" step={spec.kind === 'int' || spec.name === 'zIndex' ? 1 : 0.001} value={editValue} oninput={(e) => !Number.isNaN(e.currentTarget.valueAsNumber) && set(String(e.currentTarget.valueAsNumber))} />
    {:else if spec.kind === 'alignment' || spec.kind === 'valign' || spec.kind === 'enum'}
      {@const opts = spec.kind === 'alignment' ? ['left', 'center', 'right', 'justify'] : spec.kind === 'valign' ? ['top', 'center', 'bottom'] : (spec.options ?? [])}
      <select value={editValue} onchange={(e) => set(e.currentTarget.value)}>
        {#if !opts.includes(editValue)}<option value={editValue}>{editValue}</option>{/if}
        {#each opts as o}<option value={o}>{ed.simple ? humanize(o) : o}</option>{/each}
      </select>
    {:else if assetKind}
      <AssetInput value={editValue} kind={assetKind} {resolved} {toRelative} onchange={set} />
    {:else if spec.kind === 'text' || editValue.length > 40 || editValue.includes('\n')}
      <textarea class="wide" rows="3" value={editValue} onchange={(e) => set(e.currentTarget.value)}></textarea>
    {:else}
      <input class="wide" value={editValue} spellcheck="false" onchange={(e) => set(e.currentTarget.value)} />
    {/if}
  </div>
</div>

<style>
  .row {
    display: grid;
    gap: 5px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
  }
  .label {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
    font-size: 12px;
  }
  .spacer {
    flex: 1;
  }
  .help {
    margin: -2px 0 2px;
    font-size: 11.5px;
    color: var(--text-faint);
  }
  .auto {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  .auto span {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .src {
    font-size: 10.5px;
    color: var(--text-faint);
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .x {
    color: var(--text-faint);
    padding: 1px 5px;
  }
  .x:hover {
    color: var(--danger);
  }
  .link {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
  }
  .link .ghost {
    margin-left: auto;
  }
  .wide,
  select,
  textarea {
    width: 100%;
  }
  textarea {
    resize: vertical;
  }
  .num {
    width: 110px;
  }
  .chk {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--text-dim);
  }
  .resolved {
    margin-top: 3px;
    font-size: 10.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
