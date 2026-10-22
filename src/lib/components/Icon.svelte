<script lang="ts" module>
  // Simple 24×24 stroke icons drawn for this app.
  const PATHS: Record<string, string> = {
    move: 'M5 3l13 7-6 1.5L9.5 18z',
    image: 'M4 5h16v14H4z M4 16l5-5 4 4 2-2 5 5 M15.5 9.5a1.5 1.5 0 1 0 0-.01',
    text: 'M5 6V4h14v2 M12 4v16 M9 20h6',
    panel: 'M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z M5 9h14',
    clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 7v5l3 2',
    star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z',
    video: 'M4 6h12v12H4z M16 10l4-2.5v9L16 14',
    sound: 'M4 9h4l5-4v14l-5-4H4z M16 9a4 4 0 0 1 0 6 M18.5 6.5a8 8 0 0 1 0 11',
    font: 'M3 19l5-14 5 14 M5 14h6 M17.5 12a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5 M20 11v8',
    list: 'M9 6h11 M9 12h11 M9 18h11 M4 6h.01 M4 12h.01 M4 18h.01',
    grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
    carousel: 'M8 6h8v12H8z M3 8h3v8H3 M21 8h-3v8h3',
    group: 'M4 4h6 M14 4h6v6 M20 14v6h-6 M10 20H4v-6 M4 10V4',
    hint: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14 M12 17h.01',
    plus: 'M12 5v14 M5 12h14',
    trash: 'M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
    eyeOff: 'M3 3l18 18 M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8 M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.4-1.1',
    undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
    redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
    save: 'M5 4h11l3 3v13H5z M8 4v5h7V4 M8 20v-6h8v6',
    play: 'M7 4l13 8-13 8z',
    monitor: 'M3 5h18v11H3z M8 20h8 M12 16v4',
    help: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14 M12 17h.01',
    home: 'M4 11l8-7 8 7 M6 9.5V20h12V9.5',
    chevron: 'M6 9l6 6 6-6',
    chevronRight: 'M9 6l6 6-6 6',
    code: 'M8 7l-5 5 5 5 M16 7l5 5-5 5',
    layers: 'M12 3l9 5-9 5-9-5z M3 13l9 5 9-5',
    palette: 'M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2 0-1.5-1.5-1.5-1.5-3S14 14 15.5 14H18a3 3 0 0 0 3-3c0-4.4-4-8-9-8z M7.5 11h.01 M10 7h.01 M14.5 7h.01',
    sliders: 'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M16 4v4 M10 10v4 M18 16v4',
    folder: 'M3 6h6l2 2h10v11H3z',
    file: 'M6 3h8l4 4v14H6z M14 3v4h4',
    zoomIn: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13 M20 20l-4.8-4.8 M10.5 7.5v6 M7.5 10.5h6',
    zoomOut: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13 M20 20l-4.8-4.8 M7.5 10.5h6',
    fit: 'M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5',
    copy: 'M8 8h12v12H8z M4 16V4h12',
    close: 'M6 6l12 12 M18 6L6 18',
    check: 'M5 12.5l4.5 4.5L19 7',
    settings: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6 M19 12l2-1-1-3-2.2.2-1.3-1.3L16.7 4.7l-3-1-1 2h-1.4l-1-2-3 1 .2 2.2L6.2 8.2 4 8l-1 3 2 1v1.4l-2 1 1 3 2.2-.2 1.3 1.3-.2 2.2 3 1 1-2h1.4l1 2 3-1-.2-2.2 1.3-1.3 2.2.2 1-3-2-1z',
    lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    alignLeft: 'M4 3v18 M8 7h10v4H8z M8 13h6v4H8z',
    alignHCenter: 'M12 3v18 M6 7h12v4H6z M8 13h8v4H8z',
    alignRight: 'M20 3v18 M6 7h10v4H6z M10 13h6v4h-6z',
    alignTop: 'M3 4h18 M7 8v10h4V8z M13 8v6h4V8z',
    alignVCenter: 'M3 12h18 M7 6v12h4V6z M13 8v8h4V8z',
    alignBottom: 'M3 20h18 M7 6v10h4V6z M13 10v6h4v-6z',
    distH: 'M4 4v16 M20 4v16 M10 8h4v8h-4z',
    distV: 'M4 4h16 M4 20h16 M8 10h8v4H8z',
    sparkle:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  };

  export type IconName = keyof typeof PATHS;
  export const TYPE_ICONS: Record<string, string> = {
    image: 'image',
    text: 'text',
    textlist: 'list',
    rating: 'star',
    datetime: 'clock',
    clock: 'clock',
    video: 'video',
    ninepatch: 'panel',
    carousel: 'carousel',
    imagegrid: 'grid',
    gridtile: 'grid',
    helpsystem: 'hint',
    container: 'group',
    stackpanel: 'group',
  };
  export { PATHS };
</script>

<script lang="ts">
  let { name, size = 16, title }: { name: string; size?: number; title?: string } = $props();
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={title ? 'img' : undefined}
  aria-hidden={title ? undefined : 'true'}
  aria-label={title}
>
  <path d={PATHS[name] ?? PATHS.file} />
</svg>

<style>
  .icon {
    flex: none;
    display: block;
  }
</style>
