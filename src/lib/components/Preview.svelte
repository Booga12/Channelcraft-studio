<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import { bindingValue, screenSize } from '$lib/theme/context';
  import type { ExprEnv } from '$lib/theme/expr';
  import { assetExists, resolveAsset } from '$lib/theme/resolver';
  import { fmtNum, parsePair } from '$lib/theme/schema';
  import { isCarouselPart, isVisible, zOf } from '$lib/render';
  import type { SystemInfo } from '$lib/theme/systems';
  import { elementLabel } from '$lib/friendly';
  import Icon from './Icon.svelte';
  import PreviewElement from './PreviewElement.svelte';

  let host: HTMLDivElement;
  let cw = $state(800);
  let ch = $state(450);

  $effect(() => {
    const ro = new ResizeObserver(([e]) => {
      cw = e.contentRect.width;
      ch = e.contentRect.height;
    });
    ro.observe(host);
    return () => ro.disconnect();
  });

  const dims = $derived(screenSize(ed.settings));
  // The host's padding is already outside contentRect.
  const fitScale = $derived(Math.max(0.05, Math.min((cw - 2) / dims.width, (ch - 2) / dims.height)));
  const scale = $derived(ed.zoom === 'fit' ? fitScale : ed.zoom);

  const STEPS = [0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2];
  function zoomBy(dir: 1 | -1) {
    const cur = scale;
    const next = dir > 0 ? STEPS.find((s) => s > cur + 0.001) : [...STEPS].reverse().find((s) => s < cur - 0.001);
    ed.zoom = next ?? cur;
  }

  function onwheel(e: WheelEvent) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1 : -1);
  }

  const exprEnv = $derived.by<ExprEnv>(() => {
    const subsets = new Map((ed.res?.subsets ?? []).map((s) => [s.name, s.selected]));
    const env = ed.env;
    const project = ed.project!;
    return {
      binding: (n) => bindingValue(n, env, subsets),
      exists: (p) => assetExists(p, project, env),
    };
  });

  const drawn = $derived.by(() => {
    const v = ed.currentView;
    if (!v) return [];
    return [...v.elements.values()]
      .filter(
        (e) =>
          !ed.hidden[e.name] &&
          !isCarouselPart(ed.view, e) &&
          // Grid tiles and their parts (gridtile.image, ...) style the image grid, they don't draw alone.
          e.type !== 'gridtile' &&
          !e.name.startsWith('gridtile') &&
          e.type !== 'sound' &&
          !e.type.startsWith('menu') &&
          (isVisible(e) || ed.selected === e.name),
      )
      .sort((a, b) => zOf(a) - zOf(b) || a.order - b.order);
  });

  /** Systems that have a logo in this theme, for the carousel and system grid mocks. */
  const carousel = $derived.by(() => {
    const sysView = ed.res?.views.get('system');
    const logo = sysView?.elements.get('logo') ?? null;
    const logoText = sysView?.elements.get('logoText') ?? null;
    const res = ed.res;
    const project = ed.project;
    const env = ed.env;
    const cur = ed.settings.system.theme;
    // The winning <path> plus its fallback siblings (e.g. .svg then .png).
    const history = logo?.history.get('path') ?? [];
    const last = history[history.length - 1];
    const defs = last ? history.filter((d) => d.node.parent === last.node.parent) : [];
    const logoFor = (sys: SystemInfo): string | null => {
      if (!res || !project) return null;
      for (const def of defs) {
        const abs = resolveAsset({ ...def, value: def.value.split(cur).join(sys.theme) }, res, project, env);
        if (abs) return abs;
      }
      return null;
    };
    let systems = ed.systems;
    if (defs.length) {
      const withLogo = ed.systems.filter((s) => logoFor(s));
      if (withLogo.length >= 3) systems = withLogo;
    }
    return { logo, logoText, systems, logoFor };
  });

  // The menu view styles ES's own menus; show a stand-in so the view isn't empty.
  const menu = $derived(ed.view === 'menu');

  // ---- dragging ----
  let drag: { name: string; sx: number; sy: number; px: number; py: number; moved: boolean } | null = null;
  let frame = 0;
  let pending: { x: number; y: number } | null = null;

  function pointerdown(e: PointerEvent) {
    if (e.button !== 0) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-name]');
    if (!target) {
      ed.selected = null;
      return;
    }
    const name = target.dataset.name!;
    const wasSelected = ed.selected === name;
    ed.selected = name;
    if (!wasSelected) return;
    const el = ed.currentView?.elements.get(name);
    const pos = parsePair(el?.props.get('pos')?.value) ?? [0, 0];
    drag = { name, sx: e.clientX, sy: e.clientY, px: pos[0], py: pos[1], moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function pointermove(e: PointerEvent) {
    if (!drag) return;
    const dx = (e.clientX - drag.sx) / scale / dims.width;
    const dy = (e.clientY - drag.sy) / scale / dims.height;
    if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 3) return;
    drag.moved = true;
    // Three decimals, like hand-written themes.
    pending = { x: Math.round((drag.px + dx) * 1000) / 1000, y: Math.round((drag.py + dy) * 1000) / 1000 };
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (drag && pending) ed.setProp(drag.name, 'pos', `${fmtNum(pending.x)} ${fmtNum(pending.y)}`, { coalesce: `drag.${drag.name}` });
      });
  }

  function pointerup() {
    drag = null;
  }

  const sel = $derived(ed.selectedElement);
</script>

<div class="canvas-area">
<div class="host" role="presentation" bind:this={host} {onwheel} onpointerdown={(e) => e.target === e.currentTarget && (ed.selected = null)}>
  {#if ed.res}
    <div class="stage-wrap" style:width="{dims.width * scale}px" style:height="{dims.height * scale}px">
      <div
        class="stage"
        role="presentation"
        style:width="{dims.width}px"
        style:height="{dims.height}px"
        style:transform="scale({scale})"
        style:--s={scale}
        onpointerdown={pointerdown}
        onpointermove={pointermove}
        onpointerup={pointerup}
        onpointercancel={pointerup}
      >
        {#each drawn as el (el.name)}
          <PreviewElement {el} W={dims.width} H={dims.height} {exprEnv} selected={ed.selected === el.name} ghost={!isVisible(el)} {carousel} />
        {/each}
        {#if menu}
          <div class="menu-mock">
            <div class="mtitle">MAIN MENU</div>
            {#each ['Games settings', 'UI settings', 'Sound settings', 'Network settings', 'Quit'] as row, i}
              <div class="mrow" class:on={i === 1}>{row}</div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
<footer class="status">
  <div class="zoom" role="group" aria-label="Zoom">
    <button onclick={() => zoomBy(-1)} title="Zoom out (Ctrl+−)"><Icon name="zoomOut" size={14} /></button>
    <span class="pct" title="Zoom">{Math.round(scale * 100)}%</span>
    <button onclick={() => zoomBy(1)} title="Zoom in (Ctrl++)"><Icon name="zoomIn" size={14} /></button>
    <button class:on={ed.zoom === 'fit'} onclick={() => (ed.zoom = 'fit')} title="Fit to window (Ctrl+0)"><Icon name="fit" size={14} /></button>
  </div>
  <span class="faint">{dims.width} × {dims.height}</span>
  <span class="faint">·</span>
  <span class="faint">{ed.settings.system.fullName}</span>
  {#if sel}
    <span class="faint">·</span>
    <span class="faint">Selected: {elementLabel(sel.name)}</span>
  {/if}
  <span class="hint faint">Sample games are shown. Videos and animations don't play here.</span>
</footer>
</div>

<style>
  .canvas-area {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  .host {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: auto;
    background: var(--canvas);
    padding: 24px;
  }
  .stage-wrap {
    position: relative;
    margin: auto;
    flex: none;
    box-shadow: 0 2px 18px rgba(0, 0, 0, 0.6);
  }
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 28px;
    padding: 0 10px;
    background: var(--frame);
    border-top: 1px solid var(--line);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
  }
  .zoom {
    display: flex;
    align-items: center;
    gap: 1px;
    margin-right: 6px;
  }
  .zoom button {
    background: transparent;
    padding: 3px 4px;
    color: var(--text-dim);
  }
  .zoom button:hover {
    color: var(--text);
  }
  .zoom button.on {
    color: var(--accent);
  }
  .pct {
    width: 40px;
    text-align: center;
    color: var(--text);
  }
  .stage {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
    overflow: hidden;
    background: #000;
    user-select: none;
    touch-action: none;
  }
  .hint {
    margin-left: auto;
  }
  .menu-mock {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 760px;
    background: rgba(32, 34, 40, 0.94);
    border-radius: 14px;
    padding: 18px 0;
    color: #eee;
    font: 30px 'Segoe UI', sans-serif;
    z-index: 999999;
    pointer-events: none;
  }
  .mtitle {
    text-align: center;
    font-weight: 700;
    padding-bottom: 14px;
  }
  .mrow {
    padding: 12px 36px;
  }
  .mrow.on {
    background: rgba(91, 157, 255, 0.4);
  }
</style>
