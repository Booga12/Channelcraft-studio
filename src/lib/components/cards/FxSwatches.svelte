<script lang="ts">
  // Colours for a glow, shadow or outline: the text's own colour, the theme's colours, black and
  // white, and any colour. Values are RRGGBB.
  import { ed } from '$lib/editor.svelte';
  import { themeSwatches } from '$lib/theme/simpleProps';
  import ColorInput from '../ColorInput.svelte';

  let { value, own, onpick }: { value: string; own?: string; onpick: (rgb: string) => void } = $props();

  const options = $derived.by(() => {
    const list: { hex: string; title: string }[] = [];
    if (own) list.push({ hex: own.slice(0, 6).toUpperCase(), title: 'Same as the text' });
    for (const s of ed.res ? themeSwatches(ed.res, ed.view, 5) : []) list.push({ hex: s.hex.slice(0, 6), title: `Theme colour: ${s.name.replace(/^design/, '')}` });
    list.push({ hex: '000000', title: 'Black' }, { hex: 'FFFFFF', title: 'White' });
    const seen = new Set<string>();
    return list.filter((o) => !seen.has(o.hex) && seen.add(o.hex));
  });
  // One Tab stop (the chosen colour, or the first); the arrow keys move along and choose, as radios do.
  const stop = $derived(Math.max(0, options.findIndex((o) => o.hex === value.toUpperCase())));
  let box: HTMLDivElement;

  function onkeydown(e: KeyboardEvent, i: number) {
    const n = options.length;
    const k = e.key;
    const j = k === 'ArrowRight' || k === 'ArrowDown' ? (i + 1) % n : k === 'ArrowLeft' || k === 'ArrowUp' ? (i - 1 + n) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : -1;
    if (j < 0) return;
    // Kept from the editor's own arrow keys (they move the selected part).
    e.preventDefault();
    e.stopPropagation();
    box.querySelectorAll<HTMLButtonElement>(':scope > button')[j]?.focus();
    if (options[j].hex !== value.toUpperCase()) onpick(options[j].hex);
  }
</script>

<div class="sw" role="radiogroup" aria-label="Colour" bind:this={box}>
  {#each options as o, i (o.hex)}
    <button role="radio" aria-checked={o.hex === value.toUpperCase()} tabindex={i === stop ? 0 : -1} class:on={o.hex === value.toUpperCase()} style:background="#{o.hex}" title={o.title} aria-label={o.title} onclick={() => onpick(o.hex)} onkeydown={(e) => onkeydown(e, i)}></button>
  {/each}
  <div class="any"><ColorInput value={value} label="Colour" onchange={(v) => onpick(v.trim().slice(0, 6).toUpperCase())} /></div>
</div>

<style>
  .sw {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
  }
  button {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid var(--line);
    padding: 0;
  }
  button.on {
    outline: 2px solid var(--brand);
    outline-offset: 1px;
  }
  /* Focus has to differ from the chosen colour's ring. */
  button:focus-visible {
    outline: 2px solid var(--text);
    outline-offset: 1px;
  }
  .any {
    flex: 1;
    min-width: 90px;
  }
</style>
