<script lang="ts">
  // Six systems at once, to spot logos or colours that look wrong on some of them.
  import { ed } from '$lib/editor.svelte';
  import { bindingValue, screenSize, type Environment } from '$lib/theme/context';
  import type { ExprEnv } from '$lib/theme/expr';
  import { assetExists, resolveAsset, resolveTheme } from '$lib/theme/resolver';
  import type { SystemInfo } from '$lib/theme/systems';
  import { isCarouselPart, isVisible, zOf } from '$lib/render';
  import { pathKey } from '$lib/path';
  import PreviewElement from './PreviewElement.svelte';

  let host: HTMLDivElement;
  let cw = $state(900);
  $effect(() => {
    const ro = new ResizeObserver(([e]) => (cw = e.contentRect.width));
    ro.observe(host);
    return () => ro.disconnect();
  });

  const systems = $derived.by(() => {
    const list = ed.previewSystems;
    const i = Math.max(0, list.findIndex((s) => s.name === ed.settings.system.name));
    return Array.from({ length: Math.min(6, list.length) }, (_, k) => list[(i + k) % list.length]);
  });

  $effect(() => {
    for (const s of systems) ed.loadGamesFor(s.name);
  });

  const dims = $derived(screenSize(ed.settings));
  const tileW = $derived(Math.max(200, (cw - 40) / 3));
  const scale = $derived(tileW / dims.width);

  const tiles = $derived.by(() => {
    const p = ed.project;
    if (!p) return [];
    return systems.map((sys) => {
      const games = ed.games[sys.name] ?? [];
      const env: Environment = { ...ed.env, settings: { ...$state.snapshot(ed.settings), system: sys }, game: games[0], games: games.length ? games : undefined, gameNames: games.length ? games.map((g) => g.name) : undefined };
      const res = resolveTheme(p, env);
      const view = res.views.get(ed.view);
      const sysView = res.views.get('system');
      const logo = sysView?.elements.get('logo') ?? null;
      const history = logo?.history.get('path') ?? [];
      const last = history[history.length - 1];
      const defs = last ? history.filter((d) => d.node.parent === last.node.parent) : [];
      const logoFor = (s: SystemInfo) => {
        for (const def of defs) {
          const abs = resolveAsset({ ...def, value: def.value.split(sys.theme).join(s.theme) }, res, p, env);
          if (abs) return abs;
        }
        return null;
      };
      const subsets = new Map(res.subsets.map((s) => [s.name, s.selected]));
      const media = new Set(Object.values(env.game?.media ?? {}).map((m) => pathKey(m)));
      const exprEnv: ExprEnv = {
        binding: (n) => (n === 'system:logo' ? (logoFor(sys) ?? '') : bindingValue(n, env, subsets)),
        exists: (q) => media.has(pathKey(q)) || assetExists(q, p, env),
      };
      const drawn = [...(view?.elements.values() ?? [])]
        .filter((e) => !isCarouselPart(ed.view, e) && e.type !== 'gridtile' && !e.name.startsWith('gridtile') && e.type !== 'sound' && !e.type.startsWith('menu') && isVisible(e))
        .sort((a, b) => zOf(a) - zOf(b) || a.order - b.order);
      return { sys, env, res, drawn, exprEnv, carousel: { logo, logoText: sysView?.elements.get('logoText') ?? null, systems: ed.previewSystems, logoFor } };
    });
  });
</script>

<div class="sheet" bind:this={host}>
  <div class="head">
    <strong>{tiles.length} systems</strong>
    <span class="dim">Click one to edit with it.</span>
    <button class="ghost small" onclick={() => ed.stepSystem(6)}>Next 6 ›</button>
    <button class="small" onclick={() => (ed.contactSheet = false)}>Back to editing</button>
  </div>
  <div class="tiles" style:grid-template-columns="repeat(3, {tileW}px)">
    {#each tiles as t (t.sys.name)}
      <button
        class="tile"
        onclick={() => {
          ed.setSystem(t.sys);
          ed.contactSheet = false;
        }}
        title="Edit with {t.sys.fullName}"
      >
        <div class="frame" style:width="{tileW}px" style:height="{dims.height * scale}px">
          <div class="stage" style:width="{dims.width}px" style:height="{dims.height}px" style:transform="scale({scale})">
            {#each t.drawn as el (el.name)}
              <PreviewElement {el} W={dims.width} H={dims.height} exprEnv={t.exprEnv} selected={false} ghost={false} carousel={t.carousel} res={t.res} env={t.env} view={ed.view} locked />
            {/each}
          </div>
        </div>
        <span class="name">{t.sys.fullName}{ed.games[t.sys.name]?.length ? ' · your games' : ''}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .sheet {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: var(--canvas);
    /* Clear of the floating panels (EditorView sets the insets). */
    padding: 16px var(--inset-r, 20px) var(--inset-b, 24px) var(--inset-l, 20px);
    transition: padding var(--dur-slow) var(--ease-out);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .head .dim {
    flex: 1;
  }
  .tiles {
    display: grid;
    gap: 14px;
    justify-content: center;
  }
  .tile {
    display: grid;
    gap: 6px;
    padding: 0;
    background: transparent;
    text-align: left;
  }
  .tile:hover .frame,
  .tile:focus-visible .frame {
    outline: 2px solid var(--brand);
  }
  .frame {
    position: relative;
    overflow: hidden;
    border-radius: 4px;
    box-shadow: var(--elev-3);
    pointer-events: none;
  }
  .stage {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
    background: #000;
    overflow: hidden;
  }
  .name {
    font-size: 11.5px;
    color: var(--text-dim);
  }
</style>
