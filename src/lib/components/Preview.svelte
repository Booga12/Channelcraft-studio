<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import { bindingValue, screenSize } from '$lib/theme/context';
  import type { ExprEnv } from '$lib/theme/expr';
  import { assetExists, resolveAsset } from '$lib/theme/resolver';
  import { fmtNum, parsePair } from '$lib/theme/schema';
  import { isCarouselPart, isVisible, zOf } from '$lib/render';
  import type { SystemInfo } from '$lib/theme/systems';
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
  const scale = $derived(Math.max(0.05, Math.min((cw - 32) / dims.width, (ch - 32) / dims.height)));

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

<div class="host" bind:this={host}>
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
    <div class="caption">
      <span>{ed.currentView?.displayName ?? ed.view}</span>
      <span class="faint">· {ed.settings.system.fullName} · {dims.width}×{dims.height} · {Math.round(scale * 100)}%</span>
      {#if sel}
        <span class="faint">· {sel.name} @ {sel.props.get('pos')?.value ?? '0 0'}</span>
      {/if}
      <span class="hint faint">Mock data. Videos, shaders and animations are not played.</span>
    </div>
  {/if}
</div>

<style>
  .host {
    position: relative;
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .stage-wrap {
    position: relative;
    box-shadow:
      0 0 0 1px #2a2f38,
      0 10px 40px rgba(0, 0, 0, 0.5);
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
  .caption {
    position: absolute;
    left: 12px;
    bottom: 6px;
    right: 12px;
    display: flex;
    gap: 6px;
    font-size: 11.5px;
    color: var(--text-dim);
    pointer-events: none;
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
