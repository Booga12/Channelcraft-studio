<script lang="ts">
  // Tile styles for the image grid on this screen, each shown as a small row of tiles in the
  // theme's own colours with the middle one selected.
  import { ed } from '$lib/editor.svelte';
  import { TILE_STYLES, tileArt, tileColoursFrom } from '$lib/theme/tiles';
  import { coloursFromVars } from '$lib/theme/presets';
  import CheckIcon from '@lucide/svelte/icons/check';

  const current = $derived(ed.tileStyle);
  const colours = $derived.by(() => {
    const v = (n: string) => ed.res?.vars.get(n)?.value;
    const d = coloursFromVars((n) => v(n));
    if (d) return { c: { tile: d.text, accent: d.accent, text: d.text }, bg: d.bg };
    return { c: tileColoursFrom(v('textColor'), v('accentColor'), v('textColor')), bg: v('bgColor') ?? '15171C' };
  });
  const url = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const thumbs = $derived(TILE_STYLES.map((s) => ({ s, art: tileArt(s, colours.c) })));
</script>

{#if current !== null}
  <div class="ui-new grid grid-cols-2 gap-1.5">
    {#each thumbs as { s, art } (s.id)}
      <button
        class="group flex flex-col gap-1.5 rounded-lg p-1.5 text-left text-xs ring-1 ring-border transition-[box-shadow,background-color] duration-150 hover:bg-muted hover:ring-foreground/20 data-[on=true]:bg-primary/10 data-[on=true]:ring-2 data-[on=true]:ring-primary"
        data-on={current === s.id}
        onclick={() => ed.applyTileStyle(s.id)}
        title={s.help}
      >
        <span class="flex h-12 items-center justify-center gap-1 overflow-hidden rounded-md" style:background="#{colours.bg.slice(0, 6)}">
          <img src={url(art['tile.svg'])} alt="" class="size-9" />
          <img src={url(art['tile-selected.svg'])} alt="" class="size-9 transition-transform duration-200 group-hover:scale-110" style:transform="scale({s.zoom})" />
          <img src={url(art['tile.svg'])} alt="" class="size-9" />
        </span>
        <span class="flex items-center gap-1 font-medium">{s.label}{#if current === s.id}<CheckIcon class="ml-auto size-3.5 text-primary" />{/if}</span>
      </button>
    {/each}
  </div>
  {#if current === ''}<p class="ui-new mt-1.5 text-xs text-muted-foreground">These tiles have their own look. Pick a style to replace it (Ctrl+Z undoes).</p>{/if}
{/if}
