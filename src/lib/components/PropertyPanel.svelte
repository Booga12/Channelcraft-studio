<script lang="ts">
  import { ask } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import { sharing } from '$lib/theme/edits';
  import { ELEMENT_LABELS, SCHEMA, specFor, inferSpec, type PropSpec } from '$lib/theme/schema';
  import { TYPE_ICON } from '$lib/render';
  import { lineOf } from '$lib/xml/cst';
  import PropRow from './PropRow.svelte';

  const GROUPS: { id: PropSpec['group']; label: string }[] = [
    { id: 'layout', label: 'Layout' },
    { id: 'look', label: 'Appearance' },
    { id: 'content', label: 'Content' },
    { id: 'behavior', label: 'Behaviour' },
  ];

  const el = $derived(ed.selectedElement);

  const rows = $derived.by(() => {
    if (!el) return [];
    return [...el.props.values()].map((def) => {
      const known = SCHEMA[el.type]?.find((s) => s.name === def.name);
      return { def, spec: known ?? inferSpec(def.name, def.value) };
    });
  });

  const missing = $derived.by(() => {
    if (!el) return [];
    return (SCHEMA[el.type] ?? []).filter((s) => !el.props.has(s.name));
  });

  let adding = $state('');

  function defaultFor(spec: PropSpec): string {
    switch (spec.kind) {
      case 'pair':
        return spec.name === 'origin' ? '0.5 0.5' : spec.name === 'pos' ? '0.5 0.5' : '0.2 0.1';
      case 'color':
        return 'FFFFFFFF';
      case 'bool':
        return spec.name === 'visible' ? 'true' : 'false';
      case 'float':
        return spec.name === 'zIndex' ? '10' : spec.name === 'fontSize' ? '0.035' : spec.name === 'opacity' ? '1' : '0';
      case 'alignment':
      case 'valign':
        return 'center';
      case 'enum':
        return spec.options?.[0] ?? '';
      default:
        return '';
    }
  }

  function addProp(name: string) {
    if (!el || !name) return;
    ed.setProp(el.name, name, defaultFor(specFor(el.type, name)));
    adding = '';
  }

  async function remove() {
    if (!el) return;
    const ok = await ask(`Delete “${el.name}” from the ${ed.view} view? Definitions shared with other elements or views are kept.`, { title: 'Delete element', kind: 'warning', okLabel: 'Delete', cancelLabel: 'Cancel' });
    if (!ok) return;
    const r = ed.deleteElement(el.name);
    if (!r.removed) ed.notify('This element is only defined in shared blocks. Set visible to false to hide it here.', 'error');
    else if (r.kept) ed.notify(`Deleted ${r.removed} definition(s); ${r.kept} shared definition(s) kept`);
  }
</script>

{#if !el}
  <div class="empty">
    <h3>{ed.currentView?.displayName ?? ed.view} view</h3>
    <p class="dim">Click an element in the preview or the Elements list to edit it.</p>
    <ul class="dim tips">
      <li>Drag the selected element to move it; arrow keys nudge it (Shift for bigger steps).</li>
      <li>Colours linked to a variable change everywhere that variable is used.</li>
      <li>Nothing is written to disk until you press Save. A backup zip is made before the first save.</li>
    </ul>
    {#if ed.res && ed.res.unknownConditions > 0}
      <p class="warn">
        {ed.res.unknownConditions} condition(s) couldn't be evaluated and are treated as true.
        <span class="mono small" title={[...ed.res.unknownExpressions].join('\n')}>Hover for details</span>
      </p>
    {/if}
  </div>
{:else}
  <div class="head">
    <div class="title">
      <span class="ic">{TYPE_ICON[el.type] ?? '•'}</span>
      <div>
        <div class="label">{ELEMENT_LABELS[el.name] ?? el.name}</div>
        <div class="faint mono small">{el.type} name="{el.name}"{el.extra ? ` extra="${el.extra}"` : ''}</div>
      </div>
    </div>
    <div class="defs">
      {#each el.defs as d, i}
        {@const sh = sharing(d)}
        <button class="def ghost small" onclick={() => ed.showInSource(d.file, d.node.start)} title="Show this definition in the source">
          <span class="mono">{d.file.rel}:{lineOf(d.file.src, d.node.start)}</span>
          {#if sh.views.length > 1}<span class="faint">· views {sh.views.join(', ')}</span>{/if}
          {#if sh.names.length > 1}<span class="faint">· shared by {sh.names.length} elements</span>{/if}
          {#if i === el.defs.length - 1}<span class="badge">last</span>{/if}
        </button>
      {/each}
    </div>
    <div class="actions">
      <button class="small" onclick={remove} title="Delete this element's own definitions">Delete</button>
    </div>
  </div>

  {#each GROUPS as g}
    {@const groupRows = rows.filter((r) => r.spec.group === g.id)}
    {#if groupRows.length}
      <h4>{g.label}</h4>
      {#each groupRows as r (r.def.name)}
        <PropRow {el} spec={r.spec} def={r.def} />
      {/each}
    {/if}
  {/each}

  {#if el.complex.length}
    <h4>Animations and nested blocks</h4>
    {#each el.complex as c}
      <button class="def ghost small block" onclick={() => ed.showInSource(c.file, c.node.start)}>
        <span class="mono">&lt;{c.name}&gt;</span>
        <span class="faint mono">{c.file.rel}:{lineOf(c.file.src, c.node.start)}</span>
      </button>
    {/each}
  {/if}

  {#if missing.length}
    <div class="add">
      <select bind:value={adding} onchange={() => addProp(adding)}>
        <option value="">＋ Add property…</option>
        {#each missing as m}
          <option value={m.name} title={m.hint}>{m.name}</option>
        {/each}
      </select>
    </div>
  {/if}
{/if}

<style>
  .empty {
    padding: 18px 16px;
  }
  .empty h3 {
    margin: 0 0 6px;
    font-size: 14px;
  }
  .tips {
    padding-left: 18px;
    font-size: 12px;
    display: grid;
    gap: 6px;
  }
  .warn {
    color: var(--warn);
    font-size: 12px;
  }
  .small {
    font-size: 11px;
  }
  .head {
    padding: 12px;
    border-bottom: 1px solid var(--line);
    display: grid;
    gap: 8px;
    background: var(--panel-2);
  }
  .title {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .ic {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    background: var(--raised);
    border-radius: 6px;
    font-size: 15px;
    color: var(--accent);
    flex: none;
  }
  .label {
    font-weight: 600;
    font-size: 14px;
  }
  .defs {
    display: grid;
    gap: 2px;
  }
  .def {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
    text-align: left;
    padding: 2px 4px;
    font-size: 11px;
  }
  .def.block {
    width: calc(100% - 16px);
    margin: 2px 8px;
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  h4 {
    margin: 0;
    padding: 10px 12px 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    font-weight: 600;
  }
  .add {
    padding: 12px;
  }
  .add select {
    width: 100%;
  }
</style>
