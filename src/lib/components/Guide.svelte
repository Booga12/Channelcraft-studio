<script lang="ts">
  import { ed } from '$lib/editor.svelte';

  const STEPS = [
    {
      title: 'Pick a screen',
      text: 'The tabs above the preview switch between the System menu (where you pick a console) and the game lists. The console menu at the top right changes which console is shown.',
    },
    {
      title: 'Click something to change it',
      text: 'Click any part of the preview, or pick it in the Layers panel. Its settings appear in the Properties panel on the right, and the quick ones in the bar at the top.',
    },
    {
      title: 'Move, restyle, add',
      text: 'Drag the selected part to move it, or use the arrow keys for small steps. The tools on the left add pictures, text, panels and more.',
    },
    {
      title: 'Save and try it',
      text: 'Press the blue Save button. A backup of the whole theme is made first. Then “Use in RetroBat” and “Launch” to see it for real.',
    },
  ];

  const WORDS = [
    ['Element', 'One thing drawn on screen: a picture, a piece of text, the game list…'],
    ['Layer', 'Decides what is drawn on top. Higher numbers cover lower ones.'],
    ['Options', 'Choices the theme offers inside RetroBat, like colour sets. Changing them here only changes the preview.'],
    ['Colours', 'Colours used in many places at once. Change one and every element using it follows.'],
  ];
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && ed.closeGuide()} />

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && ed.closeGuide()}>
  <div class="guide" role="dialog" aria-modal="true" aria-labelledby="guide-title">
    <h2 id="guide-title">Getting started</h2>
    <p class="dim">
      {#if ed.project}You're editing <strong>{ed.project.name}</strong>.{/if}
      Nothing is written to a theme until you save, and Ctrl+Z undoes any change.
    </p>

    <ol>
      {#each STEPS as s, i}
        <li>
          <span class="n">{i + 1}</span>
          <div>
            <strong>{s.title}</strong>
            <p>{s.text}</p>
          </div>
        </li>
      {/each}
    </ol>

    <h3>Words you'll see</h3>
    <dl>
      {#each WORDS as [w, d]}
        <dt>{w}</dt>
        <dd>{d}</dd>
      {/each}
    </dl>

    <div class="foot">
      <span class="faint">Want every setting, file names and the XML? Switch to <em>Advanced</em> at the top right.</span>
      <button class="primary" onclick={() => ed.closeGuide()}>Got it</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: grid;
    place-items: center;
    z-index: 200;
  }
  .guide {
    width: min(640px, 94vw);
    max-height: 90vh;
    overflow: auto;
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    padding: 22px 26px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
  }
  h2 {
    margin: 0 0 4px;
    font-size: 18px;
  }
  h3 {
    margin: 18px 0 8px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }
  ol {
    list-style: none;
    padding: 0;
    margin: 16px 0 0;
    display: grid;
    gap: 12px;
  }
  li {
    display: flex;
    gap: 12px;
  }
  .n {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 700;
  }
  li p {
    margin: 2px 0 0;
    color: var(--text-dim);
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 14px;
    margin: 0;
  }
  dt {
    font-weight: 600;
  }
  dd {
    margin: 0;
    color: var(--text-dim);
  }
  .foot {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 20px;
  }
  .foot span {
    flex: 1;
    font-size: 12px;
  }
</style>
