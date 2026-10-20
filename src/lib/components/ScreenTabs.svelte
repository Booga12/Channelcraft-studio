<script lang="ts">
  // One document tab per screen of the theme, above the canvas.
  import { ed } from '$lib/editor.svelte';
  import { viewHelp, viewLabel } from '$lib/friendly';
  import type { Ratio } from '$lib/theme/context';
  import Icon from './Icon.svelte';

  const RATIOS: { v: Ratio; label: string }[] = [
    { v: '16/9', label: '16:9 widescreen' },
    { v: '16/10', label: '16:10' },
    { v: '4/3', label: '4:3 old TV' },
  ];

  const ICON: Record<string, string> = {
    system: 'grid',
    basic: 'list',
    detailed: 'list',
    video: 'video',
    grid: 'grid',
    gamecarousel: 'carousel',
    menu: 'settings',
    screen: 'monitor',
    splash: 'sparkle',
  };

  const FILE_LABEL: Record<string, { label: string; help: string }> = {
    'splash.xml': { label: 'Loading screen', help: 'splash.xml: what RetroBat shows while it starts up.' },
    'gamesplash.xml': { label: 'Game launch screen', help: 'gamesplash.xml: what RetroBat shows while a game starts.' },
  };
  const hasSplashFile = $derived(ed.screens.some((t) => t.file === 'splash.xml'));
  function label(t: { view: string; file: string }) {
    if (FILE_LABEL[t.file]) return FILE_LABEL[t.file].label;
    // RetroBat reads its loading screen from splash.xml, not from theme.xml's splash view.
    if (t.view === 'splash') return 'Splash (theme.xml)';
    return viewLabel(t.view, ed.res?.views.get(t.view)?.displayName);
  }
  function help(t: { view: string; file: string }) {
    if (FILE_LABEL[t.file]) return FILE_LABEL[t.file].help;
    if (t.view === 'splash') return `RetroBat 8 reads its loading screen from splash.xml${hasSplashFile ? ' (the Loading screen tab)' : ''}, not from this view in theme.xml.`;
    return viewHelp(t.view) ?? t.view;
  }
</script>

<div class="tabs" role="tablist" aria-label="Screens">
  <div class="strip">
    {#each ed.screens as t (t.id)}
      {@const on = ed.view === t.view && ed.screenFile === t.file}
      <button class="tab" role="tab" aria-selected={on} class:on onclick={() => ed.showScreen(t)} title={help(t)}>
        <Icon name={ICON[t.view] ?? 'file'} size={13} />
        <span>{label(t)}</span>
      </button>
    {/each}
  </div>
  <label class="ratio" title="Shape of the TV or monitor">
    <Icon name="monitor" size={13} />
    <select bind:value={ed.settings.ratio}>
      {#each RATIOS as r}<option value={r.v}>{r.label}</option>{/each}
    </select>
  </label>
</div>

<style>
  .tabs {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    height: 34px;
    background: var(--frame);
    border-bottom: 1px solid var(--line);
    padding: 0 8px 0 0;
    min-width: 0;
  }
  .strip {
    flex: 1;
    display: flex;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .strip::-webkit-scrollbar {
    display: none;
  }
  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 33px;
    padding: 0 14px;
    border-radius: 0;
    background: transparent;
    color: var(--text-faint);
    border-right: 1px solid var(--line);
    flex: none;
  }
  .tab:hover:not(.on) {
    background: #2a2a2a;
    color: var(--text-dim);
  }
  .tab.on {
    background: var(--canvas);
    color: var(--text);
    box-shadow: inset 0 2px 0 var(--accent);
  }
  .ratio {
    display: flex;
    align-items: center;
    gap: 5px;
    align-self: center;
    color: var(--text-faint);
  }
  .ratio select {
    padding: 2px 4px;
  }
</style>
