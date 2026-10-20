<script lang="ts">
  import { ask } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import { sharing } from '$lib/theme/edits';
  import { ELEMENT_LABELS, SCHEMA, specFor, inferSpec, type PropSpec } from '$lib/theme/schema';
  import { TYPE_ICON } from '$lib/render';
  import { lineOf } from '$lib/xml/cst';
  import PropRow from './PropRow.svelte';
  import { ANIMATIONS, presetOf } from '$lib/theme/animations';
  import { elementLabel, propLabel, SIMPLE_PROPS, TYPE_LABELS, typeLabel, viewHelp, viewLabel } from '$lib/friendly';

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
  let showAll = $state(false);
  const animId = $derived(el ? presetOf(el) : null);
  $effect(() => {
    el?.name;
    showAll = false;
  });

  const visibleRows = $derived(ed.simple && !showAll ? rows.filter((r) => SIMPLE_PROPS.has(r.def.name)) : rows);
  const hiddenCount = $derived(rows.length - rows.filter((r) => SIMPLE_PROPS.has(r.def.name)).length);

  /** Other screens that share a definition with this element, so beginners know an edit spreads. */
  const sharedViews = $derived.by(() => {
    if (!el) return [];
    const set = new Set<string>();
    for (const d of el.defs) for (const v of sharing(d).views) if (v !== ed.view) set.add(v);
    return [...set];
  });

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
    const ok = await ask(`Delete “${elementLabel(el.name)}” from ${viewLabel(ed.view)}? Parts shared with other screens are kept. You can undo this with Ctrl+Z.`, { title: 'Delete element', kind: 'warning', okLabel: 'Delete', cancelLabel: 'Cancel' });
    if (!ok) return;
    const r = ed.deleteElement(el.name);
    if (!r.removed) ed.notify('This element is shared with other screens, so it can’t be deleted here. Untick “Visible” to hide it instead.', 'error');
    else if (r.kept) ed.notify(`Deleted ${r.removed} definition(s); ${r.kept} shared definition(s) kept`);
  }
</script>

{#if !el}
  <div class="empty">
    <h3>{viewLabel(ed.view, ed.currentView?.displayName)}</h3>
    {#if viewHelp(ed.view)}<p class="dim">{viewHelp(ed.view)}</p>{/if}
    <div class="pick">
      <span class="arrow">←</span>
      <span>Click any part of the preview, or pick it from the list on the left, to change it here.</span>
    </div>
    <ul class="dim tips">
      <li>Drag the selected part to move it. Arrow keys move it a little; hold Shift for bigger steps.</li>
      <li>Colours marked “Shared” change everywhere they are used. Find them all in the Colours tab.</li>
      <li>Nothing is written until you press Save. A backup of the theme is made first, and Ctrl+Z undoes any change.</li>
    </ul>
    <button class="small" onclick={() => (ed.showGuide = true)}>Show the getting started guide</button>
    {#if !ed.simple && ed.res && ed.res.unknownConditions > 0}
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
        <div class="label">{ed.simple ? elementLabel(el.name) : (ELEMENT_LABELS[el.name] ?? el.name)}</div>
        {#if ed.simple}
          <div class="faint small">{typeLabel(el.type)}{TYPE_LABELS[el.type]?.help ? ` · ${TYPE_LABELS[el.type].help}` : ''}</div>
        {:else}
          <div class="faint mono small">{el.type} name="{el.name}"{el.extra ? ` extra="${el.extra}"` : ''}</div>
        {/if}
      </div>
    </div>
    {#if ed.simple && sharedViews.length}
      <p class="shared">Some of these settings also apply to {sharedViews.map((v) => viewLabel(v)).join(', ')}.</p>
    {/if}
    <div class="defs" class:hide={ed.simple}>
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
    {@const groupRows = visibleRows.filter((r) => r.spec.group === g.id)}
    {#if groupRows.length}
      <h4>{g.label}</h4>
      {#each groupRows as r (r.def.name)}
        <PropRow {el} spec={r.spec} def={r.def} />
      {/each}
    {/if}
  {/each}

  <h4>Animation</h4>
  <div class="anim">
    <select value={animId ?? ''} onchange={(e) => ed.setAnimation(el.name, e.currentTarget.value || null)}>
      <option value="">None</option>
      {#if animId === 'custom'}<option value="custom" disabled>Custom (from the theme)</option>{/if}
      <optgroup label="When the screen opens">
        {#each ANIMATIONS.filter((a) => a.kind === 'entrance') as a}<option value={a.id} title={a.help}>{a.label}</option>{/each}
      </optgroup>
      <optgroup label="All the time">
        {#each ANIMATIONS.filter((a) => a.kind === 'loop') as a}<option value={a.id} title={a.help}>{a.label}</option>{/each}
      </optgroup>
    </select>
    <button class="secondary small" class:on={ed.playAnimations} onclick={() => (ed.playAnimations = !ed.playAnimations)} title="Play animations in the preview">{ed.playAnimations ? '■ Stop' : '▶ Play'}</button>
  </div>

  {#if ed.simple && hiddenCount > 0}
    <button class="more ghost" onclick={() => (showAll = !showAll)}>
      {showAll ? 'Show fewer settings' : `Show ${hiddenCount} more setting${hiddenCount === 1 ? '' : 's'}`}
    </button>
  {/if}

  {#if !ed.simple && el.complex.length}
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
        <option value="">{ed.simple ? '＋ Add a setting…' : '＋ Add property…'}</option>
        {#each missing as m}
          <option value={m.name} title={m.hint}>{ed.simple ? propLabel(m.name) : m.name}</option>
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
  .pick {
    display: flex;
    gap: 10px;
    align-items: center;
    background: var(--accent-soft);
    color: var(--text);
    border-radius: 8px;
    padding: 10px 12px;
    margin: 12px 0;
  }
  .arrow {
    font-size: 20px;
    color: var(--accent);
  }
  .shared {
    margin: 0;
    font-size: 12px;
    color: var(--warn);
  }
  .defs.hide {
    display: none;
  }
  .anim {
    display: flex;
    gap: 6px;
    padding: 4px 12px 10px;
  }
  .anim select {
    flex: 1;
  }
  .more {
    width: calc(100% - 24px);
    margin: 8px 12px 0;
    color: var(--accent);
  }
  .add select {
    width: 100%;
  }
</style>
