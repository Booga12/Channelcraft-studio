<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import { fileUrl } from '$lib/api';
  import { renderText, type ExprEnv } from '$lib/theme/expr';
  import { resolveAsset, resolveAssetWithFallbacks, type ResolvedElement } from '$lib/theme/resolver';
  import { cssColor, parsePair } from '$lib/theme/schema';
  import { MOCK_GAME, MOCK_GAMES, type SystemInfo } from '$lib/theme/systems';
  import { alphaOf, boxOf, familyFor, fontState, formatDate, imageSize, isWhite, opaque } from '$lib/preview.svelte';
  import { zOf } from '$lib/render';

  let {
    el,
    W,
    H,
    exprEnv,
    selected,
    ghost,
    carousel,
  }: {
    el: ResolvedElement;
    W: number;
    H: number;
    exprEnv: ExprEnv;
    selected: boolean;
    ghost: boolean;
    carousel: { logo: ResolvedElement | null; logoText: ResolvedElement | null; systems: SystemInfo[]; logoFor: (sys: SystemInfo) => string | null };
  } = $props();

  const val = (k: string) => el.props.get(k)?.value;
  const num = (k: string, d: number) => {
    const n = parseFloat(val(k) ?? '');
    return Number.isFinite(n) ? n : d;
  };
  const asset = (k: string) => (ed.res && ed.project ? resolveAssetWithFallbacks(el, k, ed.res, ed.project, ed.env) : null);

  const box = $derived(boxOf(el, W, H));
  let natural = $state<{ w: number; h: number } | null>(null);

  function onImgLoad(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    natural = { w: img.naturalWidth, h: img.naturalHeight };
  }

  const imgPath = $derived(el.type === 'image' || el.type === 'video' ? (asset('path') ?? asset('default')) : null);
  $effect(() => {
    imgPath;
    natural = null;
  });

  const imgSize = $derived(el.type === 'image' || el.type === 'video' ? imageSize(el, W, H, natural) : null);

  /** The size the wrapper takes: explicit size, fitted image size, or content. */
  const outer = $derived.by(() => {
    if (imgSize) return imgSize;
    return { w: box.w, h: box.h };
  });

  const font = $derived.by(() => {
    fontState.loaded;
    const p = asset('fontPath');
    return familyFor(p);
  });
  const fontPx = $derived(num('fontSize', 0.045) * H);
  const align = $derived((val('alignment') ?? 'left').trim());
  const upper = $derived(val('forceUppercase')?.trim().toLowerCase() === 'true' || val('forceUppercase')?.trim() === '1');

  const LABELS: Record<string, string> = {
    md_lbl_rating: 'Rating:',
    md_lbl_releasedate: 'Released:',
    md_lbl_developer: 'Developer:',
    md_lbl_publisher: 'Publisher:',
    md_lbl_genre: 'Genre:',
    md_lbl_players: 'Players:',
    md_lbl_lastplayed: 'Last played:',
    md_lbl_playcount: 'Times played:',
  };

  function textContent(): string {
    const t = el.props.get('text');
    if (t) return renderText(t.value, exprEnv);
    const g = MOCK_GAME;
    switch (el.name) {
      case 'logoText':
        return ed.settings.system.fullName;
      case 'systemInfo':
        return '128 games available';
      case 'md_description':
        return g.description;
      case 'md_developer':
        return g.developer;
      case 'md_publisher':
        return g.publisher;
      case 'md_genre':
        return g.genre;
      case 'md_players':
        return g.players;
      case 'md_playcount':
        return g.playcount;
      case 'md_name':
        return g.name;
    }
    if (LABELS[el.name]) return LABELS[el.name];
    if (el.type === 'datetime') {
      if (el.name === 'md_lastplayed') return val('displayRelative') === 'false' ? formatDate(g.lastplayed, val('format')) : '2 days ago';
      return formatDate(g.releasedate, val('format'));
    }
    if (el.type === 'clock') return formatDate('20261019T201500', val('format') ?? '%H:%M');
    return el.name;
  }

  const textStyle = $derived.by(() => {
    const parts = [
      `font-family:${font}`,
      `font-size:${fontPx}px`,
      `color:${cssColor(val('color') ?? val('textColor'), '#fff')}`,
      `line-height:${num('lineSpacing', 1.5)}`,
      `text-align:${align}`,
      `justify-content:${align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'}`,
      `align-items:${val('verticalAlignment') === 'top' ? 'flex-start' : val('verticalAlignment') === 'bottom' ? 'flex-end' : 'center'}`,
    ];
    if (upper) parts.push('text-transform:uppercase');
    const bg = val('backgroundColor');
    if (bg) parts.push(`background:${cssColor(bg)}`);
    const glow = val('glowColor');
    if (glow && num('glowSize', 0) > 0) parts.push(`text-shadow:0 0 ${num('glowSize', 0) * 2}px ${cssColor(glow)}`);
    return parts.join(';');
  });

  const wrapStyle = $derived.by(() => {
    const s = [`left:${box.x}px`, `top:${box.y}px`, `z-index:${Math.round(zOf(el) * 10) + 1000}`, `transform:translate(${-box.ox * 100}%, ${-box.oy * 100}%) rotate(${box.rotation}deg)`, `transform-origin:${box.rox * 100}% ${box.roy * 100}%`];
    if (outer.w !== null) s.push(`width:${outer.w}px`);
    if (outer.h !== null) s.push(`height:${outer.h}px`);
    const op = num('opacity', 1);
    s.push(`opacity:${ghost ? 0.3 : op}`, `--ox:${box.ox * 100}%`, `--oy:${box.oy * 100}%`);
    return s.join(';');
  });

  const tint = $derived(val('color'));
  const tintEnd = $derived(val('colorEnd'));

  // ---- textlist ----
  const rows = $derived.by(() => {
    if (el.type !== 'textlist') return [];
    const rowH = fontPx * num('lineSpacing', 1.5);
    const count = Math.max(1, Math.floor((box.h ?? H * 0.5) / rowH));
    return Array.from({ length: count }, (_, i) => MOCK_GAMES[i % MOCK_GAMES.length]);
  });

  // ---- carousel ----
  const carouselItems = $derived.by(() => {
    if (el.type !== 'carousel') return [];
    const n = Math.max(1, Math.round(num('maxLogoCount', 3)));
    const list = carousel.systems;
    const cur = Math.max(0, list.findIndex((s) => s.name === ed.settings.system.name));
    const half = Math.floor(n / 2);
    const items: { sys: SystemInfo; logo: string | null; selected: boolean }[] = [];
    for (let k = -half; k < n - half; k++) {
      const sys = list[(cur + k + list.length * 10) % list.length] ?? ed.settings.system;
      items.push({ sys, logo: logoFor(sys), selected: k === 0 });
    }
    return items;
  });

  const logoFor = (sys: SystemInfo) => carousel.logoFor(sys);

  const vertical = $derived((val('type') ?? 'horizontal').startsWith('vertical'));

  // ---- rating ----
  const stars = $derived(Math.round(MOCK_GAME.rating * 5));

  // ---- imagegrid ----
  const grid = $derived.by(() => {
    if (el.type !== 'imagegrid') return null;
    const layout = parsePair(val('autoLayout')) ?? [4, 3];
    const cols = Math.max(1, Math.round(layout[0]));
    const rowsN = Math.max(1, Math.round(layout[1]));
    const tile = ed.currentView?.elements.get('default');
    const sel = ed.currentView?.elements.get('selected');
    return { cols, rows: rowsN, tile, sel };
  });

  const ninepatch = $derived(el.type === 'ninepatch' ? asset('path') : null);
  const corner = $derived(parsePair(val('cornerSize')) ?? [16, 16]);

  const helpColor = $derived(cssColor(val('textColor'), '#bbb'));
  const helpIcon = $derived(cssColor(val('iconColor'), '#bbb'));
</script>

<div class="el {el.type}" class:selected class:ghost data-name={el.name} style={wrapStyle}>
  {#if el.type === 'image'}
    {#if imgPath}
      {@const url = fileUrl(imgPath)}
      {#if val('tile') === 'true'}
        <div class="fill" style="background-image:url(&quot;{url}&quot;);background-repeat:repeat"></div>
      {:else}
        <img
          src={url}
          alt=""
          draggable="false"
          style:width={outer.w !== null ? `${outer.w}px` : undefined}
          style:height={outer.h !== null ? `${outer.h}px` : undefined}
          style:opacity={alphaOf(tint)}
          style:transform={`scale(${val('flipX') === 'true' ? -1 : 1}, ${val('flipY') === 'true' ? -1 : 1})`}
          onload={onImgLoad}
        />
      {/if}
      {#if !isWhite(tint) || (tintEnd && !isWhite(tintEnd))}
        <div
          class="tint"
          style="mask-image:url(&quot;{url}&quot;);-webkit-mask-image:url(&quot;{url}&quot;);mask-size:{val('tile') === 'true' ? 'auto' : '100% 100%'};-webkit-mask-size:{val('tile') === 'true' ? 'auto' : '100% 100%'};background:{tintEnd ? `linear-gradient(${val('gradientType') === 'horizontal' ? 'to right' : 'to bottom'}, ${opaque(tint)}, ${opaque(tintEnd)})` : opaque(tint)};opacity:{alphaOf(tint)}"
        ></div>
      {/if}
    {:else}
      <div class="placeholder" style:min-width="{outer.w ?? 120}px" style:min-height="{outer.h ?? 60}px">
        <span>{el.name}</span>
      </div>
    {/if}
  {:else if el.type === 'text' || el.type === 'datetime' || el.type === 'clock'}
    <div class="text" class:wrap={box.w !== null} style={textStyle}>{textContent()}</div>
  {:else if el.type === 'textlist'}
    <div class="list" style="font-family:{font};font-size:{fontPx}px;text-align:{align};{upper ? 'text-transform:uppercase' : ''}">
      {#each rows as r, i}
        <div
          class="li"
          style:height="{fontPx * num('lineSpacing', 1.5)}px"
          style:padding="0 {num('horizontalMargin', 0) * W}px"
          style:color={i === 2 ? cssColor(val('selectedColor'), '#fff') : i === 5 ? cssColor(val('secondaryColor'), '#ccc') : cssColor(val('primaryColor'), '#ddd')}
          style:background={i === 2 ? cssColor(val('selectorColor'), 'rgba(255,255,255,0.15)') : 'transparent'}
        >
          {r}
        </div>
      {/each}
    </div>
  {:else if el.type === 'carousel'}
    <div class="carousel" class:vertical style:background={val('colorEnd') ? `linear-gradient(${val('gradientType') === 'horizontal' ? 'to right' : 'to bottom'}, ${cssColor(val('color'))}, ${cssColor(val('colorEnd'))})` : cssColor(val('color'), 'transparent')}>
      {#each carouselItems as it}
        {@const ls = parsePair(val('logoSize')) ?? [0.25, 0.155]}
        <div class="slot" style:width="{vertical ? 100 : 100 / carouselItems.length}%" style:height="{vertical ? 100 / carouselItems.length : 100}%">
          <div class="logo" style:width="{ls[0] * W}px" style:height="{ls[1] * H}px" style:transform="scale({it.selected ? num('logoScale', 1.2) : 1})" style:opacity={it.selected ? 1 : Math.max(num('minLogoOpacity', 0.5), 0.35)}>
            {#if it.logo}
              <img src={fileUrl(it.logo)} alt="" draggable="false" />
            {:else}
              <span
                style="font-family:{familyFor(carousel.logoText && ed.res && ed.project ? resolveAsset(carousel.logoText.props.get('fontPath'), ed.res, ed.project, ed.env) : null)};font-size:{parseFloat(carousel.logoText?.props.get('fontSize')?.value ?? '0.07') * H * 0.6}px;color:{cssColor(carousel.logoText?.props.get('color')?.value, '#fff')}"
                >{it.sys.fullName}</span
              >
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else if el.type === 'rating'}
    {@const h = box.h ?? 0.06 * H}
    {@const filled = asset('filledPath')}
    {@const unfilled = asset('unfilledPath')}
    <div class="rating" style:height="{h}px">
      {#each [0, 1, 2, 3, 4] as i}
        {#if filled && unfilled}
          <img src={fileUrl(i < stars ? filled : unfilled)} alt="" style:height="{h}px" draggable="false" />
        {:else}
          <span style:font-size="{h}px" style:color={cssColor(val('color'), '#ffd34d')} style:opacity={i < stars ? 1 : 0.3}>★</span>
        {/if}
      {/each}
    </div>
  {:else if el.type === 'video'}
    <div class="video" style:width="{outer.w ?? 0.3 * W}px" style:height="{outer.h ?? 0.3 * H}px">
      {#if imgPath && /\.(png|jpe?g|svg|gif|webp)$/i.test(imgPath)}
        <img src={fileUrl(imgPath)} alt="" draggable="false" onload={onImgLoad} />
      {:else}
        <span>▶ video</span>
      {/if}
    </div>
  {:else if el.type === 'ninepatch'}
    {#if ninepatch}
      {@const np = `url("${fileUrl(ninepatch)}") ${corner[1]} ${corner[0]} fill / ${corner[1]}px ${corner[0]}px stretch`}
      <div class="fill" style="border-style:solid;border-width:{corner[1]}px {corner[0]}px;border-image:{np};opacity:{alphaOf(val('color'))}"></div>
      {#if !isWhite(val('color'))}
        <!-- Tint: multiply the colour over the nine-patch, masked to its shape (Chromium supports mask-box-image). -->
        <div class="fill tint" style="background:{opaque(val('color'))};-webkit-mask-box-image:{np};opacity:{alphaOf(val('color'))}"></div>
      {/if}
    {:else}
      <div class="placeholder fill"><span>{el.name}</span></div>
    {/if}
  {:else if el.type === 'helpsystem'}
    <div class="help" style="font-family:{font};font-size:{num('fontSize', 0.025) * H}px;color:{helpColor}">
      {#each [['A', 'Launch'], ['B', 'Back'], ['X', 'Favorite'], ['Y', 'Search']] as [btn, label]}
        <span class="hb"><span class="btn" style:border-color={helpIcon} style:color={helpIcon}>{btn}</span>{label}</span>
      {/each}
    </div>
  {:else if el.type === 'imagegrid' && grid}
    {@const systemGrid = ed.view === 'system'}
    {@const list = carousel.systems}
    {@const cur = Math.max(0, list.findIndex((s) => s.name === ed.settings.system.name))}
    <div class="grid" style:grid-template-columns="repeat({grid.cols}, minmax(0, 1fr))" style:grid-template-rows="repeat({grid.rows}, minmax(0, 1fr))">
      {#each Array(grid.cols * grid.rows) as _, i}
        {@const sys = list[(cur + i) % Math.max(1, list.length)]}
        {@const logo = systemGrid && sys ? logoFor(sys) : null}
        <div class="tile" class:on={i === 0} style:background={cssColor((i === 0 ? grid.sel : grid.tile)?.props.get('backgroundColor')?.value, i === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)')}>
          {#if logo}
            <img src={fileUrl(logo)} alt="" draggable="false" />
          {:else}
            <span>{systemGrid ? (sys?.fullName ?? '') : MOCK_GAMES[i % MOCK_GAMES.length]}</span>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="placeholder" style:min-width="{box.w ?? 80}px" style:min-height="{box.h ?? 40}px"><span>{el.type} {el.name}</span></div>
  {/if}
</div>

<style>
  .el {
    position: absolute;
    display: block;
    cursor: pointer;
  }
  .el.selected {
    outline: calc(2px / var(--s, 1)) solid var(--accent);
    outline-offset: calc(1px / var(--s, 1));
    cursor: move;
  }
  .el.selected::after {
    content: '';
    position: absolute;
    width: calc(8px / var(--s, 1));
    height: calc(8px / var(--s, 1));
    border-radius: 50%;
    background: var(--accent);
    left: var(--ox, 0);
    top: var(--oy, 0);
    transform: translate(-50%, -50%);
  }
  .el img {
    display: block;
    pointer-events: none;
    user-select: none;
  }
  .fill,
  .tint {
    position: absolute;
    inset: 0;
  }
  .tint {
    mix-blend-mode: multiply;
    mask-repeat: no-repeat;
    pointer-events: none;
  }
  .placeholder {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.06) 0 14px, rgba(255, 255, 255, 0.1) 14px 28px);
    border: 2px dashed rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 0.6);
    font: 600 22px 'Segoe UI', sans-serif;
  }
  .text {
    display: flex;
    white-space: nowrap;
    overflow: hidden;
    width: 100%;
    height: 100%;
  }
  .text.wrap {
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .list {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .li {
    display: flex;
    align-items: center;
    white-space: nowrap;
    overflow: hidden;
  }
  .carousel {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
  }
  .carousel.vertical {
    flex-direction: column;
  }
  .slot {
    display: grid;
    place-items: center;
  }
  .logo {
    display: grid;
    place-items: center;
    transition: transform 0.15s;
  }
  .logo img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .logo span {
    text-align: center;
    font-weight: 700;
  }
  .rating {
    display: flex;
    align-items: center;
    gap: 2px;
    line-height: 1;
  }
  .video {
    background: #000;
    display: grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.5);
    font: 600 26px 'Segoe UI', sans-serif;
    overflow: hidden;
  }
  .video img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .help {
    display: flex;
    gap: 1.4em;
    white-space: nowrap;
    align-items: center;
  }
  .hb {
    display: flex;
    gap: 0.4em;
    align-items: center;
  }
  .btn {
    display: inline-grid;
    place-items: center;
    width: 1.4em;
    height: 1.4em;
    border-radius: 50%;
    border: 0.12em solid;
    font-size: 0.8em;
    font-weight: 700;
  }
  .grid {
    display: grid;
    width: 100%;
    height: 100%;
    gap: 12px;
  }
  .tile {
    border-radius: 10px;
    display: grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.75);
    font: 600 18px 'Segoe UI', sans-serif;
    text-align: center;
    padding: 6px;
    min-height: 0;
    overflow: hidden;
  }
  .tile img {
    width: 82%;
    height: 70%;
    object-fit: contain;
  }
</style>
