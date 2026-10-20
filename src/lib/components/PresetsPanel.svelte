<script lang="ts">
  // Layout presets for the current screen and colour palettes for the whole theme.
  import { ed } from '$lib/editor.svelte';
  import { viewLabel } from '$lib/friendly';
  import { appliedDesign, appliedLayout, appliedSystemLayout, layoutsFor, paletteCoverage, PALETTES, type LayoutPreset, type Rect } from '$lib/theme/presets';
  import Icon from './Icon.svelte';
  import DesignThumb from './DesignThumb.svelte';
  import { DESIGNS, designAssets, type Design } from '$lib/theme/designs';

  const GAME_LISTS = ['basic', 'detailed', 'video'];

  let allLists = $state(true);
  let hideOwn = $state(true);
  let applying = $state(false);

  async function applyDesign(d: Design) {
    applying = true;
    try {
      await ed.applyDesign(d, { hideOwn });
    } finally {
      applying = false;
    }
  }

  const layouts = $derived(layoutsFor(ed.view));
  const current = $derived.by(() => {
    ed.rev;
    return ed.project ? appliedLayout(ed.project, ed.view) : null;
  });
  const isSystem = $derived(ed.view === 'system');
  /** The layout card to tick: on the system screen also the layout a design brought with it. */
  const currentLayout = $derived.by(() => {
    ed.rev;
    return ed.project && isSystem ? appliedSystemLayout(ed.project) : current;
  });
  const sysDesign = $derived.by(() => {
    ed.rev;
    return ed.project ? appliedDesign(ed.project, 'system') : null;
  });

  // How system layouts look: 'auto' keeps the design already there (or each layout's matching
  // design), 'match' always uses the matching one, 'plain' only moves RetroBat's own parts.
  let styleChoice = $state('auto');
  const matching = (l: LayoutPreset) => DESIGNS.find((d) => d.system === l.id) ?? null;
  function styleFor(l: LayoutPreset): Design | null {
    if (!isSystem || styleChoice === 'plain') return null;
    if (styleChoice === 'auto') return sysDesign ?? matching(l) ?? DESIGNS[0];
    if (styleChoice === 'match') return matching(l) ?? sysDesign ?? DESIGNS[0];
    return DESIGNS.find((d) => d.id === styleChoice) ?? null;
  }
  const bgCache = new Map<string, string>();
  function bgOf(d: Design) {
    let u = bgCache.get(d.id);
    if (!u) bgCache.set(d.id, (u = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(designAssets(d)['background.png'])}")`));
    return u;
  }
  const hexA = (h: string, a: number) => `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
  function fillFor(r: Rect, d: Design | null) {
    if (!d) return COLORS[r.role];
    const p = d.palette;
    return r.role === 'carousel' ? hexA(p.accent, 0.95) : r.role === 'art' ? hexA(p.text, 0.32) : r.role === 'logo' ? hexA(p.dim, 0.6) : hexA(p.text, 0.5);
  }
  const targets = $derived(GAME_LISTS.includes(ed.view) && allLists ? GAME_LISTS.filter((v) => ed.viewNames.includes(v)) : [ed.view]);
  const gridSystem = $derived(ed.view === 'system' && !ed.currentView?.elements.has('systemcarousel') && [...(ed.currentView?.elements.values() ?? [])].some((e) => e.type === 'imagegrid'));

  const COLORS: Record<Rect['role'], string> = {
    list: '#378ef0',
    art: '#e8733d',
    text: '#8a8a8a',
    logo: '#b98cff',
    carousel: '#2d9d78',
    info: '#8a8a8a',
  };

  async function apply(l: LayoutPreset) {
    const style = styleFor(l);
    if (style) {
      applying = true;
      try {
        await ed.applyLayout(l, ['system'], style, hideOwn);
      } finally {
        applying = false;
      }
      return;
    }
    await ed.applyLayout(l, targets);
    ed.notify(`“${l.label}” applied to ${targets.map((v) => viewLabel(v)).join(', ')}. Press Ctrl+Z to undo.`);
  }

  function palette(id: string) {
    const p = PALETTES.find((x) => x.id === id)!;
    const n = ed.applyPalette(p);
    ed.notify(n ? `Palette “${p.label}” applied. Press Ctrl+Z to undo.` : 'This theme names its colours differently; change them in the Colours tab.');
  }

  const covered = $derived.by(() => {
    const r = ed.res;
    if (!r) return 0;
    return Math.max(0, ...PALETTES.map((p) => paletteCoverage(p, r)));
  });
</script>

<div class="presets">
  <section>
    <h4>Designs</h4>
    <p class="dim note">A complete look for every screen: artwork, colours, font, animations, and all of RetroBat's game and system data placed for you.</p>
    <label class="chk"><input type="checkbox" bind:checked={hideOwn} /> Hide this theme's own decorations</label>
    <div class="designs">
      {#each DESIGNS as d (d.id)}
        <button class="dcard" class:on={current === `design-${d.id}`} onclick={() => applyDesign(d)} title={d.description} disabled={applying}>
          <DesignThumb design={d} />
          <span class="name">
            {#if current === `design-${d.id}`}<Icon name="check" size={12} />{/if}
            {d.label}
          </span>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h4>Layout of {viewLabel(ed.view)}</h4>
    {#if !layouts.length}
      <p class="faint note">There are no layout presets for this screen.</p>
    {:else}
      {#if isSystem}
        <p class="dim note">How the consoles are laid out: a carousel, a wheel, an arc or a grid of tiles. Pick a style to get the background, colours, fonts, console picture, name, maker and game count placed to match.</p>
        <label class="style">
          <span>Style</span>
          <select bind:value={styleChoice}>
            <option value="auto">{sysDesign ? `Current design (${sysDesign.label})` : 'Matching design for each layout'}</option>
            {#if sysDesign}<option value="match">Matching design for each layout</option>{/if}
            <option value="plain">No design: keep the theme's own look</option>
            <optgroup label="Designs">
              {#each DESIGNS as d (d.id)}<option value={d.id}>{d.label}</option>{/each}
            </optgroup>
          </select>
        </label>
        {#if styleChoice === 'plain'}
          <p class="faint note">Only RetroBat's carousel (or grid) and its game count move. The theme's decorations stay where they are.</p>
        {/if}
      {:else}
        <p class="dim note">Moves the parts RetroBat draws itself (game list, picture, description, carousel). Decorations made for this theme stay where they are, so presets suit simple and new themes best.</p>
      {/if}
      {#if gridSystem}
        <p class="warn note">This theme shows consoles in a grid, not a carousel. A carousel preset adds a carousel that may overlap the grid.</p>
      {/if}
      {#if GAME_LISTS.includes(ed.view)}
        <label class="chk"><input type="checkbox" bind:checked={allLists} /> Apply to all game list screens</label>
      {/if}
      <div class="grid">
        {#each layouts as l (l.id)}
          {@const st = styleFor(l)}
          <button class="card" class:on={currentLayout === l.id} onclick={() => apply(l)} title={l.description} disabled={applying}>
            <svg viewBox="0 0 160 90" class="pic" aria-hidden="true" style:background-image={st ? bgOf(st) : undefined}>
              {#if !st}<rect x="0" y="0" width="160" height="90" fill="#141414" />{/if}
              {#each l.diagram as r}
                <rect x={r.x * 160} y={r.y * 90} width={r.w * 160} height={r.h * 90} rx={st ? Math.min(st.radius / 8, 4) : 2} fill={fillFor(r, st)} opacity={r.role === 'text' || r.role === 'info' ? 0.55 : 0.9} />
                {#if r.role === 'list'}
                  {#each Array(Math.max(2, Math.floor((r.h * 90) / 8))) as _, i}
                    <rect x={r.x * 160 + 3} y={r.y * 90 + 3 + i * 8} width={r.w * 160 - 6} height="4" rx="1" fill="#fff" opacity={i === 1 ? 0.9 : 0.35} />
                  {/each}
                {/if}
              {/each}
            </svg>
            <span class="name">
              {#if currentLayout === l.id}<Icon name="check" size={12} />{/if}
              {l.label}
            </span>
            <small>{l.description}</small>
            {#if st}<small class="in">in {st.label}</small>{/if}
          </button>
        {/each}
      </div>
    {/if}
  </section>

  <section>
    <h4>Colour palettes</h4>
    {#if covered === 0}
      <p class="faint note">This theme names its colours its own way, so palettes can't map onto it. Change its colours in the Colours tab instead. Themes made with “New theme” work with palettes.</p>
    {:else}
      <div class="pals">
        {#each PALETTES as p (p.id)}
          <button class="pal" onclick={() => palette(p.id)} title="Apply the {p.label} palette">
            <span class="sw">
              {#each ['bgColor', 'accentColor', 'textColor', 'dimTextColor'] as k}
                <span style:background="#{p.colors[k].slice(0, 6)}"></span>
              {/each}
            </span>
            <span>{p.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .presets {
    padding: 8px 10px 16px;
  }
  h4 {
    margin: 6px 0 6px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }
  section + section {
    margin-top: 14px;
  }
  .note {
    margin: 0 0 8px;
    font-size: 11.5px;
  }
  .warn {
    color: var(--warn);
  }
  .chk {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 8px;
    color: var(--text-dim);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .card {
    display: grid;
    gap: 4px;
    text-align: left;
    white-space: normal;
    padding: 6px;
    background: var(--bg);
    border: 1px solid #3a3a3a;
    border-radius: 6px;
  }
  .card:hover {
    border-color: var(--accent);
  }
  .card.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .style {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
    color: var(--text-dim);
  }
  .style select {
    min-width: 0;
  }
  small.in {
    color: var(--accent);
  }
  .card:disabled {
    opacity: 0.6;
  }
  .pic {
    background-size: cover;
    width: 100%;
    border-radius: 3px;
    display: block;
  }
  .name {
    display: flex;
    gap: 4px;
    align-items: center;
    font-weight: 600;
  }
  .card.on .name {
    color: var(--accent);
  }
  small {
    color: var(--text-faint);
    font-size: 10.5px;
    line-height: 1.3;
  }
  .designs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .dcard {
    display: grid;
    gap: 4px;
    padding: 5px;
    background: var(--bg);
    border: 1px solid #3a3a3a;
    border-radius: 6px;
    text-align: left;
  }
  .dcard:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .dcard.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .dcard.on .name {
    color: var(--accent);
  }
  .pals {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .pal {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg);
    border: 1px solid #3a3a3a;
    border-radius: 6px;
    padding: 6px 8px;
    text-align: left;
  }
  .pal:hover {
    border-color: var(--accent);
  }
  .sw {
    display: flex;
    border-radius: 3px;
    overflow: hidden;
    flex: none;
  }
  .sw span {
    width: 10px;
    height: 20px;
  }
</style>
