<script lang="ts">
  // Draws an asset drag (highlight on the element under the pointer, a label by the pointer) and
  // handles files dragged in from Explorer: onto an element links it, anywhere else adds it to Assets.
  import { onMount } from 'svelte';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { ed } from '$lib/editor.svelte';
  import { assetDrag, describe, kindOfFile } from '$lib/assetDrag.svelte';
  import { fileUrl } from '$lib/api';
  import { basename } from '$lib/path';
  import { prefs } from '$lib/prefs.svelte';

  let dropped: string[] = [];

  onMount(() => {
    let unlisten: (() => void) | undefined;
    let gone = false;
    const toCss = (p: { x: number; y: number }) => [p.x / window.devicePixelRatio, p.y / window.devicePixelRatio] as const;
    try {
      getCurrentWebview()
        .onDragDropEvent(async (e) => {
          const d = e.payload;
          if (d.type === 'enter') {
            dropped = d.paths;
            const first = d.paths.find((p) => kindOfFile(p));
            if (!first) return;
            assetDrag.start({ path: first, kind: kindOfFile(first)!, name: basename(first) }, true);
            assetDrag.move(...toCss(d.position));
          } else if (d.type === 'over') {
            assetDrag.move(...toCss(d.position));
          } else if (d.type === 'drop') {
            const paths = d.paths.length ? d.paths : dropped;
            if (assetDrag.item) assetDrag.move(...toCss(d.position));
            const onElement = assetDrag.target;
            if (onElement) {
              await assetDrag.drop();
              return;
            }
            assetDrag.cancel();
            if (!paths.length) return;
            ed.showPanel('assets');
            await ed.addToLibrary(paths);
          } else {
            assetDrag.cancel();
          }
        })
        .then((u) => (gone ? u() : (unlisten = u)))
        .catch(() => {
          // Not inside Tauri (browser dev mode): no Explorer drops.
        });
    } catch {
      // Not inside Tauri.
    }
    return () => {
      gone = true;
      unlisten?.();
    };
  });

  const t = $derived(assetDrag.target);
  const label = $derived(assetDrag.item ? (assetDrag.external && !t ? 'Drop to add to your Assets' : describe(t, assetDrag.item)) : '');
</script>

{#if assetDrag.item}
  <div class="layer" aria-hidden="true">
    {#if t}
      <div class="hl" class:bad={!t.fit.ok} style:left="{t.rect.x}px" style:top="{t.rect.y}px" style:width="{t.rect.w}px" style:height="{t.rect.h}px"></div>
    {/if}
    <!-- Near the right edge the label goes left of the pointer, so it isn't squeezed. -->
    <div
      class="chip"
      class:bad={t && !t.fit.ok}
      style:left="{assetDrag.x + 14}px"
      style:top="{assetDrag.y + 16}px"
      style:transform={assetDrag.x > window.innerWidth / (prefs.v.uiScale || 1) - 340 ? 'translateX(calc(-100% - 28px))' : undefined}
    >
      {#if assetDrag.item.kind === 'image' && !assetDrag.external}
        <img src={fileUrl(assetDrag.item.path)} alt="" />
      {/if}
      <span class="txt">
        <strong>{assetDrag.item.name}</strong>
        <small>{label}</small>
      </span>
    </div>
  </div>
{/if}

<style>
  .layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1000;
  }
  .hl {
    position: fixed;
    border: 2px solid var(--ok, #3fb950);
    background: rgba(63, 185, 80, 0.12);
    border-radius: 3px;
    box-sizing: border-box;
  }
  .hl.bad {
    border-color: var(--warn, #e3a008);
    background: rgba(227, 160, 8, 0.1);
    border-style: dashed;
  }
  .chip {
    position: fixed;
    display: flex;
    gap: 8px;
    align-items: center;
    width: max-content;
    max-width: 320px;
    padding: 6px 9px;
    border-radius: 6px;
    background: var(--raised, #2b2f36);
    border: 1px solid var(--ok, #3fb950);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    font-size: 11.5px;
  }
  .chip.bad {
    border-color: var(--warn, #e3a008);
  }
  .chip img {
    width: 40px;
    height: 30px;
    object-fit: contain;
    flex: none;
    border-radius: 3px;
    background: #20242b;
  }
  .txt {
    display: grid;
    min-width: 0;
  }
  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    color: var(--text-dim);
    font-size: 11px;
  }
  .chip.bad small {
    color: var(--warn, #e3a008);
  }
</style>
