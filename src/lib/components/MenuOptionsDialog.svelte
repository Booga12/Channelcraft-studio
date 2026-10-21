<script lang="ts">
  // Chooses which styles, colour sets and motion settings become options in RetroBat's own
  // Theme Configuration menu, so they can be switched there without ChannelCraft.
  import { ed } from '$lib/editor.svelte';
  import { DESIGNS } from '$lib/theme/designs';
  import { SYSTEM_LAYOUTS } from '$lib/theme/systemLayouts';
  import { colorSets, defaultChoices, type MenuChoices } from '$lib/theme/menuOptions';

  const base = ed.menuBase;
  const saved = ed.menuState;
  const start: MenuChoices = saved ?? (base ? defaultChoices(base.design, base.systemLayout) : { systemViews: [], gameDesigns: [], colorSets: [], motion: true });

  let systemViews = $state<string[]>([...start.systemViews]);
  let gameDesigns = $state<string[]>([...start.gameDesigns]);
  let sets = $state<string[]>([...start.colorSets]);
  let motion = $state(start.motion);
  let busy = $state(false);

  const ALL_SETS = colorSets();
  /** Ticking adds to the end (the first is RetroBat's default); unticking removes. One must stay. */
  function toggle(list: string[], id: string): string[] {
    if (list.includes(id)) return list.length > 1 ? list.filter((x) => x !== id) : list;
    return [...list, id];
  }
  function makeDefault(list: string[], id: string): string[] {
    return [id, ...list.filter((x) => x !== id)];
  }

  const combos = $derived(new Set([base?.design.id, ...gameDesigns]).size * new Set([`d-${base?.design.id}`, ...sets]).size);

  async function apply() {
    busy = true;
    try {
      if (await ed.applyMenuOptions({ systemViews, gameDesigns, colorSets: sets, motion })) ed.showMenuOptions = false;
    } finally {
      busy = false;
    }
  }

  const close = () => !busy && (ed.showMenuOptions = false);
  const hex = (c: string) => `#${c.slice(0, 6)}`;
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && close()}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="RetroBat menu options">
    <header>
      <h2>RetroBat menu options</h2>
      <p class="dim">
        RetroBat's <b>Theme configuration</b> menu (Main menu → UI settings) lists a theme's options. Tick what you want to switch between there, without ChannelCraft. The first ticked choice in each list is RetroBat's default; RetroBat also lets you pick the game list style and colour set per console.
      </p>
    </header>

    <div class="body">
      {#if !base}
        <p class="warn">Menu options are made from a ChannelCraft design. Apply a design first (Presets tab), then come back here.</p>
      {:else}
        {#if saved}<p class="faint">Styles you kept keep your edits. New ones are made in the {base.design.label} look.</p>{/if}

        <section>
          <h3>System view style <span class="faint">the console screen</span></h3>
          <div class="grid">
            {#each SYSTEM_LAYOUTS as l (l.id)}
              {@const on = systemViews.includes(l.id)}
              <label class="opt" class:on title={l.description}>
                <input type="checkbox" checked={on} onchange={() => (systemViews = toggle(systemViews, l.id))} />
                <span>{l.label}{l.id === base.systemLayout ? ' (now)' : ''}</span>
                {#if on}
                  {#if systemViews[0] === l.id}<b class="def">default</b>{:else}<button class="ghost small" onclick={(e) => (e.preventDefault(), (systemViews = makeDefault(systemViews, l.id)))}>make default</button>{/if}
                {/if}
              </label>
            {/each}
          </div>
        </section>

        <section>
          <h3>Gamelist view style <span class="faint">the game list screens, one design each</span></h3>
          <div class="grid">
            {#each DESIGNS as d (d.id)}
              {@const on = gameDesigns.includes(d.id)}
              <label class="opt" class:on title={d.description}>
                <input type="checkbox" checked={on} onchange={() => (gameDesigns = toggle(gameDesigns, d.id))} />
                <span class="sw">{#each [d.palette.bg, d.palette.accent, d.palette.text] as c}<i style:background={hex(c)}></i>{/each}</span>
                <span>{d.label}{d.id === base.design.id ? ' (now)' : ''}</span>
                {#if on}
                  {#if gameDesigns[0] === d.id}<b class="def">default</b>{:else}<button class="ghost small" onclick={(e) => (e.preventDefault(), (gameDesigns = makeDefault(gameDesigns, d.id)))}>make default</button>{/if}
                {/if}
              </label>
            {/each}
          </div>
        </section>

        <section>
          <h3>Color set <span class="faint">recolours the designs, their artwork too</span></h3>
          <div class="grid">
            {#each ALL_SETS as c (c.key)}
              {@const on = sets.includes(c.key)}
              <label class="opt" class:on>
                <input type="checkbox" checked={on} onchange={() => (sets = toggle(sets, c.key))} />
                <span class="sw">{#each [c.palette.bg, c.palette.accent, c.palette.text] as col}<i style:background={hex(col)}></i>{/each}</span>
                <span>{c.label}</span>
                {#if on}
                  {#if sets[0] === c.key}<b class="def">default</b>{:else}<button class="ghost small" onclick={(e) => (e.preventDefault(), (sets = makeDefault(sets, c.key)))}>make default</button>{/if}
                {/if}
              </label>
            {/each}
          </div>
          <p class="faint">The theme's own colour sets stay in the list after these.</p>
        </section>

        <section>
          <h3>Motion</h3>
          <label class="opt wide" class:on={motion}>
            <input type="checkbox" bind:checked={motion} />
            <span>Add a <b>Motion</b> option (On / Off). Off stops every animation of the theme in RetroBat.</span>
          </label>
        </section>
      {/if}
    </div>

    <footer>
      {#if base}<span class="faint">Makes the option files in _inc/ccs/options and artwork for {combos} design and colour combination{combos === 1 ? '' : 's'}. A backup comes first, and Ctrl+Z undoes it.</span>{/if}
      <button class="secondary" onclick={close} disabled={busy}>Cancel</button>
      <button class="primary" onclick={apply} disabled={!base || busy}>{busy ? 'Making options…' : saved ? 'Update options' : 'Add to RetroBat menu'}</button>
    </footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: grid;
    place-items: center;
    z-index: 400;
  }
  .dialog {
    display: grid;
    grid-template-rows: auto 1fr auto;
    width: min(900px, 95vw);
    height: min(760px, 92vh);
    background: var(--panel);
    border: 1px solid #3a3a3a;
    border-radius: 12px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  header {
    padding: 18px 20px 6px;
  }
  h2 {
    margin: 0 0 6px;
    font-size: 16px;
  }
  header p {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
  }
  .body {
    overflow: auto;
    padding: 6px 20px 12px;
    display: grid;
    gap: 14px;
    align-content: start;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 13px;
  }
  h3 .faint {
    font-weight: 400;
    font-size: 11px;
    margin-left: 6px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 6px;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid #333;
    border-radius: 7px;
    font-size: 12px;
    cursor: pointer;
    min-height: 30px;
  }
  .opt.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }
  .opt.wide {
    max-width: 640px;
  }
  .opt > span:not(.sw) {
    flex: 1;
  }
  .sw {
    display: flex;
  }
  .sw i {
    width: 10px;
    height: 16px;
  }
  .def {
    font-size: 10px;
    font-weight: 600;
    color: var(--accent);
  }
  section p {
    margin: 6px 0 0;
    font-size: 11px;
  }
  .warn {
    color: var(--warn);
    font-size: 12px;
  }
  footer {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
    padding: 10px 20px 14px;
    font-size: 11px;
  }
  footer .faint {
    flex: 1;
  }
</style>
