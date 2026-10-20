<script lang="ts">
  import { ed } from '$lib/editor.svelte';
</script>

{#if ed.toast}
  {#key ed.toast.id}
    <div class="toast" class:error={ed.toast.kind === 'error'} role="status">
      <span>{ed.toast.text}</span>
      <button class="ghost small" onclick={() => (ed.toast = null)} aria-label="Dismiss">✕</button>
    </div>
  {/key}
{/if}

<style>
  .toast {
    position: fixed;
    left: 50%;
    bottom: 22px;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    align-items: center;
    max-width: min(640px, 90vw);
    padding: 8px 8px 8px 14px;
    background: #2a303a;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
    z-index: 1000;
    animation: rise 0.18s ease-out;
  }
  .toast.error {
    border-color: rgba(255, 107, 107, 0.5);
    background: #3a2427;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
  }
</style>
