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

  function pick(v: string) {
    ed.view = v;
    ed.selected = null;
  }
</script>

<div class="tabs" role="tablist" aria-label="Screens">
  <div class="strip">
    {#each ed.viewNames as v (v)}
      <button class="tab" role="tab" aria-selected={ed.view === v} class:on={ed.view === v} onclick={() => pick(v)} title={viewHelp(v) ?? v}>
        <Icon name={ICON[v] ?? 'file'} size={13} />
        <span>{viewLabel(v, ed.res?.views.get(v)?.displayName)}</span>
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
