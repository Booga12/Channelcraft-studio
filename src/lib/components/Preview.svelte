<script lang="ts">
  import { tick } from 'svelte';
  import { ed } from '$lib/editor.svelte';
  import { prefs } from '$lib/prefs.svelte';
  import { bindingValue, screenSize } from '$lib/theme/context';
  import { evaluate, truthy, type ExprEnv } from '$lib/theme/expr';
  import type { ResolvedElement } from '$lib/theme/resolver';
  import { assetExists, resolveAsset } from '$lib/theme/resolver';
  import { fmtNum, parsePair } from '$lib/theme/schema';
  import { isCarouselPart, isVisible, zOf } from '$lib/render';
  import { usesGameData } from '$lib/theme/library';
  import type { SystemInfo } from '$lib/theme/systems';
  import { elementLabel } from '$lib/friendly';
  import { fontState } from '$lib/preview.svelte';
  import { join, pathKey } from '$lib/path';
  import { cssColor } from '$lib/theme/schema';
  import { splashScene } from '$lib/theme/splash';
  import PreviewElement from './PreviewElement.svelte';
  import ContactSheet from './ContactSheet.svelte';
  import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
  import Icon from './Icon.svelte';

  // The canvas host comes and goes with the contact sheet, so it's reactive.
  let host: HTMLDivElement | undefined = $state();
  let stageEl: HTMLDivElement | undefined = $state();
  let cw = $state(800);
  let ch = $state(450);

  $effect(() => {
    if (!host) return;
    const ro = new ResizeObserver(([e]) => {
      cw = e.contentRect.width;
      ch = e.contentRect.height;
    });
    ro.observe(host);
    return () => ro.disconnect();
  });

  const RULER = 18;
  const dims = $derived(screenSize(ed.settings));
  const rulers = $derived(prefs.v.showRulers ? RULER : 0);
  const fitScale = $derived(Math.max(0.05, Math.min((cw - rulers - 2) / dims.width, (ch - rulers - 2) / dims.height)));
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
    let systems = ed.previewSystems;
    if (defs.length) {
      const withLogo = ed.previewSystems.filter((s) => logoFor(s));
      if (withLogo.length >= 3) systems = withLogo;
    }
    return { logo, logoText, systems, logoFor };
  });

  const exprEnv = $derived.by<ExprEnv>(() => {
    const subsets = new Map((ed.res?.subsets ?? []).map((s) => [s.name, s.selected]));
    const env = ed.env;
    const project = ed.project!;
    const media = new Set(Object.values(env.game?.media ?? {}).map((p) => pathKey(p)));
    const sysLogo = carousel.logoFor(ed.settings.system) ?? '';
    const onConsoles = ed.view === 'system';
    return {
      // RetroBat's console screen has no current game: {game:...} stays empty there (SystemView.cpp).
      binding: (n) => (n === 'system:logo' || n === 'system.logo' ? sysLogo : onConsoles && /^game[:.]/i.test(n) ? '' : bindingValue(n, env, subsets)),
      exists: (p) => media.has(pathKey(p)) || assetExists(p, project, env),
    };
  });

  /** Visible right now: evaluates data-driven visibility like {game:favorite}. */
  function visibleNow(e: ResolvedElement): boolean {
    const v = e.props.get('visible')?.value;
    if (v && /[{(]/.test(v)) {
      try {
        return truthy(evaluate(v, exprEnv));
      } catch {
        return true;
      }
    }
    return isVisible(e);
  }

  /** RetroBat's loading screens (splash.xml, gamesplash.xml) follow their own drawing rules. */
  const splash = $derived(ed.screenFile !== 'theme.xml' && ed.project?.entry ? splashScene(ed.currentView, ed.project.entry, join(ed.root?.resourcesDir ?? '', 'splash.svg')) : null);
  const bar = $derived(splash?.bar);

  /** Pictures and videos on the console screen that use the current game's data (none there in RetroBat). */
  const emptyOnConsoles = $derived(ed.view === 'system' && ed.currentView ? [...ed.currentView.elements.values()].filter((e) => (e.type === 'image' || e.type === 'video') && usesGameData(e.props.get('path')?.value) && isVisible(e)) : []);

  const drawn = $derived.by(() => {
    if (splash) return splash.elements.filter((e) => !ed.hidden[e.name]);
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
          (visibleNow(e) || ed.isSelected(e.name)),
      )
      .sort((a, b) => zOf(a) - zOf(b) || a.order - b.order);
  });

  // The menu view styles ES's own menus; show a stand-in so the view isn't empty.
  const menu = $derived(ed.view === 'menu');

  // ---- measuring: where each element ends up, for selection boxes, snapping and alignment ----

  let measureFrame = 0;
  function measure() {
    cancelAnimationFrame(measureFrame);
    measureFrame = requestAnimationFrame(() => {
      if (!stageEl) return;
      const sr = stageEl.getBoundingClientRect();
      if (!sr.width) return;
      const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
      for (const node of stageEl.querySelectorAll<HTMLElement>(':scope > .el[data-name]')) {
        const r = node.getBoundingClientRect();
        out[node.dataset.name!] = { x: (r.left - sr.left) / sr.width, y: (r.top - sr.top) / sr.height, w: r.width / sr.width, h: r.height / sr.height };
      }
      ed.rects = out;
    });
  }

  $effect(() => {
    ed.res;
    ed.env;
    drawn;
    scale;
    fontState.loaded;
    tick().then(measure);
    // Pictures change size when they finish loading.
    const t = setTimeout(measure, 250);
    return () => clearTimeout(t);
  });

  // ---- interaction ----

  type Mode =
    | { kind: 'pending'; name: string | null; sx: number; sy: number; fx: number; fy: number }
    | { kind: 'move'; sx: number; sy: number; start: Record<string, [number, number]>; box: Box }
    | { kind: 'resize'; name: string; handle: string; sx: number; sy: number; rect: Box; ox: number; oy: number; sizeProp: string; zeroW: boolean; zeroH: boolean; aspect: number }
    | { kind: 'marquee'; fx: number; fy: number; x: number; y: number; additive: boolean };

  interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
  }

  let mode = $state<Mode | null>(null);
  let guides = $state<{ v: number[]; h: number[] }>({ v: [], h: [] });
  let sizeLabel = $state<string | null>(null);
  let menuAt = $state<{ x: number; y: number } | null>(null);

  /** Pointer position in screen fractions. */
  function frac(e: PointerEvent | MouseEvent): [number, number] {
    const r = stageEl!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  const union = (names: string[]): Box | null => {
    const rs = names.map((n) => ed.rects[n]).filter(Boolean);
    if (!rs.length) return null;
    const x = Math.min(...rs.map((r) => r.x));
    const y = Math.min(...rs.map((r) => r.y));
    return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
  };

  /** Lines to snap to: screen edges and centre, the grid, and other elements' edges and centres. */
  function snapLines(exclude: string[]) {
    const xs = [0, 0.5, 1];
    const ys = [0, 0.5, 1];
    for (const [n, r] of Object.entries(ed.rects)) {
      if (exclude.includes(n) || ed.hidden[n]) continue;
      // Full-screen backgrounds only add the edges we already have.
      if (r.w > 0.98 && r.h > 0.98) continue;
      xs.push(r.x, r.x + r.w / 2, r.x + r.w);
      ys.push(r.y, r.y + r.h / 2, r.y + r.h);
    }
    return { xs, ys };
  }

  /** Best offset (within the threshold) that puts one of `edges` on one of `lines`. */
  function bestSnap(edges: number[], lines: number[], threshold: number, grid: number | null): { d: number; line: number | null } {
    let best = { d: 0, line: null as number | null, dist: threshold };
    for (const e of edges)
      for (const l of lines) {
        const dist = Math.abs(l - e);
        if (dist < best.dist) best = { d: l - e, line: l, dist };
      }
    if (best.line === null && grid) {
      const e = edges[0];
      const g = Math.round(e / grid) * grid;
      if (Math.abs(g - e) < threshold) return { d: g - e, line: null };
    }
    return { d: best.d, line: best.line };
  }

  function pointerdown(e: PointerEvent) {
    if (e.button !== 0 || !stageEl) return;
    menuAt = null;
    const t = e.target as HTMLElement;
    const handle = t.closest<HTMLElement>('[data-handle]');
    const [fx, fy] = frac(e);
    if (handle && ed.selected) {
      startResize(e, ed.selected, handle.dataset.handle!);
      return;
    }
    const hit = t.closest<HTMLElement>('.el[data-name]');
    const name = hit?.dataset.name ?? null;
    if (name && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      ed.select(name, 'toggle');
      return;
    }
    // Full-screen backgrounds aren't dragged around by accident: dragging on them draws a selection box.
    const r = name ? ed.rects[name] : null;
    const isBackdrop = !!r && r.w > 0.98 && r.h > 0.98;
    if (name && ed.isSelected(name) && !isBackdrop) {
      startMove(e);
      return;
    }
    mode = { kind: 'pending', name, sx: e.clientX, sy: e.clientY, fx, fy };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function startMove(e: PointerEvent) {
    const start: Record<string, [number, number]> = {};
    for (const n of ed.selection) {
      if (ed.locked[n]) continue;
      const el = ed.currentView?.elements.get(n);
      if (el) start[n] = parsePair(el.props.get('pos')?.value) ?? [0, 0];
    }
    const box = union(Object.keys(start));
    if (!box) return;
    mode = { kind: 'move', sx: e.clientX, sy: e.clientY, start, box };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function startResize(e: PointerEvent, name: string, handle: string) {
    const el = ed.currentView?.elements.get(name);
    const rect = ed.rects[name];
    if (!el || !rect || ed.locked[name]) return;
    const origin = parsePair(el.props.get('origin')?.value) ?? [0, 0];
    const sizeProp = el.props.has('size') ? 'size' : el.props.has('maxSize') ? 'maxSize' : el.type === 'image' || el.type === 'video' ? 'maxSize' : 'size';
    const cur = parsePair(el.props.get(sizeProp)?.value);
    mode = {
      kind: 'resize',
      name,
      handle,
      sx: e.clientX,
      sy: e.clientY,
      rect: { ...rect },
      ox: origin[0],
      oy: origin[1],
      sizeProp,
      zeroW: !!cur && cur[0] === 0 && sizeProp === 'size',
      zeroH: !!cur && cur[1] === 0 && sizeProp === 'size',
      aspect: rect.w / Math.max(rect.h, 0.0001),
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  }

  const r3 = (n: number) => Math.round(n * 1000) / 1000;

  function pointermove(e: PointerEvent) {
    if (!mode || !stageEl) return;
    const threshold = 7 / (scale * dims.width);
    const snapOn = prefs.v.snap && !e.altKey;
    const grid = prefs.v.showGrid ? prefs.v.gridSize : null;

    if (mode.kind === 'pending') {
      if (Math.abs(e.clientX - mode.sx) + Math.abs(e.clientY - mode.sy) < 4) return;
      // Dragging from something that isn't selected draws a selection box.
      mode = { kind: 'marquee', fx: mode.fx, fy: mode.fy, x: mode.fx, y: mode.fy, additive: e.shiftKey };
    }

    if (mode.kind === 'marquee') {
      const [x, y] = frac(e);
      mode = { ...mode, x, y };
      return;
    }

    if (mode.kind === 'move') {
      let dx = (e.clientX - mode.sx) / scale / dims.width;
      let dy = (e.clientY - mode.sy) / scale / dims.height;
      if (e.shiftKey) {
        // Shift: straight lines only.
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      const v: number[] = [];
      const h: number[] = [];
      if (snapOn) {
        const { xs, ys } = snapLines(Object.keys(mode.start));
        const b = mode.box;
        const sx = bestSnap([b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], xs, threshold, grid);
        const sy = bestSnap([b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h], ys, threshold * (dims.width / dims.height), grid);
        dx += sx.d;
        dy += sy.d;
        if (sx.line !== null) v.push(sx.line);
        if (sy.line !== null) h.push(sy.line);
      }
      guides = { v, h };
      ed.moveSelection(mode.start, r3(dx), r3(dy), `drag.${Object.keys(mode.start).join(',')}`);
      sizeLabel = null;
      return;
    }

    if (mode.kind === 'resize') {
      const m = mode;
      const ddx = (e.clientX - m.sx) / scale / dims.width;
      const ddy = (e.clientY - m.sy) / scale / dims.height;
      let { x: left, y: top, w, h } = m.rect;
      const right0 = left + w;
      const bottom0 = top + h;
      const centre = e.altKey;
      const v: number[] = [];
      const hz: number[] = [];
      const { xs, ys } = snapOn ? snapLines([m.name]) : { xs: [], ys: [] };
      const snapEdge = (val: number, lines: number[], horiz: boolean) => {
        if (!snapOn) return val;
        const s = bestSnap([val], lines, horiz ? threshold : threshold * (dims.width / dims.height), grid);
        if (s.line !== null) (horiz ? v : hz).push(s.line);
        return val + s.d;
      };
      if (m.handle.includes('e')) {
        const r = snapEdge(right0 + ddx, xs, true);
        w = r - left;
        if (centre) {
          left -= r - right0;
          w = r - left;
        }
      }
      if (m.handle.includes('w')) {
        const l = snapEdge(left + ddx, xs, true);
        w = right0 - l;
        left = l;
        if (centre) w += left - m.rect.x;
      }
      if (m.handle.includes('s')) {
        const b = snapEdge(bottom0 + ddy, ys, false);
        h = b - top;
        if (centre) {
          top -= b - bottom0;
          h = b - top;
        }
      }
      if (m.handle.includes('n')) {
        const t = snapEdge(top + ddy, ys, false);
        h = bottom0 - t;
        top = t;
        if (centre) h += top - m.rect.y;
      }
      const corner = m.handle.length === 2;
      if ((e.shiftKey || m.sizeProp === 'maxSize') && corner) {
        // Keep the proportions: follow whichever side moved most.
        const byW = w / m.aspect;
        if (Math.abs(byW - h) > 0.0001) {
          if (Math.abs(ddx) * dims.width > Math.abs(ddy) * dims.height) {
            const nh = byW;
            if (m.handle.includes('n')) top = bottom0 - nh;
            h = nh;
          } else {
            const nw = h * m.aspect;
            if (m.handle.includes('w')) left = right0 - nw;
            w = nw;
          }
        }
      }
      const min = 0.005;
      w = Math.max(min, w);
      h = Math.max(min, h);
      guides = { v, h: hz };
      const pos = `${fmtNum(r3(left + m.ox * w))} ${fmtNum(r3(top + m.oy * h))}`;
      const size = `${m.zeroW ? 0 : fmtNum(r3(w))} ${m.zeroH ? 0 : fmtNum(r3(h))}`;
      ed.setProps(m.name, { pos, [m.sizeProp]: size }, `resize.${m.name}`);
      sizeLabel = prefs.v.units === 'px' ? `${Math.round(w * dims.width)} × ${Math.round(h * dims.height)} px` : `${(w * 100).toFixed(1)}% × ${(h * 100).toFixed(1)}%`;
    }
  }

  function pointerup(e: PointerEvent) {
    if (!mode) return;
    if (mode.kind === 'pending') {
      if (mode.name) ed.select(mode.name, 'only');
      else ed.selected = null;
    } else if (mode.kind === 'marquee') {
      const box = { x: Math.min(mode.fx, mode.x), y: Math.min(mode.fy, mode.y), w: Math.abs(mode.x - mode.fx), h: Math.abs(mode.y - mode.fy) };
      const hits = Object.entries(ed.rects)
        .filter(([n, r]) => !ed.locked[n] && !(r.w > 0.98 && r.h > 0.98) && r.x < box.x + box.w && r.x + r.w > box.x && r.y < box.y + box.h && r.y + r.h > box.y)
        .map(([n]) => n);
      ed.selection = mode.additive ? [...new Set([...ed.selection, ...hits])] : hits;
    }
    mode = null;
    guides = { v: [], h: [] };
    sizeLabel = null;
    void e;
  }

  function oncontextmenu(e: MouseEvent) {
    e.preventDefault();
    const hit = (e.target as HTMLElement).closest<HTMLElement>('.el[data-name]');
    const name = hit?.dataset.name;
    if (name && !ed.isSelected(name)) ed.select(name, 'only');
    menuAt = { x: e.clientX, y: e.clientY };
  }

  const menuItems = $derived<MenuItem[]>(
    ed.selection.length
      ? [
          { label: 'Duplicate', shortcut: 'Ctrl+D', action: () => ed.duplicate() },
          { label: 'Copy', shortcut: 'Ctrl+C', action: () => ed.copy() },
          { label: 'Paste', shortcut: 'Ctrl+V', action: () => ed.paste() },
          { separator: true },
          { label: 'Bring to front', shortcut: 'Ctrl+Shift+]', action: () => ed.arrange('front') },
          { label: 'Bring forward', shortcut: 'Ctrl+]', action: () => ed.arrange('forward') },
          { label: 'Send backward', shortcut: 'Ctrl+[', action: () => ed.arrange('backward') },
          { label: 'Send to back', shortcut: 'Ctrl+Shift+[', action: () => ed.arrange('back') },
          { separator: true },
          { label: ed.selection.length > 1 ? 'Align left' : 'Align to screen left', action: () => ed.align('left') },
          { label: ed.selection.length > 1 ? 'Align centres' : 'Centre on screen', action: () => (ed.align('hcenter'), ed.selection.length === 1 && ed.align('vcenter')) },
          { label: ed.selection.length > 1 ? 'Align right' : 'Align to screen right', action: () => ed.align('right') },
          { separator: true },
          { label: 'Lock', action: () => ed.selection.forEach((n) => ed.setLocked(n, true)) },
          { label: 'Hide on this screen', action: () => ed.selection.forEach((n) => ed.setProp(n, 'visible', 'false')) },
          { label: 'Delete', shortcut: 'Del', danger: true, action: () => ed.deleteSelection() },
        ]
      : [
          { label: 'Paste', shortcut: 'Ctrl+V', action: () => ed.paste() },
          { label: 'Select all', shortcut: 'Ctrl+A', action: () => ed.selectAll() },
          { separator: true },
          { label: prefs.v.showGrid ? 'Hide grid' : 'Show grid', action: () => prefs.set('showGrid', !prefs.v.showGrid) },
          { label: prefs.v.showSafeArea ? 'Hide TV safe area' : 'Show TV safe area', action: () => prefs.set('showSafeArea', !prefs.v.showSafeArea) },
        ],
  );

  const sel = $derived(ed.selectedElement);
  const selBoxes = $derived(ed.selection.map((n) => ({ n, r: ed.rects[n] })).filter((x) => x.r));
  const primary = $derived(ed.selection.length === 1 && ed.selected && ed.rects[ed.selected] && !ed.locked[ed.selected] ? ed.rects[ed.selected] : null);
  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const handlePos = (h: string, r: Box) => ({
    x: h.includes('w') ? r.x : h.includes('e') ? r.x + r.w : r.x + r.w / 2,
    y: h.includes('n') ? r.y : h.includes('s') ? r.y + r.h : r.y + r.h / 2,
  });

  // Ruler ticks: every 5% (or 50 px), labelled every 10% (100 px).
  const ticks = (len: number, px: number) => {
    const out: { at: number; label: string | null; major: boolean }[] = [];
    const usePx = prefs.v.units === 'px';
    const step = usePx ? 50 / px : 0.05;
    for (let f = 0, i = 0; f <= 1.0001; f += step, i++) out.push({ at: f * len, major: i % 2 === 0, label: i % 2 === 0 ? (usePx ? String(Math.round(f * px)) : `${Math.round(f * 100)}`) : null });
    return out;
  };
  const gamesHere = $derived(ed.currentGames.length);

  // Animations play again on every game (game lists) or console (console screen) shown, coming
  // from the side the list moved, as in RetroBat.
  let play = $state({ token: '', dir: 0 });
  let lastPlace = { system: '', game: -1 };
  $effect(() => {
    const system = ed.settings.system.name;
    const game = ed.gameIndex;
    const n = Math.max(1, gamesHere);
    let dir = 0;
    if (system !== lastPlace.system) dir = 0;
    else if (game !== lastPlace.game) dir = (game - lastPlace.game + n) % n <= n / 2 ? 1 : -1;
    lastPlace = { system, game };
    play = { token: `${system}|${game}`, dir };
  });
</script>

<div class="canvas-area">
  {#if ed.contactSheet}
    <ContactSheet />
  {:else}
    <div class="host" role="presentation" bind:this={host} {onwheel} onpointerdown={(e) => e.target === e.currentTarget && (ed.selected = null)}>
      {#if ed.res}
        <div class="board" style:grid-template-columns="{rulers}px {dims.width * scale}px" style:grid-template-rows="{rulers}px {dims.height * scale}px">
          {#if rulers}
            <div class="corner"></div>
            <div class="ruler top">
              {#each ticks(dims.width * scale, dims.width) as t}
                <span class="tick" class:major={t.major} style:left="{t.at}px">{#if t.label !== null}<em>{t.label}</em>{/if}</span>
              {/each}
              {#each selBoxes as b}
                <span class="mark" style:left="{b.r.x * dims.width * scale}px" style:width="{b.r.w * dims.width * scale}px"></span>
              {/each}
            </div>
            <div class="ruler left">
              {#each ticks(dims.height * scale, dims.height) as t}
                <span class="tick" class:major={t.major} style:top="{t.at}px">{#if t.label !== null}<em>{t.label}</em>{/if}</span>
              {/each}
              {#each selBoxes as b}
                <span class="mark" style:top="{b.r.y * dims.height * scale}px" style:height="{b.r.h * dims.height * scale}px"></span>
              {/each}
            </div>
          {/if}
          <div class="stage-wrap" style:width="{dims.width * scale}px" style:height="{dims.height * scale}px">
            <div
              class="stage"
              role="presentation"
              bind:this={stageEl}
              style:width="{dims.width}px"
              style:height="{dims.height}px"
              style:transform="scale({scale})"
              style:background={splash ? cssColor(splash.backgroundColor, '#000') : undefined}
              style:--s={scale}
              onpointerdown={pointerdown}
              onpointermove={pointermove}
              onpointerup={pointerup}
              onpointercancel={pointerup}
              {oncontextmenu}
            >
              {#if splash && bar}
                <!-- RetroBat's progress bar, shown 60% full. -->
                <div
                  class="splash-bar"
                  style:left="{bar.x * dims.width}px"
                  style:top="{bar.y * dims.height}px"
                  style:width="{bar.w * dims.width}px"
                  style:height="{bar.h * dims.height}px"
                  style:border-radius="{Math.max(bar.w * dims.width, bar.h * dims.height) * bar.round}px"
                  style:z-index={1000 + splash.barIndex}
                  style:background="linear-gradient(to right, {cssColor(bar.color)}, {cssColor(bar.colorEnd)})"
                >
                  <div style:width="60%" style:background="linear-gradient(to right, {cssColor(bar.activeColor)}, {cssColor(bar.activeColorEnd)})"></div>
                </div>
              {/if}
              {#each drawn as el, i (el.name)}
                <PreviewElement
                  z={splash ? 1000 + i + (i >= splash.barIndex ? 1 : 0) : undefined}
                  {el}
                  W={dims.width}
                  H={dims.height}
                  {exprEnv}
                  selected={false}
                  ghost={!visibleNow(el)}
                  {carousel}
                  res={ed.res}
                  env={ed.env}
                  view={ed.view}
                  locked={!!ed.locked[el.name]}
                  animate={ed.playAnimations}
                  {play}
                />
              {/each}
              {#if menu}
                <div class="menu-mock">
                  <div class="mtitle">MAIN MENU</div>
                  {#each ['Games settings', 'UI settings', 'Sound settings', 'Network settings', 'Quit'] as row, i}
                    <div class="mrow" class:on={i === 1}>{row}</div>
                  {/each}
                </div>
              {/if}

              <!-- Overlays: drawn above the theme, in screen pixels. -->
              <div class="overlay">
                {#if prefs.v.showGrid}
                  <div class="grid" style:background-size="{prefs.v.gridSize * dims.width}px {prefs.v.gridSize * dims.height}px"></div>
                {/if}
                {#if prefs.v.showSafeArea}
                  <div class="safe action" title="Action safe (5%)"></div>
                  <div class="safe title" title="Title safe (10%)"></div>
                {/if}
                {#each guides.v as g}<div class="guide v" style:left="{g * dims.width}px"></div>{/each}
                {#each guides.h as g}<div class="guide h" style:top="{g * dims.height}px"></div>{/each}
                {#each selBoxes as b (b.n)}
                  <div class="selbox" class:primary={b.n === ed.selected} style:left="{b.r.x * dims.width}px" style:top="{b.r.y * dims.height}px" style:width="{b.r.w * dims.width}px" style:height="{b.r.h * dims.height}px"></div>
                {/each}
                {#if primary}
                  {#each HANDLES as h}
                    {@const p = handlePos(h, primary)}
                    <div class="handle {h}" data-handle={h} style:left="{p.x * dims.width}px" style:top="{p.y * dims.height}px" title="Drag to resize (Shift keeps proportions, Alt resizes from the centre)"></div>
                  {/each}
                  {#if sizeLabel}
                    <div class="sizelabel" style:left="{(primary.x + primary.w / 2) * dims.width}px" style:top="{(primary.y + primary.h) * dims.height}px">{sizeLabel}</div>
                  {/if}
                {/if}
                {#if mode?.kind === 'marquee'}
                  <div
                    class="marquee"
                    style:left="{Math.min(mode.fx, mode.x) * dims.width}px"
                    style:top="{Math.min(mode.fy, mode.y) * dims.height}px"
                    style:width="{Math.abs(mode.x - mode.fx) * dims.width}px"
                    style:height="{Math.abs(mode.y - mode.fy) * dims.height}px"
                  ></div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
  <footer class="status">
    <div class="group" role="group" aria-label="Zoom">
      <button onclick={() => zoomBy(-1)} title="Zoom out (Ctrl+−)"><Icon name="zoomOut" size={14} /></button>
      <span class="pct" title="Zoom">{Math.round(scale * 100)}%</span>
      <button onclick={() => zoomBy(1)} title="Zoom in (Ctrl++)"><Icon name="zoomIn" size={14} /></button>
      <button class:on={ed.zoom === 'fit'} onclick={() => (ed.zoom = 'fit')} title="Fit to window (Ctrl+0)"><Icon name="fit" size={14} /></button>
    </div>
    <span class="sep"></span>
    <div class="group" role="group" aria-label="Preview system">
      <button onclick={() => ed.stepSystem(-1)} title="Previous system">‹</button>
      <span class="sys" title="The console shown in the preview">{ed.settings.system.fullName}</span>
      <button onclick={() => ed.stepSystem(1)} title="Next system">›</button>
    </div>
    {#if gamesHere}
      <div class="group" role="group" aria-label="Preview game">
        <button onclick={() => (ed.gameIndex = (ed.gameIndex - 1 + gamesHere) % gamesHere)} title="Previous game">‹</button>
        <span class="sys game" title="One of your own scraped games">🎮 {ed.currentGame?.name}</span>
        <button onclick={() => (ed.gameIndex = (ed.gameIndex + 1) % gamesHere)} title="Next game">›</button>
      </div>
    {:else}
      <span class="faint" title="This console has no scraped games in RetroBat, so made-up sample details are shown. Scrape it in RetroBat to preview your own games.">Sample game (made-up details)</span>
    {/if}
    {#if emptyOnConsoles.length}
      <button class="warn-note ghost small" title="These use the current game's pictures or video, but RetroBat's console screen has no game, so they stay empty: {emptyOnConsoles.map((e) => e.name).join(', ')}. Click to select the first one and fix it." onclick={() => (ed.selection = [emptyOnConsoles[0].name])}>
        ⚠ {emptyOnConsoles.length} element{emptyOnConsoles.length === 1 ? '' : 's'} will be empty in RetroBat
      </button>
    {/if}
    {#if splash?.ignored.length}
      <span class="warn-note" title="On a loading screen RetroBat only draws its background, label and progress bar, plus elements marked extra=&quot;true&quot;. Not drawn: {splash.ignored.join(', ')}">
        ⚠ {splash.ignored.length} element{splash.ignored.length === 1 ? '' : 's'} RetroBat won't draw here
      </span>
    {/if}
    <span class="spacer"></span>
    <div class="group toggles" role="group" aria-label="Canvas options">
      <button class:on={ed.playAnimations} onclick={() => (ed.playAnimations = !ed.playAnimations)} title="Play animations">▶</button>
      <button class:on={prefs.v.snap} onclick={() => prefs.set('snap', !prefs.v.snap)} title="Snap to guides (hold Alt to switch off while dragging)"><Icon name="fit" size={13} /></button>
      <button class:on={prefs.v.showGrid} onclick={() => prefs.set('showGrid', !prefs.v.showGrid)} title="Grid"><Icon name="grid" size={13} /></button>
      <button class:on={prefs.v.showSafeArea} onclick={() => prefs.set('showSafeArea', !prefs.v.showSafeArea)} title="TV safe area"><Icon name="monitor" size={13} /></button>
      <button class:on={prefs.v.showRulers} onclick={() => prefs.set('showRulers', !prefs.v.showRulers)} title="Rulers">⊢</button>
      <button class:on={ed.contactSheet} onclick={() => (ed.contactSheet = !ed.contactSheet)} title="Show six systems at once">▦ Systems</button>
    </div>
    {#if sel}
      <span class="faint sel">· {elementLabel(sel.name)}{ed.selection.length > 1 ? ` + ${ed.selection.length - 1} more` : ''}</span>
    {/if}
  </footer>
</div>

{#if menuAt}
  <ContextMenu x={menuAt.x} y={menuAt.y} items={menuItems} onclose={() => (menuAt = null)} />
{/if}

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
    padding: 20px;
  }
  .board {
    margin: auto;
    display: grid;
    flex: none;
  }
  .corner {
    background: var(--frame);
  }
  .ruler {
    position: relative;
    background: var(--frame);
    overflow: hidden;
    font-size: 9px;
    color: var(--text-faint);
  }
  .ruler.top {
    border-bottom: 1px solid #3a3a3a;
  }
  .ruler.left {
    border-right: 1px solid #3a3a3a;
  }
  .tick {
    position: absolute;
    background: #555;
  }
  .top .tick {
    bottom: 0;
    width: 1px;
    height: 5px;
  }
  .top .tick.major {
    height: 9px;
  }
  .left .tick {
    right: 0;
    height: 1px;
    width: 5px;
  }
  .left .tick.major {
    width: 9px;
  }
  .tick em {
    position: absolute;
    font-style: normal;
  }
  .top .tick em {
    left: 3px;
    top: -9px;
  }
  .left .tick em {
    top: 2px;
    left: -12px;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
  }
  .mark {
    position: absolute;
    background: var(--accent-soft);
  }
  .top .mark {
    top: 0;
    bottom: 0;
  }
  .left .mark {
    left: 0;
    right: 0;
  }
  .stage-wrap {
    position: relative;
    box-shadow: 0 2px 18px rgba(0, 0, 0, 0.6);
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
  .warn-note {
    color: var(--warn);
    font-size: 11.5px;
  }
  .splash-bar {
    position: absolute;
    overflow: hidden;
    pointer-events: none;
  }
  .splash-bar > div {
    height: 100%;
  }
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 9000000;
    pointer-events: none;
  }
  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, rgba(255, 255, 255, 0.09) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.09) 1px, transparent 1px);
  }
  .safe {
    position: absolute;
    border: calc(1.5px / var(--s, 1)) dashed rgba(255, 210, 80, 0.7);
  }
  .safe.action {
    inset: 5%;
  }
  .safe.title {
    inset: 10%;
    border-color: rgba(255, 140, 80, 0.6);
  }
  .guide {
    position: absolute;
    background: #ff3fa4;
  }
  .guide.v {
    top: 0;
    bottom: 0;
    width: calc(1px / var(--s, 1));
  }
  .guide.h {
    left: 0;
    right: 0;
    height: calc(1px / var(--s, 1));
  }
  .selbox {
    position: absolute;
    outline: calc(1px / var(--s, 1)) solid var(--accent);
  }
  .selbox.primary {
    outline-width: calc(2px / var(--s, 1));
  }
  .handle {
    position: absolute;
    width: calc(9px / var(--s, 1));
    height: calc(9px / var(--s, 1));
    background: #fff;
    border: calc(1.5px / var(--s, 1)) solid var(--accent);
    border-radius: calc(2px / var(--s, 1));
    transform: translate(-50%, -50%);
    pointer-events: auto;
  }
  .handle.nw,
  .handle.se {
    cursor: nwse-resize;
  }
  .handle.ne,
  .handle.sw {
    cursor: nesw-resize;
  }
  .handle.n,
  .handle.s {
    cursor: ns-resize;
  }
  .handle.e,
  .handle.w {
    cursor: ew-resize;
  }
  .sizelabel {
    position: absolute;
    transform: translate(-50%, calc(10px / var(--s, 1)));
    background: var(--accent-strong);
    color: #fff;
    font: 600 calc(11px / var(--s, 1)) 'Segoe UI', sans-serif;
    padding: calc(2px / var(--s, 1)) calc(6px / var(--s, 1));
    border-radius: calc(4px / var(--s, 1));
    white-space: nowrap;
  }
  .marquee {
    position: absolute;
    border: calc(1px / var(--s, 1)) dashed var(--accent);
    background: var(--accent-soft);
  }
  .status {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    background: var(--frame);
    border-top: 1px solid var(--line);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
  }
  .group {
    display: flex;
    align-items: center;
    gap: 1px;
  }
  .group button {
    background: transparent;
    padding: 3px 6px;
    color: var(--text-dim);
    font-size: 12px;
  }
  .group button:hover {
    color: var(--text);
    background: var(--raised);
  }
  .group button.on {
    color: var(--accent);
  }
  .pct {
    width: 40px;
    text-align: center;
    color: var(--text);
  }
  .sys {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-dim);
  }
  .sys.game {
    max-width: 220px;
  }
  .sep {
    width: 1px;
    height: 16px;
    background: #444;
    margin: 0 4px;
  }
  .spacer {
    flex: 1;
  }
  .sel {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
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
