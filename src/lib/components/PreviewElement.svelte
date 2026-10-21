<script lang="ts">
  import { ed } from '$lib/editor.svelte';
  import { fileUrl } from '$lib/api';
  import { renderText, type ExprEnv } from '$lib/theme/expr';
  import { resolveAsset, resolveAssetWithFallbacks, type ResolvedElement } from '$lib/theme/resolver';
  import { cssColor, parsePair } from '$lib/theme/schema';
  import { MOCK_GAME, MOCK_GAMES, type SystemInfo } from '$lib/theme/systems';
  import type { Resolution } from '$lib/theme/resolver';
  import type { Environment } from '$lib/theme/context';
  import { animationCss, screenOf } from '$lib/theme/animations';
  import { shaderOf, shadowCss, SHADOW_TYPES } from '$lib/theme/shadow';

  function relativeDate(iso: string): string {
    const d = new Date(`${iso.slice(0, 4)}-${iso.slice(4, 6)}-${iso.slice(6, 8)}T00:00:00`);
    const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
    if (!Number.isFinite(days)) return 'unknown';
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.round(days / 30)} months ago`;
    return `${Math.round(days / 365)} years ago`;
  }
  import { alphaOf, boxOf, familyFor, fontState, formatDate, imageSize, isWhite, opaque, stretchedSvg, svgState } from '$lib/preview.svelte';
  import { zOf } from '$lib/render';
  import { isDataBound, usesGameData } from '$lib/theme/library';
  import { elementLabel } from '$lib/friendly';

  let {
    el,
    W,
    H,
    exprEnv,
    selected,
    ghost,
    carousel,
    res,
    env,
    view,
    locked = false,
    animate = false,
    play,
    z,
  }: {
    el: ResolvedElement;
    W: number;
    H: number;
    exprEnv: ExprEnv;
    selected: boolean;
    ghost: boolean;
    carousel: { logo: ResolvedElement | null; logoText: ResolvedElement | null; systems: SystemInfo[]; logoFor: (sys: SystemInfo) => string | null };
    res: Resolution;
    env: Environment;
    view: string;
    locked?: boolean;
    /** Play the element's storyboard animation as a CSS approximation. */
    animate?: boolean;
    /** Which game or console is shown and which way the list last moved, so motion replays. */
    play?: { token: string; dir: number };
    /** Stacking position when the screen has a fixed drawing order (loading screens). */
    z?: number;
  } = $props();

  /** Where RetroBat's own artwork elements get their pictures from in the game's data. */
  const NATIVE_MEDIA: Record<string, string[]> = {
    md_image: ['image', 'thumbnail', 'boxart'],
    md_thumbnail: ['thumbnail', 'boxart', 'image'],
    md_marquee: ['marquee', 'wheel'],
    md_video: ['image', 'thumbnail'],
    md_fanart: ['fanart', 'image'],
    md_boxart: ['boxart', 'thumbnail'],
    md_wheel: ['wheel', 'marquee'],
    md_cartridge: ['cartridge'],
    md_titleshot: ['titleshot', 'image'],
    md_mix: ['mix', 'image'],
  };

  const game = $derived(env.game ?? MOCK_GAME);

  const val = (k: string) => el.props.get(k)?.value;
  const num = (k: string, d: number) => {
    const n = parseFloat(val(k) ?? '');
    return Number.isFinite(n) ? n : d;
  };
  const asset = (k: string) => (ed.project ? resolveAssetWithFallbacks(el, k, res, ed.project, env) : null);
  /** A path written as a data expression, e.g. firstfile({game:boxart}, {game:image}). */
  const exprAsset = (k: string): string | null => {
    // Each <path> in the winning definition is a fallback, tried in order, as RetroBat does.
    const h = el.history.get(k) ?? [];
    const last = h[h.length - 1];
    const values = last ? h.filter((d) => d.node.parent === last.node.parent).map((d) => d.value) : [val(k)];
    for (const v of values) {
      if (!v || !/[{(]/.test(v)) continue;
      const r = renderText(v, exprEnv).trim();
      if (r && !r.includes('{') && /^[A-Za-z]:[\\/]|^\\\\/.test(r)) return r;
    }
    return null;
  };
  const nativeMedia = (): string | null => {
    const keys = NATIVE_MEDIA[el.name];
    if (!keys || !env.game) return null;
    for (const k of keys) if (env.game.media[k]) return env.game.media[k];
    return null;
  };

  /** Game data on the console screen, where RetroBat has no game: it draws nothing there. */
  const emptyInRetrobat = $derived(ed.view === 'system' && (el.type === 'image' || el.type === 'video') && usesGameData(val('path')));

  const box = $derived(boxOf(el, W, H));
  let natural = $state<{ w: number; h: number } | null>(null);

  function onImgLoad(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    natural = { w: img.naturalWidth, h: img.naturalHeight };
  }

  const imgPath = $derived(el.type === 'image' || el.type === 'video' ? (asset('path') ?? exprAsset('path') ?? nativeMedia() ?? asset('default')) : null);
  /** A real game video to play in video elements. */
  // Only RetroBat's own game video plays without a path; any other video needs one, as in RetroBat.
  const videoPath = $derived.by(() => {
    if (el.type !== 'video') return null;
    // A video file in the theme (e.g. a featured game's copied video) plays as it is.
    const own = asset('path');
    if (own && /\.(mp4|webm|mkv|avi)$/i.test(own)) return own;
    if (!env.game) return null;
    return exprAsset('path') ?? (el.name === 'md_video' ? env.game.media.video : null) ?? null;
  });
  $effect(() => {
    imgPath;
    natural = null;
  });

  /** With both sides of `size` set, RetroBat stretches the picture (SVGs too) to fill it exactly. */
  const stretch = $derived.by(() => {
    const sz = parsePair(val('size'));
    return !!sz && sz[0] > 0 && sz[1] > 0;
  });
  function displayUrl(p: string): string {
    const u = fileUrl(p);
    if (!stretch || !/\.svg$/i.test(p)) return u;
    svgState.loaded;
    return stretchedSvg(u) ?? u;
  }

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
    const g = game;
    switch (el.name) {
      case 'logoText':
        return env.settings.system.fullName;
      case 'systemInfo':
        return env.gameNames ? `${env.gameNames.length} games available` : '128 games available';
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
      if (el.name === 'md_lastplayed') return !g.lastplayed ? 'never' : val('displayRelative') === 'false' ? formatDate(g.lastplayed, val('format')) : relativeDate(g.lastplayed);
      return g.releasedate ? formatDate(g.releasedate, val('format')) : 'unknown';
    }
    // RetroBat ignores a theme's clock format: its ClockMode12 setting decides.
    if (el.type === 'clock') return formatDate('20261019T201500', ed.root?.es?.clock12 ? '%I:%M %p' : '%H:%M');
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
    const base = `translate(${-box.ox * 100}%, ${-box.oy * 100}%) rotate(${box.rotation}deg)`;
    const s = [`left:${box.x}px`, `top:${box.y}px`, `z-index:${z ?? Math.round(zOf(el) * 10) + 1000}`, `transform:${base}`, `transform-origin:${box.rox * 100}% ${box.roy * 100}%`];
    const anim = animate ? animationCss(el, W, H, base, { screen: screenOf(view), token: play?.token, dir: play?.dir }) : null;
    if (anim) s.push(`animation:${anim}`);
    const shader = SHADOW_TYPES.has(el.type) ? shaderOf(el) : null;
    if (shader?.shadow) s.push(`filter:${shadowCss(shader.offset, H)}`);
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
    const names = env.gameNames ?? MOCK_GAMES;
    return Array.from({ length: count }, (_, i) => names[i % names.length]);
  });

  // ---- carousel ----
  // Laid out the way EmulationStation's SystemView does it: logos spaced across the carousel
  // (horizontal / vertical), or all on one spot and turned around a far-away point (wheels).
  const carouselItems = $derived.by(() => {
    if (el.type !== 'carousel') return [];
    const type = (val('type') ?? 'horizontal').trim();
    const n = Math.max(1, Math.round(num('maxLogoCount', 3)));
    const cw = box.w ?? W;
    const ch = box.h ?? H * 0.2325;
    const ls = parsePair(val('logoSize')) ?? [0.25, 0.155];
    const lw = ls[0] * W;
    const lh = ls[1] * H;
    const L = Math.max(1, num('logoScale', 1.2));
    const logoAlign = (val('logoAlignment') ?? 'center').trim();
    const wheel = type.endsWith('_wheel');
    const rot = num('logoRotation', 7.5);
    const ro = parsePair(val('logoRotationOrigin')) ?? (type === 'horizontal_wheel' ? [0.5, -5] : [-5, 0.5]);
    const minOp = num('minLogoOpacity', 0.5);
    const isVertical = type.startsWith('vertical');
    let sx = 0;
    let sy = 0;
    let xOff: number;
    let yOff: number;
    if (isVertical) {
      if (type === 'vertical') sy = (ch - lh * n) / n + lh;
      yOff = (ch - lh) / 2;
      xOff = logoAlign === 'left' ? lw / 10 : logoAlign === 'right' ? cw - lw * 1.1 : (cw - lw) / 2;
    } else {
      if (type !== 'horizontal_wheel') sx = (cw - lw * n) / n + lw;
      xOff = (cw - lw) / 2;
      yOff = logoAlign === 'top' ? lh / 10 : logoAlign === 'bottom' ? ch - lh * 1.1 : (ch - lh) / 2;
    }
    const list = carousel.systems;
    const cur = Math.max(0, list.findIndex((s) => s.name === env.settings.system.name));
    // RetroBat also draws a couple of logos past each end (they're clipped by the carousel box).
    const reach = n === 1 ? 0 : Math.floor(n / 2) + 2;
    const items: { sys: SystemInfo; logo: string | null; selected: boolean; x: number; y: number; w: number; h: number; transform: string; opacity: number; z: number }[] = [];
    for (let k = -reach; k <= reach; k++) {
      const sys = list.length ? list[(((cur + k) % list.length) + list.length) % list.length] : env.settings.system;
      const d = Math.abs(k);
      const scale = Math.min(L, Math.max(1, 1 + (L - 1) * (1 - d))) / L;
      const opacity = Math.min(1, Math.max(minOp, (0x80 + 0x7f * (1 - d)) / 255));
      // The logo is sized to logoSize × logoScale and centred on its slot, then scaled down.
      const w = lw * L;
      const h = lh * L;
      const dx = (ro[0] - 0.5) * w;
      const dy = (ro[1] - 0.5) * h;
      const transform = wheel ? `scale(${scale}) translate(${dx}px, ${dy}px) rotate(${rot * k}deg) translate(${-dx}px, ${-dy}px)` : `scale(${scale})`;
      items.push({ sys, logo: logoFor(sys), selected: k === 0, x: k * sx + xOff + lw / 2 - w / 2, y: k * sy + yOff + lh / 2 - h / 2, w, h, transform, opacity, z: 100 - d });
    }
    return items;
  });

  const logoFor = (sys: SystemInfo) => carousel.logoFor(sys);

  /** The carousel's own background: RetroBat's default is a translucent white band. */
  const carouselBg = $derived.by(() => {
    if (el.type !== 'carousel') return 'transparent';
    const c = val('color') ?? 'FFFFFFD8';
    const end = val('colorEnd');
    return end ? `linear-gradient(${val('gradientType') === 'horizontal' ? 'to right' : 'to bottom'}, ${cssColor(c)}, ${cssColor(end)})` : cssColor(c, 'transparent');
  });

  // ---- rating ----
  /** Share of the five stars that are filled: RetroBat ratings go from 0 to 1. */
  const stars = $derived(Math.max(0, Math.min(1, Number(game.rating) || 0)));

  // ---- imagegrid ----
  const grid = $derived.by(() => {
    if (el.type !== 'imagegrid') return null;
    const layout = parsePair(val('autoLayout')) ?? [4, 3];
    const cols = Math.max(1, Math.round(layout[0]));
    const rowsN = Math.max(1, Math.round(layout[1]));
    const els = res.views.get(view)?.elements;
    const tile = els?.get('default');
    const sel = els?.get('selected');
    const margin = parsePair(val('margin')) ?? [0.01, 0.02];
    const zoom = parseFloat(val('autoLayoutSelectedZoom') ?? '1') || 1;
    // With centerSelection the selected tile sits in the middle; otherwise it's the first one.
    const selIndex = val('centerSelection') === 'true' ? Math.floor((cols * rowsN) / 2) : 0;
    const radius = (t: typeof tile) => (parsePair(t?.props.get('backgroundCornerSize')?.value)?.[0] ?? 12) * 0.9;
    const logoAlpha = (name: string, d: number) => {
      const c = els?.get(name)?.props.get('color')?.value;
      return c && c.length === 8 ? parseInt(c.slice(6), 16) / 255 : d;
    };
    return {
      cols,
      rows: rowsN,
      tile,
      sel,
      gapX: margin[0] * W,
      gapY: margin[1] * H,
      zoom,
      selIndex,
      radius: radius(tile),
      selRadius: radius(sel),
      logoAlpha: logoAlpha('gridtile.image', 1),
      selLogoAlpha: logoAlpha('gridtile.image:selected', 1),
    };
  });

  const ninepatch = $derived(el.type === 'ninepatch' ? asset('path') : null);
  const corner = $derived(parsePair(val('cornerSize')) ?? [16, 16]);

  const helpColor = $derived(cssColor(val('textColor'), '#bbb'));
  const helpIcon = $derived(cssColor(val('iconColor'), '#bbb'));
</script>

<div class="el {el.type}" class:selected class:ghost class:locked data-name={el.name} style={wrapStyle}>
  {#if el.type === 'image'}
    {#if imgPath}
      {@const url = displayUrl(imgPath)}
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
    {:else if emptyInRetrobat}
      <div class="placeholder empty" style:min-width="{outer.w ?? 120}px" style:min-height="{outer.h ?? 60}px" title="This uses the current game's picture, but the console screen has no game, so RetroBat shows nothing here. Select it to switch to a random game's picture.">
        <span>{elementLabel(el.name)} · empty in RetroBat</span>
      </div>
    {:else}
      {@const data = isDataBound(el.props.get('path')?.value) || el.name.startsWith('md_')}
      <div class="placeholder" class:data style:min-width="{outer.w ?? 120}px" style:min-height="{outer.h ?? 60}px">
        <span>{elementLabel(el.name)}{data ? ' · RetroBat data' : ''}</span>
      </div>
    {/if}
  {:else if el.type === 'text' || el.type === 'datetime' || el.type === 'clock'}
    <div class="text" class:wrap={box.w !== null} style={textStyle}>
      {#if box.w !== null && box.h !== null && box.h > 0}
        <!-- RetroBat cuts text that doesn't fit its box with "..." after the last full line. -->
        <span class="clamp" style:-webkit-line-clamp={Math.max(1, Math.floor(box.h / (fontPx * num('lineSpacing', 1.5)) + 0.05))}>{textContent()}</span>
      {:else}
        {textContent()}
      {/if}
    </div>
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
    {@const lt = carousel.logoText}
    {@const ltFont = familyFor(lt && ed.project ? resolveAsset(lt.props.get('fontPath'), res, ed.project, env) : null)}
    <div class="carousel" style:background={carouselBg}>
      {#each carouselItems as it}
        <div class="logo" style="left:{it.x}px;top:{it.y}px;width:{it.w}px;height:{it.h}px;transform:{it.transform};opacity:{it.opacity};z-index:{it.z}">
          {#if it.logo}
            <img src={fileUrl(it.logo)} alt="" draggable="false" />
          {:else}
            <span
              style="font-family:{ltFont};font-size:{parseFloat(lt?.props.get('fontSize')?.value ?? '0.07') * H * 0.6}px;color:{cssColor(lt?.props.get('color')?.value, '#fff')};{lt?.props.get('forceUppercase')?.value === 'true' ? 'text-transform:uppercase' : ''}"
              >{it.sys.fullName}</span
            >
          {/if}
        </div>
      {/each}
    </div>
  {:else if el.type === 'rating'}
    {@const h = box.h ?? 0.06 * H}
    {@const filled = asset('filledPath')}
    {@const unfilled = asset('unfilledPath')}
    <!-- Like RetroBat: unfilled stars underneath, filled stars on top cut at the rating (3.5 stars shows half a star). -->
    <div class="rating" style:height="{h}px">
      <div class="stars">
        {#each [0, 1, 2, 3, 4] as _}
          {#if filled && unfilled}
            <img src={fileUrl(unfilled)} alt="" style:height="{h}px" draggable="false" />
          {:else}
            <span style:font-size="{h}px" style:color={cssColor(val('unfilledColor') ?? val('color'), '#ffd34d')} style:opacity={val('unfilledColor') ? 1 : 0.3}>★</span>
          {/if}
        {/each}
      </div>
      <div class="stars on" style:width="{stars * 100}%">
        {#each [0, 1, 2, 3, 4] as _}
          {#if filled && unfilled}
            <img src={fileUrl(filled)} alt="" style:height="{h}px" draggable="false" />
          {:else}
            <span style:font-size="{h}px" style:color={cssColor(val('color'), '#ffd34d')}>★</span>
          {/if}
        {/each}
      </div>
    </div>
  {:else if el.type === 'video'}
    <div class="video" style:width="{outer.w ?? 0.3 * W}px" style:height="{outer.h ?? 0.3 * H}px">
      {#if videoPath && /\.(mp4|webm)$/i.test(videoPath)}
        {#key videoPath}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video src={fileUrl(videoPath)} autoplay muted loop playsinline poster={imgPath ? fileUrl(imgPath) : undefined}></video>
        {/key}
      {:else if imgPath && /\.(png|jpe?g|svg|gif|webp)$/i.test(imgPath)}
        <img src={fileUrl(imgPath)} alt="" draggable="false" onload={onImgLoad} />
      {:else if emptyInRetrobat}
        <div class="placeholder empty" title="This plays the current game's video, but the console screen has no game, so RetroBat shows nothing here. Select it to switch to a random game's video."><span>▶ {elementLabel(el.name)} · empty in RetroBat</span></div>
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
    {@const systemGrid = view === 'system'}
    {@const list = carousel.systems}
    {@const cur = Math.max(0, list.findIndex((s) => s.name === env.settings.system.name))}
    <div
      class="grid"
      style:grid-template-columns="repeat({grid.cols}, minmax(0, 1fr))"
      style:grid-template-rows="repeat({grid.rows}, minmax(0, 1fr))"
      style:column-gap="{grid.gapX}px"
      style:row-gap="{grid.gapY}px"
    >
      {#each Array(grid.cols * grid.rows) as _, i}
        {@const on = i === grid.selIndex}
        {@const sys = list[(cur + i - grid.selIndex + list.length * 10) % Math.max(1, list.length)]}
        {@const logo = systemGrid && sys ? logoFor(sys) : null}
        <div
          class="tile"
          class:on
          style:background={cssColor((on ? grid.sel : grid.tile)?.props.get('backgroundColor')?.value, on ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)')}
          style:border-radius="{on ? grid.selRadius : grid.radius}px"
          style:transform={on && grid.zoom !== 1 ? `scale(${grid.zoom})` : undefined}
          style:z-index={on ? 2 : 1}
        >
          {#if logo}
            <img src={fileUrl(logo)} alt="" draggable="false" style:opacity={on ? grid.selLogoAlpha : grid.logoAlpha} />
          {:else}
            <span>{systemGrid ? (sys?.fullName ?? '') : (env.gameNames ?? MOCK_GAMES)[i % (env.gameNames ?? MOCK_GAMES).length]}</span>
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
  /* Names of empty placeholders only show for the selected element, to keep the canvas clean. */
  .placeholder span {
    visibility: hidden;
  }
  .el.selected .placeholder span,
  .el:hover .placeholder span,
  .placeholder.data span {
    visibility: visible;
  }
  /* Nothing will show here in RetroBat: a red frame that says so. */
  .placeholder.empty {
    background: rgba(230, 70, 70, 0.08);
    border: 2px dashed rgba(230, 90, 90, 0.6);
    color: rgba(255, 200, 200, 0.85);
    font-size: 16px;
    text-align: center;
  }
  .placeholder.empty span {
    visibility: visible;
  }
  /* Artwork RetroBat fills in per game: a blue frame with its name. */
  .placeholder.data {
    background: rgba(55, 142, 240, 0.08);
    border: 2px dashed rgba(55, 142, 240, 0.45);
    color: rgba(191, 224, 255, 0.8);
    font-size: 18px;
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
    overflow-wrap: break-word;
  }
  .clamp {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
    max-width: 100%;
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
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .logo {
    position: absolute;
    display: grid;
    place-items: center;
    transform-origin: 50% 50%;
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
    position: relative;
    display: inline-flex;
    line-height: 1;
  }
  .stars {
    display: flex;
    align-items: center;
    gap: 2px;
    white-space: nowrap;
  }
  .stars.on {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    overflow: hidden;
  }
  .video {
    background: #000;
    display: grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.5);
    font: 600 26px 'Segoe UI', sans-serif;
    overflow: hidden;
  }
  .video img,
  .video video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  /* Locked layers can't be picked on the canvas; clicks go to what's underneath. */
  .el.locked {
    pointer-events: none;
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
