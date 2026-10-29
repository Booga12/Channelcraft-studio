<script lang="ts">
  // Simple mode's Properties: a few cards of visual controls instead of a list of settings. Each
  // part only gets the cards it uses; everything else is under "More settings".
  import './cards.css';
  import { untrack } from 'svelte';
  import EyeIcon from '@lucide/svelte/icons/eye';
  import EyeOffIcon from '@lucide/svelte/icons/eye-off';
  import LockIcon from '@lucide/svelte/icons/lock';
  import LockOpenIcon from '@lucide/svelte/icons/lock-open';
  import CopyPlusIcon from '@lucide/svelte/icons/copy-plus';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import PaintbrushIcon from '@lucide/svelte/icons/paintbrush';
  import PasteIcon from '@lucide/svelte/icons/clipboard-paste';
  import SearchIcon from '@lucide/svelte/icons/search';
  import GridIcon from '@lucide/svelte/icons/layout-grid';
  import { ed } from '$lib/editor.svelte';
  import { cards, CARD_PROPS, LOOK_PROPS } from '$lib/simpleCards.svelte';
  import { elementLabel, TYPE_LABELS, typeLabel, viewLabel } from '$lib/friendly';
  import { TYPE_ICON, isVisible } from '$lib/render';
  import { sharing } from '$lib/theme/edits';
  import { SCHEMA, specFor } from '$lib/theme/schema';
  import { SHADOW_TYPES, shaderOf } from '$lib/theme/shadow';
  import { frameOf } from '$lib/theme/frame';
  import { PICTURE_TYPES, pictureSize, TEXT_TYPES } from '$lib/theme/simpleProps';
  import type { ResolvedElement } from '$lib/theme/resolver';
  import TileStylePicker from '../TileStylePicker.svelte';
  import AnimationCard from './AnimationCard.svelte';
  import Card from './Card.svelte';
  import ColourCard from './ColourCard.svelte';
  import ColoursCard from './ColoursCard.svelte';
  import CornersCard from './CornersCard.svelte';
  import LooksCard from './LooksCard.svelte';
  import MoreCard from './MoreCard.svelte';
  import PictureCard from './PictureCard.svelte';
  import PositionCard from './PositionCard.svelte';
  import TextCard from './TextCard.svelte';

  let { el, inInspector = false, onremove }: { el: ResolvedElement; inInspector?: boolean; onremove: () => void } = $props();

  const isText = $derived(TEXT_TYPES.has(el.type));
  const isPicture = $derived(PICTURE_TYPES.has(el.type));
  const kind = $derived<'text' | 'picture' | null>(isText ? 'text' : isPicture ? 'picture' : null);
  const placed = $derived(!!SCHEMA[el.type]?.some((s) => s.name === 'pos') || el.props.has('pos'));
  /** Colour settings of parts that aren't texts (game lists, carousels…). */
  const colourProps = $derived.by(() => {
    if (isText) return [];
    const names = new Set([...el.props.keys(), ...(SCHEMA[el.type] ?? []).map((s) => s.name)]);
    return [...names].filter((p) => specFor(el.type, p).kind === 'color' && (el.props.has(p) || ['color', 'primaryColor', 'selectedColor', 'selectorColor', 'textColor'].includes(p)) && !(isPicture && p !== 'color'));
  });
  const covered = $derived.by(() => {
    const s = new Set(['visible']);
    if (placed) for (const p of ['pos', 'zIndex', 'opacity']) s.add(p);
    if (isText) for (const p of [...CARD_PROPS.text, ...CARD_PROPS.colour]) s.add(p);
    if (isPicture) {
      for (const p of ['path', 'default', 'roundCorners']) s.add(p);
      const size = pictureSize(el);
      if (size) s.add(size.prop);
    }
    for (const p of colourProps) s.add(p);
    return s;
  });

  const sharedViews = $derived.by(() => {
    const set = new Set<string>();
    for (const d of el.defs) for (const v of sharing(d).views) if (v !== ed.view) set.add(v);
    return [...set];
  });

  // ---- "Back to how it was" ----
  const key = $derived(`${ed.project?.dir}|${ed.screenFile}|${ed.view}|${el.name}`);
  $effect(() => {
    cards.forTheme(ed.project?.dir ?? '');
    cards.noteFirst(key, el);
  });
  $effect(() => {
    el.name;
    // The long-name check is for the text it was turned on for.
    untrack(() => {
      if (ed.settings.longNames) ed.settings.longNames = false;
    });
  });
  function resetter(card: string): (() => void) | null {
    ed.rev;
    const changed = cards.changed(key, el, card);
    if (!changed.length) return null;
    return () => {
      const was = cards.first(key)!;
      ed.group(`putting back ${elementLabel(el.name)}`, () => {
        for (const p of changed) {
          if (was[p] === null) ed.removeProp(el.name, p);
          else ed.setProp(el.name, p, was[p]!, { literal: true });
        }
      });
    };
  }

  // ---- header tools ----
  const visible = $derived(isVisible(el));
  const locked = $derived(!!ed.locked[el.name]);
  function lock() {
    ed.setLocked(el.name, !locked);
    ed.selection = [el.name];
  }
  const canPaste = $derived(!!kind && cards.copied?.kind === kind && cards.copied.from !== el.name);
  function copyLook() {
    if (!kind) return;
    const props: Record<string, string> = {};
    for (const p of LOOK_PROPS[kind]) {
      const d = el.props.get(p);
      if (d) props[p] = d.raw;
    }
    const sh = shaderOf(el);
    cards.copied = { kind, from: el.name, props, shadow: sh?.shadow ? sh.offset : null };
    ed.notify(`Copied how ${elementLabel(el.name)} looks. Pick another ${kind} and press Paste look.`);
  }
  function pasteLook() {
    const c = cards.copied;
    if (!c) return;
    const from = elementLabel(c.from);
    ed.group(`look of ${from} on ${elementLabel(el.name)}`, () => {
      if (Object.keys(c.props).length) ed.setProps(el.name, c.props);
      const now = ed.currentView?.elements.get(el.name);
      if (now && c.kind === 'picture' && SHADOW_TYPES.has(now.type) && !frameOf(now) && !(shaderOf(now) && !shaderOf(now)?.shadow)) ed.setShadow(now.name, c.shadow);
    });
    ed.notify(`${elementLabel(el.name)} now looks like ${from}. Ctrl+Z to undo.`);
  }
</script>

<div class="cards-panel">
  <div class="top">
    {#if !inInspector}
      <div class="title">
        <span class="ic">{TYPE_ICON[el.type] ?? '•'}</span>
        <div>
          <div class="label">{elementLabel(el.name)}</div>
          <div class="what">{typeLabel(el.type)}{TYPE_LABELS[el.type]?.help ? ` · ${TYPE_LABELS[el.type].help}` : ''}</div>
        </div>
      </div>
    {/if}
    {#if sharedViews.length}
      <p class="shared">Some of these settings also apply to {sharedViews.map((v) => viewLabel(v)).join(', ')}.</p>
    {/if}
    <div class="tools">
      <button class="small" class:on={!visible} onclick={() => ed.setProp(el.name, 'visible', visible ? 'false' : 'true', { literal: true })} title={visible ? 'Hide it on this screen without deleting it' : 'Show it again'}>
        {#if visible}<EyeIcon size={13} /> Hide{:else}<EyeOffIcon size={13} /> Hidden{/if}
      </button>
      <button class="small" class:on={locked} onclick={lock} title={locked ? 'Let it be moved again' : 'Stop it being moved by accident (Ctrl+L)'}>
        {#if locked}<LockIcon size={13} /> Locked{:else}<LockOpenIcon size={13} /> Lock{/if}
      </button>
      <button class="small" onclick={() => ed.duplicate()} title="Make a copy of it (Ctrl+D)"><CopyPlusIcon size={13} /> Copy part</button>
      <span class="sp"></span>
      <button class="small" onclick={onremove} title="Delete it from this screen"><TrashIcon size={13} /> Delete</button>
    </div>
    {#if kind}
      <div class="tools">
        <button class="small" onclick={copyLook} title="Remember how this looks, to give it to another {kind}"><PaintbrushIcon size={13} /> Copy look</button>
        <button class="small" disabled={!canPaste} onclick={pasteLook} title={cards.copied ? `Make it look like ${elementLabel(cards.copied.from)}` : `Copy the look of another ${kind} first`}>
          <PasteIcon size={13} /> Paste look{canPaste ? ` of ${elementLabel(cards.copied!.from)}` : ''}
        </button>
      </div>
    {/if}
    <label class="find">
      <SearchIcon size={14} />
      <input type="search" aria-label="Find a setting" placeholder="Find a setting… (try “glow” or “front”)" bind:value={cards.query} />
    </label>
  </div>

  <div class="cards">
    {#if kind}<LooksCard {el} {kind} />{/if}
    {#if isText}
      <TextCard {el} onreset={resetter('text')} />
      <ColourCard {el} onreset={resetter('colour')} />
    {/if}
    {#if isPicture}<PictureCard {el} />{/if}
    {#if colourProps.length}<ColoursCard {el} props={colourProps} />{/if}
    {#if placed}<PositionCard {el} onreset={resetter('position')} />{/if}
    {#if isPicture}<CornersCard {el} />{/if}
    {#if ed.tileStyle !== null && (el.type === 'imagegrid' || el.type === 'gridtile' || el.name.startsWith('gridtile'))}
      <Card id="tiles" title="Tile style" icon={GridIcon} words="tile grid">
        <TileStylePicker />
      </Card>
    {/if}
    {#if placed}<AnimationCard {el} />{/if}
    <MoreCard {el} {covered} />
    {#if cards.query.trim()}
      <p class="nofind">Can't find it? Try other words, or look in Advanced mode, which shows every setting.</p>
    {/if}
  </div>
</div>

<style>
  /* The top stays in view while scrolling, unless the window is too short to spare the room. */
  @media (max-height: 720px) {
    .top {
      position: static !important;
    }
  }
  .top {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--panel-2);
    border-bottom: 1px solid var(--line);
    padding: 12px 12px 10px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
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
    border-radius: 8px;
    font-size: 15px;
    color: var(--brand);
    flex: none;
  }
  .label {
    font-weight: 600;
    font-size: 14px;
  }
  .what {
    font-size: 11px;
    color: var(--text-faint);
  }
  .shared {
    margin: 0;
    font-size: 12px;
    color: var(--warn);
  }
  .tools {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .tools button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .tools button.on {
    border-color: var(--brand);
    background: var(--brand-soft);
  }
  .sp {
    flex: 1;
  }
  .find {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-faint);
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: 7px;
    padding: 0 8px;
  }
  .find input {
    flex: 1;
    border: 0;
    background: none;
    padding: 5px 0;
    outline: none;
    min-width: 0;
    color: var(--text);
  }
  .find:focus-within {
    border-color: var(--brand);
  }
  .cards {
    padding: 10px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }
  .nofind {
    margin: 0;
    font-size: 12px;
    color: var(--text-faint);
    text-align: center;
  }
</style>
