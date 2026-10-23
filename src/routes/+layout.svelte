<script lang="ts">
  import '../app.css';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { prefs } from '$lib/prefs.svelte';
  let { children } = $props();
  // Light or dark before the first paint, so the window doesn't flash the other one.
  prefs.applyLook();
</script>

<Tooltip.Provider delayDuration={350}>
  {@render children()}
</Tooltip.Provider>
