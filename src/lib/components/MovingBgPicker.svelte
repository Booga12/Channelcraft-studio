<script lang="ts">
  // Picks the moving background: scenes in groups, each with a small preview in the theme's
  // colours that plays while you point at it. Warns when the theme's own pictures would cover it.
  import { ed } from '$lib/editor.svelte';
  import { drawMovingBg, H, MOVING_BGS, MOVING_GROUPS, W } from '$lib/theme/movingBg';
  import type { Palette6 } from '$lib/theme/designs';
  import type { SceneGroup } from '$lib/theme/movingScenes';
  import Icon from './Icon.svelte';

  let { busy = false, onpick }: { busy?: boolean; onpick: (id: string | null) => void } = $props();

  const current = $derived(ed.movingBg());
  let group = $state<SceneGroup>(MOVING_BGS.find((b) => b.id === ed.movingBg())?.group ?? 'shapes');
  const shown = $derived(MOVING_BGS.filter((b) => b.group === group));
  const colours = $derived(ed.designColours());
  const covers = $derived(ed.movingBgCovers());
  const currentLabel = $derived(MOVING_BGS.find((b) => b.id === current)?.label);

  /** Arrow keys (and Home/End) move to the next kind and pick it; the chips are one Tab stop. */
  function chipKeys(ev: KeyboardEvent) {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const step = steps[ev.key];
    if (!step && ev.key !== 'Home' && ev.key !== 'End') return;
    const items = [...(ev.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    ev.preventDefault();
    const n = ev.key === 'Home' ? 0 : ev.key === 'End' ? items.length - 1 : (i + (step ?? 0) + items.length) % items.length;
    items[n].focus();
    items[n].click();
  }

  const TW = 320;
  const TH = 180;

  function draw(canvas: HTMLCanvasElement, id: string, p: Palette6 | null, t: number) {
    const c = canvas.getContext('2d');
    if (!c || !p) return;
    c.setTransform(TW / W, 0, 0, TH / H, 0, 0);
    drawMovingBg(c, id, p, t);
  }

  /** Draws a still of the scene, and plays it while the tile is pointed at or focused. */
  function thumb(canvas: HTMLCanvasElement, arg: { id: string; p: Palette6 | null }) {
    let a = arg;
    let raf = 0;
    let start = 0;
    const still = () => draw(canvas, a.id, a.p, 0.15);
    const frame = (now: number) => {
      start ||= now;
      draw(canvas, a.id, a.p, (0.15 + (now - start) / 8000) % 1);
      raf = requestAnimationFrame(frame);
    };
    const play = () => {
      cancelAnimationFrame(raf);
      start = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      still();
    };
    const host = canvas.closest('button') ?? canvas;
    const events: [string, () => void][] = [
      ['mouseenter', play],
      ['mouseleave', stop],
      ['focus', play],
      ['blur', stop],
    ];
    for (const [e, f] of events) host.addEventListener(e, f);
    still();
    return {
      update(next: { id: string; p: Palette6 | null }) {
        a = next;
        if (!raf) still();
      },
      destroy() {
        cancelAnimationFrame(raf);
        for (const [e, f] of events) host.removeEventListener(e, f);
      },
    };
  }
</script>

<div class="flex flex-col gap-1.5">
  <div class="head">
    <span class="text-xs font-medium">Moving background</span>
    <button class="still" class:on={current === null} aria-current={current === null ? 'true' : undefined} disabled={busy} onclick={() => onpick(null)} title="The design’s own picture, not moving">
      {#if current === null}<Icon name="check" size={11} />{/if}Still
    </button>
  </div>
  {#if currentLabel}<p class="text-xs text-muted-foreground">Playing now: <b>{currentLabel}</b></p>{/if}
  {#if covers.length}
    <p class="warn">
      RetroBat draws {ed.movingBgCoverText()} on top of the moving background, so you can't see it there.
      <button class="small" onclick={() => ed.hideMovingBgCovers()}>Hide them</button>
    </p>
  {/if}
  <div class="chips" role="radiogroup" aria-label="Kind of moving background" tabindex="-1" onkeydown={chipKeys}>
    {#each MOVING_GROUPS as g, i (g.id)}
      <button type="button" role="radio" aria-checked={group === g.id} tabindex={group === g.id || (i === 0 && !MOVING_GROUPS.some((x) => x.id === group)) ? 0 : -1} class:on={group === g.id} onclick={() => (group = g.id)}>
        {g.label}<span class="n">{MOVING_BGS.filter((b) => b.group === g.id).length}</span>
      </button>
    {/each}
  </div>
  <div class="tiles">
    {#each shown as m (m.id)}
      <button class="tile" class:on={current === m.id} aria-pressed={current === m.id} disabled={busy} onclick={() => onpick(m.id)} title={m.help}>
        <canvas width={TW} height={TH} use:thumb={{ id: m.id, p: colours }}></canvas>
        <span class="name">
          {#if current === m.id}<Icon name="check" size={11} />{/if}
          {m.label}
        </span>
      </button>
    {/each}
  </div>
  <p class="text-xs text-muted-foreground">Point at one to see it move. Picking one makes a short video in your colours (a few seconds) that loops behind everything. After changing colours, pick it again to redraw it.</p>
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .still {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    padding: 2px 10px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
    font-size: 11.5px;
    font-weight: 600;
  }
  .still.on {
    border-color: var(--brand);
    color: var(--brand);
  }
  .warn {
    margin: 0;
    color: var(--warn);
    font-size: 11.5px;
    line-height: 1.4;
  }
  .warn button {
    margin-top: 4px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .chips button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg);
    color: var(--text-dim);
    font-size: 11.5px;
    font-weight: 600;
  }
  .chips button:hover {
    color: var(--text);
    border-color: var(--brand);
  }
  .chips button.on {
    color: var(--brand);
    border-color: var(--brand);
  }
  .n {
    color: var(--text-faint);
    font-size: 10.5px;
  }
  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .tile {
    display: grid;
    gap: 4px;
    padding: 5px;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 6px;
    text-align: left;
  }
  .tile:hover:not(:disabled) {
    border-color: var(--brand);
  }
  .tile.on {
    border-color: var(--brand);
    box-shadow: 0 0 0 1px var(--brand);
  }
  canvas {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 4px;
    display: block;
  }
  .name {
    display: flex;
    gap: 4px;
    align-items: center;
    font-size: 11.5px;
    font-weight: 600;
  }
  .tile.on .name {
    color: var(--brand);
  }
</style>
