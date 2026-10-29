<script lang="ts">
  import AppDialog from './AppDialog.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  // Pick, per console, the one game whose video and cover the system screen shows together.
  import { ed } from '$lib/editor.svelte';
  import { coverOf, type Choice } from '$lib/theme/featured';
  import Icon from './Icon.svelte';

  const saved = ed.featured;
  const systems = $derived(ed.systems.filter((s) => ed.gameSystems.includes(s.name)));
  let choices = $state<Record<string, Choice>>({});
  let loading = $state(true);
  let working = $state(false);
  let problems = $state<string[]>([]);

  // Read every console's games so their videos and covers can be offered.
  (async () => {
    for (const s of ed.systems.filter((x) => ed.gameSystems.includes(x.name))) await ed.loadGamesFor(s.name);
    const next: Record<string, Choice> = {};
    for (const s of ed.systems) if (ed.gameSystems.includes(s.name)) next[s.name] = saved.choices[s.name] ?? (saved.pairs[s.name] ? saved.pairs[s.name].game : 'none');
    choices = next;
    loading = false;
  })();

  /** Games that list both a video and some cover art (whether the files exist is checked on Apply). */
  const usable = (sys: string) => (ed.games[sys] ?? []).filter((g) => g.media.video && coverOf(g));

  async function apply() {
    working = true;
    const changed = Object.fromEntries(Object.entries(choices).filter(([sys, c]) => c !== (saved.choices[sys] ?? (saved.pairs[sys] ? saved.pairs[sys].game : 'none'))));
    problems = await ed.applyFeatured(Object.keys(changed).length ? changed : choices);
    working = false;
    if (!problems.length) ed.showFeatured = false;
  }

  function all(c: Choice) {
    choices = Object.fromEntries(Object.keys(choices).map((k) => [k, c]));
  }

  function close() {
    if (!working) ed.showFeatured = false;
  }
</script>

<AppDialog title="Matching game video and cover" onclose={close} busy={working} class="sm:max-w-[680px] max-h-[min(680px,90vh)]" bodyClass="flex flex-col overflow-hidden p-0">
  {#snippet footer()}
    <span class="mr-auto self-center text-xs text-muted-foreground">Then press Save. Ctrl+Z undoes it.</span>
    <Button variant="outline" onclick={close} disabled={working}>Cancel</Button>
    <Button onclick={apply} disabled={loading || working || !systems.length}>{#if working}<Spinner data-icon="inline-start" />Copying videos and covers…{:else}Apply{/if}</Button>
  {/snippet}
    <header>
      <p class="dim">
        On its own, RetroBat picks a random video and a random cover separately, so they often show two different games. Here each console shows <strong>one</strong> of your games: its video and its cover, together. The two files are copied into the theme, so it still works if your games drive is unplugged (the theme gets bigger).
      </p>
      <div class="quick">
        <span class="faint">All consoles:</span>
        <button class="small secondary" onclick={() => all('auto')} disabled={loading}>Automatic</button>
        <button class="small secondary" onclick={() => all('none')} disabled={loading}>Off</button>
      </div>
    </header>
    <div class="list">
      {#if loading}
        <p class="dim">Reading your games…</p>
      {:else if !systems.length}
        <p class="dim">None of your consoles has scraped games yet. Scrape some in RetroBat (with videos), then come back.</p>
      {:else}
        {#each systems as s (s.name)}
          {@const games = usable(s.name)}
          {@const pair = ed.featured.pairs[s.name]}
          <div class="row">
            <div class="info">
              <strong>{s.fullName}</strong>
              <small>
                {#if pair}Showing: {pair.name}{:else}Not set{/if}
                · {games.length} game{games.length === 1 ? '' : 's'} with a video and cover
              </small>
            </div>
            <select bind:value={choices[s.name]} disabled={working} aria-label={s.fullName}>
              <option value="none">Off (RetroBat's random picks)</option>
              <option value="auto" disabled={!games.length}>Automatic (first complete game)</option>
              {#if games.length}
                <optgroup label="Choose a game">
                  {#each games as g (g.path)}<option value={g.path}>{g.name}</option>{/each}
                </optgroup>
              {/if}
              {#if pair && !games.some((g) => g.path === pair.game) && choices[s.name] === pair.game}
                <option value={pair.game}>{pair.name} (saved)</option>
              {/if}
            </select>
          </div>
        {/each}
      {/if}
      {#each problems as p}<p class="err"><Icon name="close" size={12} /> {p}</p>{/each}
    </div>
</AppDialog>

<style>
  header {
    padding: 18px 20px 8px;
  }
  header p {
    margin: 0 0 8px;
    font-size: 12px;
    line-height: 1.45;
  }
  .quick {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 8px 12px;
    display: grid;
    align-content: start;
    gap: 6px;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr minmax(0, 260px);
    gap: 10px;
    align-items: center;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
  }
  .info {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  small {
    color: var(--text-faint);
    font-size: 11px;
  }
  select {
    min-width: 0;
  }
  .err {
    color: var(--danger);
    font-size: 12px;
    margin: 4px 2px;
  }
</style>
