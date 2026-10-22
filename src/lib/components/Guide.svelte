<script lang="ts">
  import AppDialog from './AppDialog.svelte';
  import { Button } from '$lib/components/ui/button';
  import { ed } from '$lib/editor.svelte';

  const STEPS = [
    {
      title: 'Pick a screen',
      text: 'The screen menu in the top bar switches between the System menu (where you pick a console) and the game lists. Next to it, pick which console the preview shows; the arrows under the preview step through consoles and games.',
    },
    {
      title: 'Click something to change it',
      text: 'Click any part of the preview, or pick it in Layers. Its settings slide in on the right: position and size at the top, everything else below.',
    },
    {
      title: 'Move, restyle, add',
      text: 'Drag the selected part to move it, or use the arrow keys for small steps. The tools on the left add pictures, text, panels and more, and open Layers, Presets, Colours and the other panels.',
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

<AppDialog
  title="Getting started"
  description={`${ed.project ? `You're editing ${ed.project.name}. ` : ''}Nothing is written to a theme until you save, and Ctrl+Z undoes any change.`}
  onclose={() => ed.closeGuide()}
  class="sm:max-w-[640px]"
>
  {#snippet footer()}
    <span class="mr-auto self-center text-xs text-muted-foreground">Want every setting, file names and the XML? Switch to <em>Advanced</em> in the top bar.</span>
    <Button onclick={() => ed.closeGuide()}>Got it</Button>
  {/snippet}

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
</AppDialog>

<style>
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
    background: var(--brand-soft);
    color: var(--brand);
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
</style>
