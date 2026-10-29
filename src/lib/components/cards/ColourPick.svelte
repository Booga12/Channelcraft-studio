<script lang="ts">
  // A colour setting as swatches: the theme's own colours (picking one links to it), a few basic
  // ones, any colour, one picked from the screen, and recent picks. A colour shared through the
  // theme asks whether a change goes everywhere or only here.
  import { tick } from 'svelte';
  import PipetteIcon from '@lucide/svelte/icons/pipette';
  import { ed } from '$lib/editor.svelte';
  import { cards } from '$lib/simpleCards.svelte';
  import { varRef } from '$lib/theme/edits';
  import { cssColor } from '$lib/theme/schema';
  import { BASIC_SWATCHES, hex8, themeSwatches, varUsers } from '$lib/theme/simpleProps';
  import { humanize } from '$lib/friendly';
  import type { ResolvedElement } from '$lib/theme/resolver';

  let { el, prop }: { el: ResolvedElement; prop: string } = $props();

  const def = $derived(el.props.get(prop));
  const linked = $derived.by(() => {
    const v = def ? varRef(def.raw) : null;
    return v && ed.res?.vars.has(v) ? v : null;
  });
  const current = $derived(hex8(def?.value) ?? 'FFFFFFFF');
  const swatches = $derived(ed.res ? themeSwatches(ed.res, ed.view) : []);
  const users = $derived(linked && ed.res ? varUsers(ed.res, linked) : 0);
  const canDrop = typeof window !== 'undefined' && 'EyeDropper' in window;
  /** A colour waiting for "everywhere" or "just this one". */
  let pending = $state<string | null>(null);

  $effect(() => {
    el.name;
    prop;
    pending = null;
    opener = null;
  });

  // The swatch rows are one Tab stop each (the chosen swatch, or the first); the arrow keys move
  // along them and Enter or Space picks.
  const basicOn = (h: string) => !linked && current.slice(0, 6) === h.slice(0, 6);
  const stop = $derived.by(() => {
    if (linked && swatches.some((s) => s.name === linked)) return `t${linked}`;
    const b = BASIC_SWATCHES.find(basicOn);
    if (b) return `b${b}`;
    return swatches.length ? `t${swatches[0].name}` : `b${BASIC_SWATCHES[0]}`;
  });
  let box: HTMLDivElement;
  let wrap: HTMLDivElement;
  let askBox = $state<HTMLDivElement>();
  /** The swatch that asked "everywhere or just this one", to go back to after. */
  let opener: HTMLElement | null = null;

  function rove(e: KeyboardEvent) {
    const me = e.currentTarget as HTMLElement;
    const items = [...me.parentElement!.querySelectorAll<HTMLElement>(':scope > [data-rove]')];
    const i = items.indexOf(me);
    const n = items.length;
    const k = e.key;
    const j = k === 'ArrowRight' || k === 'ArrowDown' ? (i + 1) % n : k === 'ArrowLeft' || k === 'ArrowUp' ? (i - 1 + n) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : -1;
    if (j < 0) return;
    // Kept from the editor's own arrow keys (they move the selected part).
    e.preventDefault();
    e.stopPropagation();
    items[j].focus();
  }

  /** After the question or the "linked" line goes away, focus goes back to the swatches. */
  async function backToSwatches() {
    const to = opener;
    opener = null;
    await tick();
    (to?.isConnected ? to : box?.querySelector<HTMLElement>('[data-rove][tabindex="0"]'))?.focus();
  }

  const colourName = (v: string) => humanize(v.replace(/^design(?=[A-Z])/, ''));
  /** Keeps the setting's own see-through amount. */
  const withAlpha = (hex: string) => hex.slice(0, 6) + current.slice(6, 8);

  function pick(hex: string) {
    const v = withAlpha(hex.toUpperCase());
    if (linked && users > 1) {
      pending = v;
      // Only a control of this picker (not the page body, after the screen picker).
      const active = document.activeElement;
      opener = active instanceof HTMLElement && wrap?.contains(active) ? active : null;
      // The question takes focus, so it is heard and answered straight away.
      tick().then(() => askBox?.querySelector<HTMLButtonElement>('button')?.focus());
      return;
    }
    // A theme colour only this part uses is simply changed.
    ed.setProp(el.name, prop, v, { literal: !linked });
  }

  function link(name: string) {
    pending = null;
    ed.setProp(el.name, prop, `\${${name}}`, { literal: true });
  }

  function custom(hex: string) {
    const v = hex.replace('#', '').toUpperCase() + 'FF';
    cards.remember(v);
    pick(v);
  }

  async function fromScreen() {
    try {
      const EyeDropper = (window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
      const r = await new EyeDropper().open();
      custom(r.sRGBHex);
    } catch {
      // Cancelled with Esc.
    }
  }
</script>

<div class="pick" bind:this={wrap}>
  <div class="swatches" bind:this={box}>
    {#each swatches as s (s.name)}
      <button class="sw" class:on={linked === s.name} aria-current={linked === s.name ? 'true' : undefined} data-rove tabindex={stop === `t${s.name}` ? 0 : -1} style:--c={cssColor(s.hex)} title="The theme's {colourName(s.name).toLowerCase()} colour" aria-label="Theme colour {colourName(s.name)}" onclick={() => link(s.name)} onkeydown={rove}></button>
    {/each}
    {#if swatches.length}<span class="gap"></span>{/if}
    {#each BASIC_SWATCHES as h (h)}
      <button class="sw" class:on={basicOn(h)} aria-current={basicOn(h) ? 'true' : undefined} data-rove tabindex={stop === `b${h}` ? 0 : -1} style:--c={cssColor(h)} title="#{h.slice(0, 6)}" aria-label="Colour #{h.slice(0, 6)}" onclick={() => pick(h)} onkeydown={rove}></button>
    {/each}
    <label class="sw any" title="Pick any colour">
      <input type="color" value="#{current.slice(0, 6)}" aria-label="Pick any colour" onchange={(e) => custom(e.currentTarget.value)} />
    </label>
    {#if canDrop}
      <button class="sw drop" title="Pick a colour from anywhere on the screen" aria-label="Pick a colour from the screen" onclick={fromScreen}><PipetteIcon size={13} /></button>
    {/if}
  </div>

  {#if cards.recent.length}
    <div class="recent">
      <span>Recent</span>
      {#each cards.recent as h, i (h)}
        <button class="sw small" data-rove tabindex={i === 0 ? 0 : -1} style:--c={cssColor(h)} title="#{h.slice(0, 6)}" aria-label="Recent colour #{h.slice(0, 6)}" onclick={() => pick(h)} onkeydown={rove}></button>
      {/each}
    </div>
  {/if}

  {#if pending}
    <div class="ask" role="group" aria-labelledby="ask-{el.name}-{prop}" bind:this={askBox}>
      <div id="ask-{el.name}-{prop}">
        This uses the theme's <b>{colourName(linked ?? '').toLowerCase()}</b> colour, shared by {users} parts. Change it where?
      </div>
      <div class="two">
        <button
          class="small"
          onclick={() => {
            ed.setProp(el.name, prop, pending!);
            pending = null;
            backToSwatches();
          }}>Change everywhere ({users})</button
        >
        <button
          class="small"
          onclick={() => {
            ed.setProp(el.name, prop, pending!, { literal: true });
            pending = null;
            backToSwatches();
          }}>Just this one</button
        >
      </div>
      <button
        class="ghost small cancel"
        onclick={() => {
          pending = null;
          backToSwatches();
        }}>Cancel</button
      >
    </div>
  {:else if linked}
    <div class="linked">
      <span class="dot" style:--c={cssColor(current)}></span>
      <span>Uses the theme's <b>{colourName(linked).toLowerCase()}</b> colour{users > 1 ? ` · ${users} parts use it` : ''}</span>
      <button
        class="ghost small"
        title="Give only this part its own colour"
        onclick={() => {
          ed.setProp(el.name, prop, current, { literal: true });
          backToSwatches();
        }}>Just this one</button
      >
    </div>
  {/if}
</div>

<style>
  .pick {
    display: grid;
    gap: 8px;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .gap {
    width: 1px;
    height: 18px;
    background: var(--line-strong);
    margin: 0 2px;
  }
  .sw {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    padding: 0;
    border: 2px solid var(--line-strong);
    background:
      linear-gradient(var(--c), var(--c)),
      repeating-conic-gradient(var(--checker-a) 0 25%, var(--checker-b) 0 50%) 0 0 / 8px 8px;
    position: relative;
    flex: none;
    cursor: pointer;
  }
  .sw.small {
    width: 18px;
    height: 18px;
  }
  .sw.on {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  /* Focus has to differ from the chosen swatch's ring; the "any colour" input is invisible, so its
     round shows the focus. */
  .sw:focus-visible,
  .sw.any:has(input:focus-visible) {
    outline: 2px solid var(--text);
    outline-offset: 2px;
  }
  .sw.any {
    background: conic-gradient(#f44, #fd4, #4e4, #4ef, #44f, #e4e, #f44);
    overflow: hidden;
  }
  .sw.any input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .sw.drop {
    background: var(--raised);
    display: grid;
    place-items: center;
    color: var(--text-dim);
  }
  .recent {
    display: flex;
    gap: 5px;
    align-items: center;
    font-size: 11px;
    color: var(--text-faint);
  }
  .linked,
  .ask {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 7px 9px;
    border-radius: 8px;
    background: var(--brand-soft);
    font-size: 12px;
  }
  .ask {
    display: grid;
  }
  .linked .ghost {
    margin-left: auto;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--c);
    border: 1px solid var(--line-strong);
    flex: none;
  }
  .two {
    display: flex;
    gap: 6px;
  }
  .two button {
    flex: 1;
  }
  .cancel {
    justify-self: start;
  }
</style>
