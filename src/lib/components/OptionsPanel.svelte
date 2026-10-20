<script lang="ts">
  import { ed } from '$lib/editor.svelte';

  function choose(name: string, value: string) {
    ed.settings.subsets = { ...ed.settings.subsets, [name]: value };
  }

  function reset() {
    ed.settings.subsets = { ...ed.savedSubsets };
  }
</script>

<div class="wrap">
  <section class="transition">
    <label>
      <span>Screen transition</span>
      <select value={ed.themeTransition} onchange={(e) => ed.setThemeTransition(e.currentTarget.value)}>
        <option value="">RetroBat's default</option>
        <option value="fade">Fade</option>
        <option value="slide">Slide</option>
        <option value="instant">Instant (no animation)</option>
      </select>
    </label>
    <p class="faint note">How RetroBat moves between the console menu and the game lists with this theme. Saved in theme.xml.</p>
    {#if ed.root?.es && ed.root.es.powerSaver === 'instant'}
      <p class="warn note">RetroBat's power saver is set to Instant, so it turns all transitions off.</p>
    {:else if ed.root?.es && ed.root.es.transitionStyle !== 'auto'}
      <p class="warn note">RetroBat's Transition Style is set to “{ed.root.es.transitionStyle}”, which overrides the theme. Set it to <em>Auto</em> in RetroBat (UI Settings) to use the theme's choice.</p>
    {/if}
  </section>

  <p class="dim intro">These are the choices RetroBat offers under <em>UI Settings › Theme configuration</em>. Changing them here only affects the preview.</p>
  {#if !ed.res?.subsets.length}
    <p class="faint">This theme has no options.</p>
  {:else}
    {#each ed.res.subsets as s (s.name)}
      <label>
        <span title={s.name}>{s.displayName}</span>
        <select value={s.selected} onchange={(e) => choose(s.name, e.currentTarget.value)}>
          {#each s.options as o}
            <option value={o.name}>{o.displayName}</option>
          {/each}
        </select>
      </label>
    {/each}
    <button class="small reset" onclick={reset} title="The options saved in RetroBat for this theme">Back to RetroBat's choices</button>
  {/if}
</div>

<style>
  .wrap {
    padding: 10px 12px;
    display: grid;
    gap: 10px;
  }
  .intro {
    margin: 0 0 4px;
    font-size: 12px;
  }
  label {
    display: grid;
    gap: 4px;
  }
  label span {
    font-size: 12px;
    color: var(--text-dim);
  }
  .transition {
    display: grid;
    gap: 4px;
    padding-bottom: 10px;
    border-bottom: 1px solid #333;
  }
  .note {
    margin: 0;
    font-size: 11.5px;
  }
  .warn {
    color: var(--warn);
  }
  .reset {
    justify-self: start;
    margin-top: 6px;
  }
</style>
