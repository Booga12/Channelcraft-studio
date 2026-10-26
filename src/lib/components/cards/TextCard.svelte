<script lang="ts">
  // What a text says (picked from RetroBat's game and console details, or your own words), its
  // font, size, alignment and capitals, and a check that long names still fit.
  import { tick } from 'svelte';
  import TypeIcon from '@lucide/svelte/icons/type';
  import AlignStart from '@lucide/svelte/icons/text-align-start';
  import AlignCenter from '@lucide/svelte/icons/text-align-center';
  import AlignEnd from '@lucide/svelte/icons/text-align-end';
  import { ed } from '$lib/editor.svelte';
  import { cards } from '$lib/simpleCards.svelte';
  import { familyFor, fontState } from '$lib/preview.svelte';
  import { join } from '$lib/path';
  import { fmtNum } from '$lib/theme/schema';
  import { resolveAsset, type ResolvedElement } from '$lib/theme/resolver';
  import { FONT_SIZES, sizeName, TEXT_SOURCES, textKind, type FontSizeName } from '$lib/theme/simpleProps';
  import AssetInput from '../AssetInput.svelte';
  import Card from './Card.svelte';
  import Seg from './Seg.svelte';

  let { el, onreset }: { el: ResolvedElement; onreset: (() => void) | null } = $props();

  const textDef = $derived(el.props.get('text'));
  const kind = $derived(textKind(textDef?.raw ?? ''));
  const hasText = $derived(el.type === 'text');
  const onConsole = $derived(ed.view === 'system');
  const sources = $derived(TEXT_SOURCES.filter((s) => !s.game || !onConsole));
  let choosing = $state(false);
  let own = $state('');
  $effect(() => {
    own = kind.kind === 'own' ? (textDef?.raw ?? '') : '';
  });

  const what = $derived(kind.kind === 'source' ? kind.source.label : kind.kind === 'own' ? (textDef?.raw ? 'Your own words' : 'Nothing yet') : 'Worked out by the theme');
  /** Names can be long: the preview can try a long one. */
  const showsName = $derived(kind.kind === 'source' ? kind.source.id === 'system' || kind.source.id === 'game' : kind.kind === 'theme' && /name/i.test(textDef?.raw ?? ''));

  function setText(v: string) {
    choosing = false;
    ed.setProp(el.name, 'text', v, { literal: true });
  }

  // ---- font ----
  const fontDef = $derived(el.props.get('fontPath'));
  const fontAbs = $derived(ed.res && ed.project ? resolveAsset(fontDef, ed.res, ed.project, ed.env) : null);
  const fontName = (path: string) =>
    path
      .replace(/^.*[\\/]/, '')
      .replace(/\.[^.]+$/, '')
      .replace(/\[.*?\]|-(Regular|VariableFont.*)$/gi, '')
      .replace(/[-_]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim() || 'Font';
  const themeFonts = $derived.by(() => {
    ed.rev;
    const p = ed.project;
    if (!p) return [];
    return p.assets.filter((a) => a.kind === 'font').slice(0, 8).map((a) => ({ rel: a.rel, abs: join(p.dir, a.rel) }));
  });
  let moreFonts = $state(false);
  const sameFile = (a: string | null, b: string) => !!a && a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase();
  function useFont(abs: string) {
    ed.setProp(el.name, 'fontPath', ed.relativeAssetPath(el.name, 'fontPath', abs), { literal: true });
  }

  // ---- size ----
  const size = $derived(parseFloat(el.props.get('fontSize')?.value ?? '') || 0.035);
  const named = $derived(sizeName(size));
  const align = $derived((el.props.get('alignment')?.value ?? 'left').trim().toLowerCase());
  const caps = $derived(/^(true|1)$/i.test(el.props.get('forceUppercase')?.value?.trim() ?? ''));

  // ---- does it fit? ----
  let lines = $state(1);
  /** How many lines the text takes in the preview. */
  function measure(): number {
    const node = document.querySelector<HTMLElement>(`.stage .el[data-name="${CSS.escape(el.name)}"] .text`);
    if (!node || !node.textContent?.trim()) return 1;
    const range = document.createRange();
    range.selectNodeContents(node);
    const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
    return Math.max(1, tops.size);
  }
  $effect(() => {
    ed.rev;
    ed.settings.longNames;
    fontState.loaded;
    el.name;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => (lines = measure())));
    return () => cancelAnimationFrame(id);
  });
  let fitting = $state(false);
  /** Makes the text smaller, step by step, until it fits on one line (one undo step). */
  async function fit() {
    fitting = true;
    let s = size;
    for (let i = 0; i < 14 && measure() > 1 && s > 0.012; i++) {
      s = Math.round(s * 0.93 * 1000) / 1000;
      ed.setProp(el.name, 'fontSize', fmtNum(s), { coalesce: `fit.${el.name}` });
      await tick();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    fitting = false;
    lines = measure();
    ed.notify(lines > 1 ? 'It still needs two lines at a readable size. Try a shorter font, or a wider box in Advanced mode.' : 'Made it smaller so it fits on one line. Ctrl+Z to undo.');
  }
</script>

<Card id="text" title="Text" icon={TypeIcon} summary={what} words="font size alignment capitals" {onreset}>
  {#if hasText}
    <div class="row">
      <div class="lbl">What it says</div>
      <button class="chip" onclick={() => (choosing = !choosing)} aria-expanded={choosing}>
        <span>{what}</span>
        <span class="tag">{kind.kind === 'source' ? 'filled in by RetroBat' : ''} ▾</span>
      </button>
      {#if choosing}
        <div class="menu">
          {#each sources as s (s.id)}
            <button onclick={() => setText(s.code)}>{s.label}</button>
          {/each}
          <button onclick={() => setText(own || 'My text')}>Your own words…</button>
        </div>
      {/if}
      {#if kind.kind === 'own'}
        <input type="text" bind:value={own} placeholder="Type the words to show" onchange={() => setText(own)} />
      {:else if kind.kind === 'theme'}
        <p class="note">Shows “{textDef?.value || '…'}” here. The exact recipe is in Advanced mode.</p>
      {/if}
      {#if onConsole && /\{game:/i.test(textDef?.raw ?? '')}
        <p class="warn">The console screen has no current game, so this stays empty there. Pick a console detail instead.</p>
      {/if}
    </div>
  {/if}

  {#if showsName}
    <label class="switch">
      <span>Try with a long name</span>
      <input type="checkbox" checked={!!ed.settings.longNames} onchange={(e) => (ed.settings.longNames = e.currentTarget.checked)} />
    </label>
  {/if}
  {#if lines > 1}
    <div class="alert">
      <div><b>Goes onto {lines} lines</b>{ed.settings.longNames ? ' with a long name' : ''}. Make it smaller so it fits on one?</div>
      <button class="small" onclick={fit} disabled={fitting}>{fitting ? 'Making it fit…' : 'Make it fit'}</button>
    </div>
  {/if}

  <div class="row">
    <div class="lbl">Font <b>{fontDef ? fontName(fontDef.value) : 'RetroBat’s own'}</b></div>
    {#if themeFonts.length}
      <div class="fonts">
        {#each themeFonts as f (f.rel)}
          <button class:on={sameFile(fontAbs, f.abs)} style:font-family={familyFor(f.abs)} title={f.rel} onclick={() => useFont(f.abs)}>{fontName(f.rel)}</button>
        {/each}
      </div>
    {/if}
    <button class="ghost small more" onclick={() => (moreFonts = !moreFonts)}>{moreFonts ? 'Hide other fonts' : 'More fonts: free ones, or from your PC…'}</button>
    {#if moreFonts}
      <AssetInput value={fontDef?.raw ?? ''} kind="font" resolved={fontAbs} toRelative={(abs) => ed.relativeAssetPath(el.name, 'fontPath', abs)} onchange={(v) => ed.setProp(el.name, 'fontPath', v, { literal: true })} />
    {/if}
  </div>

  <div class="row">
    <div class="lbl">Size <b>{Math.round(size * 1000) / 10}% of the screen</b></div>
    <Seg
      label="Text size"
      options={(Object.keys(FONT_SIZES) as FontSizeName[]).map((k) => ({ id: k, label: k, title: { S: 'Small', M: 'Medium', L: 'Large', XL: 'Extra large' }[k] }))}
      value={named}
      onpick={(k) => ed.setProp(el.name, 'fontSize', fmtNum(FONT_SIZES[k]))}
    />
    <input type="range" min="0.015" max="0.15" step="0.001" value={size} aria-label="Text size" oninput={(e) => ed.setProp(el.name, 'fontSize', fmtNum(e.currentTarget.valueAsNumber), { coalesce: `size.${el.name}` })} />
  </div>

  <div class="row">
    <div class="lbl">Line up</div>
    <Seg
      label="Line up"
      options={[
        { id: 'left', label: 'Left', icon: AlignStart },
        { id: 'center', label: 'Middle', icon: AlignCenter },
        { id: 'right', label: 'Right', icon: AlignEnd },
      ]}
      value={align === 'center' || align === 'right' ? align : 'left'}
      onpick={(v) => ed.setProp(el.name, 'alignment', v)}
    />
  </div>

  <label class="switch">
    <span>ALL CAPITALS</span>
    <input type="checkbox" checked={caps} onchange={(e) => ed.setProp(el.name, 'forceUppercase', e.currentTarget.checked ? 'true' : 'false')} />
  </label>
</Card>

<style>
  .fonts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 6px;
  }
  .fonts button {
    border: 1px solid var(--line-strong);
    background: var(--bg);
    border-radius: 8px;
    padding: 7px 6px;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .fonts button.on {
    border-color: var(--brand);
    background: var(--brand-soft);
  }
  .more {
    justify-self: start;
    color: var(--brand);
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 9px;
    border-radius: 8px;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    width: 100%;
    text-align: left;
  }
  .chip .tag {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-faint);
  }
  .menu {
    display: grid;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    overflow: hidden;
    background: var(--bg);
    max-height: 240px;
    overflow-y: auto;
  }
  .menu button {
    border: 0;
    border-radius: 0;
    background: none;
    text-align: left;
    padding: 6px 10px;
  }
  .menu button:hover {
    background: var(--hover);
  }
</style>
