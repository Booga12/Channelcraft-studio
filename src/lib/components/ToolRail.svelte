<script lang="ts">
  // Vertical tool bar on the left, like Photoshop's: select, then one button per thing you can add.
  import { ed } from '$lib/editor.svelte';
  import { TYPE_LABELS } from '$lib/friendly';
  import Icon from './Icon.svelte';

  const ADD = [
    { type: 'image', icon: 'image' },
    { type: 'text', icon: 'text' },
    { type: 'ninepatch', icon: 'panel' },
    { type: 'clock', icon: 'clock' },
    { type: 'rating', icon: 'star' },
    { type: 'video', icon: 'video' },
  ];
</script>

<aside class="rail" aria-label="Tools">
  <button class="tool" class:on={true} title="Select and move (click an element, then drag it)"><Icon name="move" size={18} /></button>
  <div class="sep"></div>
  {#each ADD as a}
    <button class="tool" onclick={() => ed.addElement(a.type)} title="Add {TYPE_LABELS[a.type]?.label.toLowerCase()}: {TYPE_LABELS[a.type]?.help}">
      <Icon name={a.icon} size={18} />
      <span class="plus"><Icon name="plus" size={9} /></span>
    </button>
  {/each}
  <div class="sep"></div>
  <button class="tool" class:open={ed.leftTab === 'library'} onclick={() => (ed.leftTab = 'library')} title="Add ready-made elements that show RetroBat’s game and system data">
    <Icon name="sparkle" size={18} />
  </button>
  <button class="tool" class:open={ed.leftTab === 'presets'} onclick={() => (ed.leftTab = 'presets')} title="Layout presets and colour palettes">
    <Icon name="grid" size={18} />
  </button>
  <div class="sep"></div>
  <button class="tool" onclick={() => ed.undo()} disabled={!ed.canUndo} title="Undo (Ctrl+Z)"><Icon name="undo" size={18} /></button>
  <button class="tool" onclick={() => ed.redo()} disabled={!ed.canRedo} title="Redo (Ctrl+Y)"><Icon name="redo" size={18} /></button>
  <div class="grow"></div>
  <button class="tool" onclick={() => (ed.showGuide = true)} title="Getting started"><Icon name="help" size={18} /></button>
</aside>

<style>
  .rail {
    grid-area: rail;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 0;
    background: var(--panel);
    border-right: 1px solid var(--line);
  }
  .tool {
    position: relative;
    width: 34px;
    height: 34px;
    padding: 0;
    display: grid;
    place-items: center;
    background: transparent;
    color: var(--text-dim);
  }
  .tool:hover:not(:disabled) {
    background: var(--raised);
    color: var(--text);
  }
  .tool.on {
    background: var(--hover);
    color: #fff;
  }
  .tool.open {
    color: var(--accent);
  }
  .plus {
    position: absolute;
    right: 3px;
    bottom: 3px;
    color: var(--accent);
  }
  .sep {
    width: 22px;
    height: 1px;
    background: #444;
    margin: 6px 0;
  }
  .grow {
    flex: 1;
  }
</style>
