<script lang="ts">
  // Chooses where edits go: every console, only the console in the preview, or (on game-list
  // screens) only the game in the preview, through RetroBat's per-game files.
  import { ed } from '$lib/editor.svelte';
  import { elementLabel, humanize, propLabel } from '$lib/friendly';
  import { isGameListView } from '$lib/theme/resolver';

  let open = $state(false);
  let gamesOpen = $state(false);
  const own = $derived(ed.consoleValues);
  const gameScreen = $derived(!!ed.res && ed.screenFile === 'theme.xml' && isGameListView(ed.res, ed.view));
  const blocker = $derived(ed.gameOnlyBlocker);
  const gameMode = $derived(ed.gameOnly && gameScreen);
  const others = $derived(gameScreen ? ed.gamesWithOwnLook : []);
  const current = $derived(ed.currentGames.length ? ed.gameIndex % ed.currentGames.length : -1);
  const hasOwn = $derived(others.some((g) => g.index === current));

  function pick(mode: 'all' | 'console' | 'game') {
    ed.consoleOnly = mode === 'console';
    ed.gameOnly = mode === 'game';
  }
</script>

<div class="scope" class:on={ed.consoleOnly || gameMode}>
  <div class="seg" role="radiogroup" aria-label="Where changes go">
    <button role="radio" aria-checked={!ed.consoleOnly && !gameMode} class:sel={!ed.consoleOnly && !gameMode} onclick={() => pick('all')}>{gameScreen ? 'All' : 'All consoles'}</button>
    <button role="radio" aria-checked={ed.consoleOnly} class:sel={ed.consoleOnly} onclick={() => pick('console')} title="Only changes the console shown in the preview. Pick another console in the toolbar to give it its own look.">Only {ed.consoleName}</button>
    {#if gameScreen}
      <button
        role="radio"
        aria-checked={gameMode}
        class:sel={gameMode}
        disabled={!!blocker}
        onclick={() => pick('game')}
        title={blocker ?? `Only changes ${ed.gameName}, the game shown in the preview. RetroBat shows it whenever that game is selected.`}
      >Only this game</button>
    {/if}
  </div>
  {#if gameMode && !blocker}
    <p class="hint">Changes now apply only to <strong>{ed.gameName}</strong>. Pick another game at the bottom of the preview to give it its own look. The game parts (cover, video, name, description…) and anything you add can change; things RetroBat draws once for the whole list can't.</p>
    {#if ed.gameSharedFile && !ed.gameFile}
      <p class="hint">It uses a shared look for games without their own (<span class="mono">{ed.gameSharedFile.rel}</span>). Its own file will start from that look, so only your changes differ.</p>
    {/if}
    {#if hasOwn}
      <button class="secondary small reset" onclick={() => ed.resetGame()} title="Remove everything {ed.gameName} has of its own on this screen">Reset {ed.gameName}</button>
    {/if}
  {:else if gameMode && blocker}
    <p class="hint">{blocker}</p>
  {/if}
  {#if others.length}
    <button class="ghost small count" onclick={() => (gamesOpen = !gamesOpen)}>{others.length} game{others.length === 1 ? ' has its' : 's have their'} own look here {gamesOpen ? '▴' : '▾'}</button>
    {#if gamesOpen}
      <ul>
        {#each others as g (g.index)}
          <li class="game">
            <span>{g.name}</span>
            <button class="ghost small" onclick={() => (ed.gameIndex = g.index)} title="Show this game in the preview">Show</button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
  {#if ed.consoleOnly}
    <p class="hint">Colours, pictures and settings you change now apply only to {ed.consoleName}. Every other console keeps the shared ones.</p>
  {/if}
  {#if own.length}
    <button class="ghost small count" onclick={() => (open = !open)}>{ed.consoleName} has {own.length} own value{own.length === 1 ? '' : 's'} {open ? '▴' : '▾'}</button>
    {#if open}
      <ul>
        {#each own as v (`${v.kind}:${v.element ?? ''}:${v.name}`)}
          <li>
            <span>{v.kind === 'var' ? humanize(v.name) : `${elementLabel(v.element ?? '')}: ${propLabel(v.name)}`}</span>
            <span class="mono faint">{v.def.raw}</span>
            <button class="ghost small" title="Use the shared value again" onclick={() => ed.clearConsoleValues([v])}>Reset</button>
          </li>
        {/each}
      </ul>
      <button class="secondary small" onclick={() => ed.clearConsoleValues(own)}>Reset all of {ed.consoleName}</button>
    {/if}
  {/if}
</div>

<style>
  .scope {
    display: grid;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
  }
  .scope.on {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .seg {
    display: flex;
    border: 1px solid #3a3a3a;
    border-radius: 7px;
    overflow: hidden;
  }
  .seg button {
    flex: 1;
    border: 0;
    border-radius: 0;
    background: transparent;
    font-size: 12px;
    padding: 4px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .seg button.sel {
    background: var(--accent);
    color: #fff;
  }
  .hint {
    margin: 0;
    font-size: 11px;
    color: var(--text-dim, #bbb);
  }
  .count {
    justify-self: start;
    font-size: 11px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
    font-size: 11px;
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 6px;
    align-items: center;
  }
  li.game {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .seg button:disabled {
    opacity: 0.45;
  }
  .reset {
    justify-self: start;
  }
  li span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
