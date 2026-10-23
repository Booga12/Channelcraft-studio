<script lang="ts">
  import TileStylePicker from './TileStylePicker.svelte';
  import { ask } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import { sharing } from '$lib/theme/edits';
  import { ELEMENT_LABELS, SCHEMA, specFor, inferSpec, type PropSpec } from '$lib/theme/schema';
  import { TYPE_ICON } from '$lib/render';
  import { lineOf } from '$lib/xml/cst';
  import PropRow from './PropRow.svelte';
  import { ANIMATIONS, EXITS, exitOf, misplayed, presetOf, screenOf, STILL_TYPES, tuningOf } from '$lib/theme/animations';
  import { parsePair } from '$lib/theme/schema';
  import { SHADOW_DEFAULT, SHADOW_TYPES, shaderOf } from '$lib/theme/shadow';
  import { FRAME_DEFAULT, FRAME_TYPES, frameOf, type Frame } from '$lib/theme/frame';
  import ColorInput from './ColorInput.svelte';
  import { elementLabel, propLabel, SIMPLE_PROPS, TYPE_LABELS, typeLabel, viewHelp, viewLabel } from '$lib/friendly';

  const GROUPS: { id: PropSpec['group']; label: string }[] = [
    { id: 'layout', label: 'Layout' },
    { id: 'look', label: 'Appearance' },
    { id: 'content', label: 'Content' },
    { id: 'behavior', label: 'Behaviour' },
  ];

  /** In the inspector, whose header already names the element. */
  let { inInspector = false }: { inInspector?: boolean } = $props();

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
  const screen = $derived(screenOf(ed.view));
  const animId = $derived(el ? presetOf(el, screen) : null);
  const tuning = $derived(el ? tuningOf(el, screen) : null);
  const exitId = $derived(el ? exitOf(el) : null);
  const wontPlay = $derived(!!el && misplayed(el, screen) && !!tuning);
  const still = $derived(!!el && STILL_TYPES.has(el.type));
  /** The preset's own duration at normal speed, for the speed slider. */
  const baseMs = $derived(tuning && el ? Number(tuning.preset.build(parsePair(el.props.get('pos')?.value) ?? [0, 0], 1, 1, screen)[0].animations[0].duration) : 0);
  const sameKind = $derived(tuning && ed.currentView ? [...ed.currentView.elements.values()].filter((e) => e !== el && tuningOf(e, screen)?.preset.id === tuning.preset.id).length : 0);
  const shader = $derived(el && SHADOW_TYPES.has(el.type) ? shaderOf(el) : null);
  const frame = $derived(el && FRAME_TYPES.has(el.type) ? frameOf(el) : null);
  const otherShader = $derived(!!el && !frame && !!shaderOf(el));
  const corners = $derived(frame ? frame.frame.corners : parseFloat(el?.props.get('roundCorners')?.value ?? '0') || 0);
  /** A colour as shown in the picker: a shared colour shows its current value. */
  const shown = (v: string) => {
    const m = v.match(/^\$\{([^}]+)\}$/);
    return m ? (ed.res?.vars.get(m[1])?.value ?? 'FFFFFFFF') : v;
  };
  const changeFrame = (part: Partial<Frame>) => el && frame && ed.setFrame(el.name, { ...frame.frame, ...part }, `frame.${el.name}`);

  function tune(amount: number, ms: number) {
    if (!el || !tuning) return;
    ed.tuneAnimation(el.name, amount, baseMs / Math.max(50, ms), { coalesce: `tune.${el.name}` });
  }
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
      <span>Click any part of the preview, or pick it in Layers, to change it here.</span>
    </div>
    <ul class="dim tips">
      <li>Drag the selected part to move it. Arrow keys move it a little; hold Shift for bigger steps.</li>
      <li>Colours marked “Shared” change everywhere they are used. Find them all in Colours.</li>
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
    <div class="title" class:hide={inInspector}>
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
    <div class="actions" class:hide={inInspector}>
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

  {#if ed.tileStyle !== null && (el.type === 'imagegrid' || el.type === 'gridtile' || el.name.startsWith('gridtile'))}
    <h4>Tile style</h4>
    <TileStylePicker />
  {/if}

  <h4>Animation</h4>
  <div class="anim">
    <select value={animId ?? ''} onchange={(e) => ed.setAnimation(el.name, e.currentTarget.value || null)}>
      <option value="">None</option>
      {#if animId === 'custom'}<option value="custom" disabled>Custom (from the theme)</option>{/if}
      <optgroup label={screen === 'console' ? 'On every console you move to' : 'On every game you move to'}>
        {#each ANIMATIONS.filter((a) => a.kind === 'entrance') as a}<option value={a.id} title={a.help}>{a.label}</option>{/each}
      </optgroup>
      {#if !still}
        <optgroup label="Comes in, then keeps moving">
          {#each ANIMATIONS.filter((a) => a.kind === 'combo') as a}<option value={a.id} title={a.help}>{a.label}</option>{/each}
        </optgroup>
        <optgroup label="All the time">
          {#each ANIMATIONS.filter((a) => a.kind === 'loop') as a}<option value={a.id} title={a.help}>{a.label}</option>{/each}
        </optgroup>
      {/if}
    </select>
    <button class="secondary small" onclick={() => ed.replayAnimations()} title="Play it again in the preview (R)">↻ Replay</button>
  </div>
  {#if tuning}<p class="faint note">{tuning.preset.help}</p>{/if}
  {#if tuning && tuning.preset.kind !== 'loop'}
    <p class="faint note">It plays as the screen opens and every time you move to another {screen === 'console' ? 'console' : 'game'}. Press ↻ Replay, R, or ↓ ↑ in the preview to see it again.</p>
  {/if}
  {#if tuning && !ed.playAnimations}
    <p class="warn note">Animations are switched off in the preview. <button class="small" onclick={() => ed.replayAnimations()}>Turn them on</button></p>
  {/if}
  {#if wontPlay}
    <p class="warn note">
      RetroBat doesn't play this animation on the console screen: it was written for game lists.
      <button class="small" onclick={() => el && ed.fixAnimation(el.name)}>Make it play here</button>
    </p>
  {/if}
  {#if screen === 'list'}
    <label class="exit">
      <span>When you move on</span>
      <select value={exitId ?? ''} onchange={(e) => ed.setExit(el.name, e.currentTarget.value || null)}>
        <option value="">RetroBat's own quick fade</option>
        {#if exitId === 'custom'}<option value="custom" disabled>Custom (from the theme)</option>{/if}
        {#each EXITS as x}<option value={x.id} title={x.help}>{x.label}</option>{/each}
      </select>
    </label>
  {/if}
  {#if still}<p class="faint note">Videos stay still, because looping motion makes them stutter. To move one, animate the frame around it.</p>{/if}
  {#if tuning}
    <div class="tune">
      {#if tuning.preset.amount}
        <label>
          <span>{tuning.preset.kind === 'loop' ? 'How much it moves' : tuning.preset.id.includes('bounce') || tuning.preset.id === 'pop-pulse' ? 'How big the bounce is' : 'How far it comes from'}</span>
          <input type="range" min="0.25" max="3" step="0.05" value={tuning.amount} oninput={(e) => tune(e.currentTarget.valueAsNumber, tuning.duration)} />
          <b>{Math.round(tuning.amount * 100)}%</b>
        </label>
      {/if}
      <label>
        <span>{tuning.preset.id === 'spin' ? 'Time for one turn' : tuning.preset.kind === 'loop' ? 'Time for one move' : 'How long it takes'}</span>
        <input type="range" min="200" max="20000" step="100" value={tuning.duration} oninput={(e) => tune(tuning.amount, e.currentTarget.valueAsNumber)} />
        <b>{(tuning.duration / 1000).toFixed(1)} s</b>
      </label>
      {#if sameKind}
        <button class="ghost small" onclick={() => el && ed.tuneAnimation(el.name, tuning.amount, tuning.speed, { all: true })}>Use this for all {sameKind + 1} “{tuning.preset.label}” animations here</button>
      {/if}
      <p class="faint note">Calm motion looks best: a small move over a few seconds.</p>
    </div>
  {/if}

  {#if FRAME_TYPES.has(el.type)}
    <h4>Frame</h4>
    <div class="tune">
      <label>
        <span>Rounded corners</span>
        <input type="range" min="0" max="0.25" step="0.005" value={corners} oninput={(e) => el && ed.setCorners(el.name, e.currentTarget.valueAsNumber, `corners.${el.name}`)} />
        <b>{Math.round(corners * 100)}%</b>
      </label>
      {#if otherShader && !shader?.shadow}
        <p class="faint note">This uses another RetroBat shader, so it can't have a border and drop shadow too.</p>
      {:else}
        <label class="chk"><input type="checkbox" checked={!!frame} onchange={(e) => el && ed.setFrame(el.name, e.currentTarget.checked ? { ...FRAME_DEFAULT, corners: corners || FRAME_DEFAULT.corners } : null)} /> Border and drop shadow</label>
        {#if frame}
          <label>
            <span>Border</span>
            <input type="range" min="0" max="12" step="1" value={frame.frame.border} oninput={(e) => changeFrame({ border: e.currentTarget.valueAsNumber })} />
            <b>{frame.frame.border} px</b>
          </label>
          <div class="colour"><span>Border colour</span><ColorInput value={shown(frame.frame.borderColor)} onchange={(v) => changeFrame({ borderColor: v })} /></div>
          <label>
            <span>Shadow</span>
            <input type="range" min="0" max="30" step="1" value={frame.frame.shadow} oninput={(e) => changeFrame({ shadow: e.currentTarget.valueAsNumber })} />
            <b>{frame.frame.shadow} px</b>
          </label>
          <div class="colour"><span>Shadow colour</span><ColorInput value={shown(frame.frame.shadowColor)} onchange={(v) => changeFrame({ shadowColor: v })} /></div>
          <p class="faint note">RetroBat's frame shader. It suits screenshots, videos, box art and fan art; RetroBat skips pictures with see-through corners (most logos), so give those the soft shadow instead.</p>
        {/if}
      {/if}
    </div>
  {/if}

  {#if SHADOW_TYPES.has(el.type) && !frame}
    <h4>Shadow</h4>
    <div class="tune">
      {#if shader && !shader.shadow}
        <p class="faint note">This picture uses another RetroBat shader, so it can't have a shadow too.</p>
      {:else}
        <label class="chk"><input type="checkbox" checked={!!shader} onchange={(e) => ed.setShadow(el.name, e.currentTarget.checked ? 4 : null)} /> Soft shadow under the shape</label>
        {#if shader}
          <label>
            <span>Distance</span>
            <input type="range" min="1" max="24" step="1" value={shader.offset} oninput={(e) => ed.setShadow(el.name, e.currentTarget.valueAsNumber, `shadow.${el.name}`)} />
            <b>{shader.offset} px</b>
          </label>
          <p class="faint note">RetroBat's shadow shader: always black at half strength, down and to the right. {shader.offset === SHADOW_DEFAULT ? '' : `RetroBat's own default is ${SHADOW_DEFAULT} px.`} The preview is close, not exact.</p>
        {/if}
      {/if}
    </div>
  {/if}

  {#if ed.simple && hiddenCount > 0}
    <button class="more ghost" onclick={() => (showAll = !showAll)}>
      {showAll ? 'Show fewer settings' : `Show ${hiddenCount} more setting${hiddenCount === 1 ? '' : 's'}`}
    </button>
  {/if}

  {#if !ed.simple && el.complex.length}
    <h4>Animations and nested blocks</h4>
    {#each el.complex as c}
      <button class="def ghost small def-block" onclick={() => ed.showInSource(c.file, c.node.start)}>
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
  .colour {
    display: grid;
    grid-template-columns: 120px 1fr;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .exit {
    display: grid;
    grid-template-columns: 120px 1fr;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    font-size: 12px;
  }
  .warn.note {
    color: var(--warn);
  }
  .tune {
    display: grid;
    gap: 6px;
    padding: 4px 12px 8px;
  }
  .tune label {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 46px;
    gap: 2px;
    font-size: 12px;
  }
  .tune label span {
    grid-column: 1 / -1;
  }
  .tune b {
    font-weight: 500;
    font-size: 11px;
    text-align: right;
  }
  .note {
    font-size: 11px;
    margin: 2px 12px 6px;
  }
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
    color: var(--brand);
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
  .def.def-block {
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
    background: var(--brand-soft);
    color: var(--text);
    border-radius: 8px;
    padding: 10px 12px;
    margin: 12px 0;
  }
  .arrow {
    font-size: 20px;
    color: var(--brand);
  }
  .shared {
    margin: 0;
    font-size: 12px;
    color: var(--warn);
  }
  .title.hide,
  .actions.hide,
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
    color: var(--brand);
  }
  .add select {
    width: 100%;
  }
</style>
