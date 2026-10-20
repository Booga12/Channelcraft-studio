<script lang="ts">
  // Layout presets for the current screen and colour palettes for the whole theme.
  import { ed } from '$lib/editor.svelte';
  import { viewLabel } from '$lib/friendly';
  import { appliedLayout, layoutsFor, paletteCoverage, PALETTES, type LayoutPreset, type Rect } from '$lib/theme/presets';
  import Icon from './Icon.svelte';

  const GAME_LISTS = ['basic', 'detailed', 'video'];

  let allLists = $state(true);

  const layouts = $derived(layoutsFor(ed.view));
  const current = $derived.by(() => {
    ed.rev;
    return ed.project ? appliedLayout(ed.project, ed.view) : null;
  });
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

  function apply(l: LayoutPreset) {
    ed.applyLayout(l, targets);
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
    <h4>Layout of {viewLabel(ed.view)}</h4>
    {#if !layouts.length}
      <p class="faint note">There are no layout presets for this screen.</p>
    {:else}
      <p class="dim note">Moves the parts RetroBat draws itself (game list, picture, description, carousel). Decorations made for this theme stay where they are, so presets suit simple and new themes best.</p>
      {#if gridSystem}
        <p class="warn note">This theme shows consoles in a grid, not a carousel. A carousel preset adds a carousel that may overlap the grid.</p>
      {/if}
      {#if GAME_LISTS.includes(ed.view)}
        <label class="chk"><input type="checkbox" bind:checked={allLists} /> Apply to all game list screens</label>
      {/if}
      <div class="grid">
        {#each layouts as l (l.id)}
          <button class="card" class:on={current === l.id} onclick={() => apply(l)} title={l.description}>
            <svg viewBox="0 0 160 90" class="pic" aria-hidden="true">
              <rect x="0" y="0" width="160" height="90" fill="#141414" />
              {#each l.diagram as r}
                <rect x={r.x * 160} y={r.y * 90} width={r.w * 160} height={r.h * 90} rx="2" fill={COLORS[r.role]} opacity={r.role === 'text' || r.role === 'info' ? 0.55 : 0.9} />
                {#if r.role === 'list'}
                  {#each Array(Math.max(2, Math.floor((r.h * 90) / 8))) as _, i}
                    <rect x={r.x * 160 + 3} y={r.y * 90 + 3 + i * 8} width={r.w * 160 - 6} height="4" rx="1" fill="#fff" opacity={i === 1 ? 0.9 : 0.35} />
                  {/each}
                {/if}
              {/each}
            </svg>
            <span class="name">
              {#if current === l.id}<Icon name="check" size={12} />{/if}
              {l.label}
            </span>
            <small>{l.description}</small>
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
  .pic {
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
