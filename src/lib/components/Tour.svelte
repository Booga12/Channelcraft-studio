<script lang="ts">
  // The first-run tour: a spotlight on the real controls, one short step at a time. Shows once,
  // the first time a theme is open; Help → Take the tour shows it again. Steps whose control
  // isn't on screen are skipped.
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { ed } from '$lib/editor.svelte';

  interface Step {
    target: string;
    title: string;
    text: string;
  }

  const STEPS: Step[] = [
    { target: 'preview', title: 'This is your theme', text: 'The preview shows a screen as RetroBat draws it. Click any part to change it; drag it to move it.' },
    { target: 'dock', title: 'Your tools', text: 'Add pictures, text and more with the + button. The buttons below open Layers, Colours and the other panels.' },
    { target: 'panel-presets', title: 'Restyle in one click', text: 'Presets has whole designs, layouts and colour sets. Try one: Ctrl+Z puts everything back.' },
    { target: 'search', title: 'Can’t find something?', text: 'Search finds any command, part or setting by name. Shortcut: Ctrl+K.' },
    { target: 'save', title: 'Save when you like it', text: 'Nothing is written to your theme until you save, and a backup is made first.' },
    { target: 'try', title: 'See it on the TV', text: 'Try in RetroBat saves, switches RetroBat to this theme and starts it, so you see it for real.' },
  ];

  const find = (s: Step) => document.querySelector<HTMLElement>(`[data-tour="${s.target}"]`);
  let steps = $state<Step[]>([]);
  let at = $state(0);
  let box = $state<{ x: number; y: number; w: number; h: number } | null>(null);
  let bubble = $state({ x: 0, y: 0 });
  let bubbleEl = $state<HTMLElement>();

  onMount(() => {
    steps = STEPS.filter((s) => find(s)?.getClientRects().length);
    if (!steps.length) ed.closeTour();
  });

  const step = $derived(steps[at]);

  function measure() {
    const el = step && find(step);
    if (!el) return;
    // Rects are window points; the page may be zoomed (UI size), so styles use them / zoom.
    const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const r = el.getBoundingClientRect();
    const pad = 6;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const x = Math.max(4, r.left - pad);
    const y = Math.max(4, r.top - pad);
    const w = Math.min(W - 4, r.right + pad) - x;
    const h = Math.min(H - 4, r.bottom + pad) - y;
    box = { x: x / z, y: y / z, w: w / z, h: h / z };
    // The bubble goes beside the control where there's room: right, below, left, above, inside.
    const bw = (bubbleEl?.offsetWidth ?? 300) * z;
    const bh = (bubbleEl?.offsetHeight ?? 150) * z;
    const gap = 12;
    const clampX = (v: number) => Math.max(8, Math.min(v, W - bw - 8));
    const clampY = (v: number) => Math.max(8, Math.min(v, H - bh - 8));
    let p: { x: number; y: number };
    if (x + w + gap + bw < W && w < W * 0.6) p = { x: x + w + gap, y: clampY(y) };
    else if (y + h + gap + bh < H) p = { x: clampX(x), y: y + h + gap };
    else if (x - gap - bw > 0 && w < W * 0.6) p = { x: x - gap - bw, y: clampY(y) };
    else if (y - gap - bh > 0) p = { x: clampX(x), y: y - gap - bh };
    else p = { x: clampX(x + w / 2 - bw / 2), y: clampY(y + h / 2 - bh / 2) };
    bubble = { x: p.x / z, y: p.y / z };
  }

  $effect(() => {
    void step;
    void bubbleEl;
    measure();
    // Once more after the bubble has its size and anything sliding in has settled.
    const t = setTimeout(measure, 60);
    return () => clearTimeout(t);
  });

  function next() {
    if (at < steps.length - 1) at++;
    else ed.closeTour();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') ed.closeTour();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
    else if (e.key === 'ArrowLeft' && at > 0) at--;
    else return;
    e.preventDefault();
    e.stopPropagation();
  }
</script>

<svelte:window onresize={measure} onkeydowncapture={onkeydown} />

{#if step && box}
  <div class="shield" role="presentation" onpointerdown={(e) => e.preventDefault()}></div>
  <div class="spot" style:left="{box.x}px" style:top="{box.y}px" style:width="{box.w}px" style:height="{box.h}px"></div>
  <div class="ui-new bubble" bind:this={bubbleEl} style:left="{bubble.x}px" style:top="{bubble.y}px" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
    <p class="count">{at + 1} of {steps.length}</p>
    <h2 id="tour-title">{step.title}</h2>
    <p id="tour-text">{step.text}</p>
    <div class="row">
      <button class="skip" onclick={() => ed.closeTour()}>{at < steps.length - 1 ? 'Skip tour' : ''}</button>
      {#if at > 0}<Button size="sm" variant="outline" onclick={() => at--}>Back</Button>{/if}
      <!-- svelte-ignore a11y_autofocus -->
      <Button size="sm" onclick={next} autofocus>{at < steps.length - 1 ? 'Next' : 'Start editing'}</Button>
    </div>
  </div>
{/if}

<style>
  .shield {
    position: fixed;
    inset: 0;
    z-index: 90;
  }
  .spot {
    position: fixed;
    z-index: 91;
    border-radius: 12px;
    box-shadow:
      0 0 0 3px var(--primary),
      0 0 0 9999px rgb(0 0 0 / 0.55);
    pointer-events: none;
    transition:
      left 0.25s ease,
      top 0.25s ease,
      width 0.25s ease,
      height 0.25s ease;
  }
  .bubble {
    position: fixed;
    z-index: 92;
    width: min(320px, calc(100vw - 32px));
    padding: 16px;
    border-radius: 14px;
    background: var(--popover);
    color: var(--popover-foreground);
    box-shadow: 0 12px 40px rgb(0 0 0 / 0.35);
    transition:
      left 0.25s ease,
      top 0.25s ease;
  }
  .count {
    margin: 0;
    font-size: 11px;
    color: var(--muted-foreground);
  }
  h2 {
    margin: 2px 0 6px;
    font-size: 15px;
    font-weight: 600;
  }
  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 14px;
  }
  .skip {
    margin-right: auto;
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    font-size: 12px;
    color: var(--muted-foreground);
    cursor: pointer;
  }
</style>
