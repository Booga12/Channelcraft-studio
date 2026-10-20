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
  .reset {
    justify-self: start;
    margin-top: 6px;
  }
</style>
