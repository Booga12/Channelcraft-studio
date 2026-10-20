<script lang="ts">
  // Context bar under the menus, like Photoshop's options bar: quick settings for the selection,
  // or the preview settings when nothing is selected.
  import { ask } from '@tauri-apps/plugin-dialog';
  import { ed } from '$lib/editor.svelte';
  import { elementLabel, typeLabel, viewLabel } from '$lib/friendly';
  import { fmtNum, parsePair } from '$lib/theme/schema';
  import { isVisible, zOf } from '$lib/render';
  import Icon, { TYPE_ICONS } from './Icon.svelte';

  const LANGS = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'zh', 'ko', 'sv', 'tr'];

  const el = $derived(ed.selectedElement);
  const pos = $derived<[number, number]>(parsePair(el?.props.get('pos')?.value) ?? [0, 0]);
  const sizeProp = $derived(el?.props.has('size') || !el?.props.has('maxSize') ? 'size' : 'maxSize');
  const size = $derived<[number, number]>(parsePair(el?.props.get(sizeProp)?.value) ?? [0, 0]);

  const pct = (n: number) => Math.round(n * 1000) / 10;

  function setPair(prop: string, cur: [number, number], i: 0 | 1, v: number) {
    if (!el || Number.isNaN(v)) return;
    const next: [number, number] = [...cur];
    next[i] = v / 100;
    ed.setProp(el.name, prop, `${fmtNum(next[0])} ${fmtNum(next[1])}`);
  }

  function pickSystem(e: Event) {
    const s = ed.systems.find((x) => x.name === (e.currentTarget as HTMLSelectElement).value);
    if (s) ed.settings.system = s;
  }

  async function remove() {
    if (!el) return;
    const ok = await ask(`Delete “${elementLabel(el.name)}” from ${viewLabel(ed.view)}? You can undo this with Ctrl+Z.`, { title: 'Delete element', kind: 'warning', okLabel: 'Delete', cancelLabel: 'Cancel' });
    if (!ok) return;
    const r = ed.deleteElement(el.name);
    if (!r.removed) ed.notify('This element is shared with other screens, so it can’t be deleted here. Hide it with the eye button instead.', 'error');
  }
</script>

<div class="optbar">
  {#if el}
    <div class="sel">
      <Icon name={TYPE_ICONS[el.type] ?? 'file'} size={15} />
      <strong title={el.name}>{ed.simple ? elementLabel(el.name) : el.name}</strong>
      <span class="faint">{typeLabel(el.type)}</span>
    </div>
    <div class="sep"></div>
    <label class="f" title="Distance from the left edge of the screen">
      <span>X</span><input type="number" step="0.1" value={pct(pos[0])} oninput={(e) => setPair('pos', pos, 0, e.currentTarget.valueAsNumber)} /><em>%</em>
    </label>
    <label class="f" title="Distance from the top edge of the screen">
      <span>Y</span><input type="number" step="0.1" value={pct(pos[1])} oninput={(e) => setPair('pos', pos, 1, e.currentTarget.valueAsNumber)} /><em>%</em>
    </label>
    <label class="f" title="Width compared to the screen (0 keeps the proportions)">
      <span>W</span><input type="number" step="0.1" value={pct(size[0])} oninput={(e) => setPair(sizeProp, size, 0, e.currentTarget.valueAsNumber)} /><em>%</em>
    </label>
    <label class="f" title="Height compared to the screen (0 keeps the proportions)">
      <span>H</span><input type="number" step="0.1" value={pct(size[1])} oninput={(e) => setPair(sizeProp, size, 1, e.currentTarget.valueAsNumber)} /><em>%</em>
    </label>
    <div class="sep"></div>
    <label class="f" title="Layer: higher numbers are drawn on top">
      <Icon name="layers" size={14} />
      <input class="z" type="number" step="1" value={zOf(el)} oninput={(e) => !Number.isNaN(e.currentTarget.valueAsNumber) && ed.setProp(el.name, 'zIndex', String(e.currentTarget.valueAsNumber))} />
    </label>
    <button class="icon" class:off={!isVisible(el)} onclick={() => ed.setProp(el.name, 'visible', isVisible(el) ? 'false' : 'true')} title={isVisible(el) ? 'Hide on this screen (saved to the theme)' : 'Show on this screen'}>
      <Icon name={isVisible(el) ? 'eye' : 'eyeOff'} size={15} />
    </button>
    <button class="icon" onclick={remove} title="Delete this element"><Icon name="trash" size={15} /></button>
  {:else}
    <div class="sel faint"><Icon name="move" size={15} /> Click something on the screen to select it</div>
  {/if}

  <div class="spacer"></div>

  <label class="f" title="Which console the preview shows">
    <Icon name="monitor" size={14} />
    <select value={ed.settings.system.name} onchange={pickSystem} class="system">
      {#each ed.systems as s (s.name)}
        <option value={s.name}>{s.fullName}</option>
      {/each}
    </select>
  </label>
  {#if !ed.simple}
    <label class="f" title="Language used by the theme">
      <span>Lang</span>
      <select bind:value={ed.settings.lang}>
        {#each LANGS as l}<option value={l}>{l}</option>{/each}
      </select>
    </label>
  {/if}
</div>

<style>
  .optbar {
    grid-area: opts;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 38px;
    padding: 0 12px;
    background: var(--panel);
    border-bottom: 1px solid var(--line);
    min-width: 0;
  }
  .sel {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .sel strong {
    max-width: 190px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sep {
    width: 1px;
    height: 20px;
    background: #444;
  }
  .f {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-dim);
  }
  .f span {
    font-size: 11px;
    color: var(--text-faint);
  }
  .f em {
    font-style: normal;
    color: var(--text-faint);
    font-size: 11px;
  }
  .f input {
    width: 62px;
    padding: 3px 5px;
  }
  .f input.z {
    width: 52px;
  }
  .icon {
    background: transparent;
    padding: 4px;
    color: var(--text-dim);
  }
  .icon:hover:not(:disabled) {
    color: var(--text);
  }
  .icon.off {
    color: var(--warn);
  }
  .spacer {
    flex: 1;
  }
  select.system {
    max-width: 220px;
  }
</style>
