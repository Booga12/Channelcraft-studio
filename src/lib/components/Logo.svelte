<script lang="ts">
  // The app's logo (the brush "Cc"), drawn from the same SVG the app icons are made from,
  // in the colour picked in Settings > Appearance.
  import { logoUrl } from '$lib/logo';
  import { prefs } from '$lib/prefs.svelte';

  let { class: cls = '' }: { class?: string } = $props();
</script>

<img src={logoUrl(prefs.v.logoColour)} alt="" aria-hidden="true" draggable="false" class="block select-none {cls}" />
