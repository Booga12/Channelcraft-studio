<script lang="ts">
  // The quick settings of the selection at the top of the inspector: where it is and how big,
  // its layer, visibility and alignment (or alignment and spacing for several).
  import { ask } from '@tauri-apps/plugin-dialog';
  import AlignStartVerticalIcon from '@lucide/svelte/icons/align-start-vertical';
  import AlignCenterVerticalIcon from '@lucide/svelte/icons/align-center-vertical';
  import AlignEndVerticalIcon from '@lucide/svelte/icons/align-end-vertical';
  import AlignStartHorizontalIcon from '@lucide/svelte/icons/align-start-horizontal';
  import AlignCenterHorizontalIcon from '@lucide/svelte/icons/align-center-horizontal';
  import AlignEndHorizontalIcon from '@lucide/svelte/icons/align-end-horizontal';
  import DistributeHIcon from '@lucide/svelte/icons/align-horizontal-distribute-center';
  import DistributeVIcon from '@lucide/svelte/icons/align-vertical-distribute-center';
  import EyeIcon from '@lucide/svelte/icons/eye';
  import EyeOffIcon from '@lucide/svelte/icons/eye-off';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import LayersIcon from '@lucide/svelte/icons/layers';
  import { ed } from '$lib/editor.svelte';
  import { elementLabel, viewLabel } from '$lib/friendly';
  import { fmtNum, parsePair } from '$lib/theme/schema';
  import { isVisible, zOf } from '$lib/render';
  import IconButton from './IconButton.svelte';

  const el = $derived(ed.selectedElement);
  const many = $derived(ed.selection.length > 1);
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

  async function remove() {
    if (!el) return;
    const ok = await ask(`Delete “${elementLabel(el.name)}” from ${viewLabel(ed.view)}? You can undo this with Ctrl+Z.`, { title: 'Delete element', kind: 'warning', okLabel: 'Delete', cancelLabel: 'Cancel' });
    if (!ok) return;
    const r = ed.deleteElement(el.name);
    if (!r.removed) ed.notify('This element is shared with other screens, so it can’t be deleted here. Hide it with the eye button instead.', 'error');
  }

  const FIELDS = $derived([
    { k: 'X', help: 'Distance from the left edge of the screen', value: pct(pos[0]), set: (v: number) => setPair('pos', pos, 0, v) },
    { k: 'Y', help: 'Distance from the top edge of the screen', value: pct(pos[1]), set: (v: number) => setPair('pos', pos, 1, v) },
    { k: 'W', help: 'Width compared to the screen (0 keeps the proportions)', value: pct(size[0]), set: (v: number) => setPair(sizeProp, size, 0, v) },
    { k: 'H', help: 'Height compared to the screen (0 keeps the proportions)', value: pct(size[1]), set: (v: number) => setPair(sizeProp, size, 1, v) },
  ]);
</script>

<div class="ui-new flex flex-col gap-2.5 border-b px-3.5 py-3">
  {#if !many && el}
    <div class="grid grid-cols-4 gap-1.5">
      {#each FIELDS as f (f.k)}
        <label class="group flex h-8 items-center gap-1 rounded-lg bg-muted/60 pr-1.5 pl-2 ring-1 ring-transparent transition-all focus-within:bg-background focus-within:ring-ring hover:bg-muted" title={f.help}>
          <span class="text-[10.5px] font-semibold text-muted-foreground">{f.k}</span>
          <input class="no-spin w-full min-w-0 bg-transparent text-right font-mono text-xs tabular-nums outline-none" type="number" step="0.1" value={f.value} oninput={(e) => f.set(e.currentTarget.valueAsNumber)} />
          <span class="text-[10px] text-muted-foreground">%</span>
        </label>
      {/each}
    </div>
  {:else}
    <p class="m-0 flex items-center gap-2 text-sm font-medium"><LayersIcon class="size-4 text-muted-foreground" />{ed.selection.length} elements selected</p>
  {/if}

  <div class="flex items-center gap-0.5">
    <IconButton label={many ? 'Align left edges' : 'Move to the left edge'} onclick={() => ed.align('left')}><AlignStartVerticalIcon /></IconButton>
    <IconButton label={many ? 'Align centres' : 'Centre across the screen'} onclick={() => ed.align('hcenter')}><AlignCenterVerticalIcon /></IconButton>
    <IconButton label={many ? 'Align right edges' : 'Move to the right edge'} onclick={() => ed.align('right')}><AlignEndVerticalIcon /></IconButton>
    <IconButton label={many ? 'Align top edges' : 'Move to the top'} onclick={() => ed.align('top')}><AlignStartHorizontalIcon /></IconButton>
    <IconButton label={many ? 'Align middles' : 'Centre down the screen'} onclick={() => ed.align('vcenter')}><AlignCenterHorizontalIcon /></IconButton>
    <IconButton label={many ? 'Align bottom edges' : 'Move to the bottom'} onclick={() => ed.align('bottom')}><AlignEndHorizontalIcon /></IconButton>
    <span class="flex-1"></span>
    {#if many}
      <IconButton label="Space evenly across" disabled={ed.selection.length < 3} onclick={() => ed.distribute('h')}><DistributeHIcon /></IconButton>
      <IconButton label="Space evenly down" disabled={ed.selection.length < 3} onclick={() => ed.distribute('v')}><DistributeVIcon /></IconButton>
      <IconButton label="Duplicate" shortcut="Ctrl+D" onclick={() => ed.duplicate()}><CopyIcon /></IconButton>
      <IconButton label="Delete" shortcut="Del" onclick={() => ed.deleteSelection()}><Trash2Icon /></IconButton>
    {:else if el}
      <label class="flex h-7 items-center gap-1 rounded-md bg-muted/60 px-1.5 ring-1 ring-transparent focus-within:ring-ring" title="Layer: higher numbers are drawn on top">
        <LayersIcon class="size-3.5 text-muted-foreground" />
        <input class="no-spin w-8 bg-transparent text-right font-mono text-xs outline-none" type="number" step="1" value={zOf(el)} oninput={(e) => !Number.isNaN(e.currentTarget.valueAsNumber) && ed.setProp(el.name, 'zIndex', String(e.currentTarget.valueAsNumber))} />
      </label>
      <IconButton label={isVisible(el) ? 'Hide on this screen (saved to the theme)' : 'Show on this screen'} active={!isVisible(el)} onclick={() => ed.setProp(el.name, 'visible', isVisible(el) ? 'false' : 'true')}>
        {#if isVisible(el)}<EyeIcon />{:else}<EyeOffIcon />{/if}
      </IconButton>
      <IconButton label="Delete this element" onclick={remove}><Trash2Icon /></IconButton>
    {/if}
  </div>
</div>
