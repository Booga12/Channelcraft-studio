<script lang="ts">
  import { COLOR_RE, cssColor } from '$lib/theme/schema';

  let { value, onchange }: { value: string; onchange: (v: string) => void } = $props();

  const valid = $derived(COLOR_RE.test(value.trim()));
  const hex6 = $derived(valid ? value.trim().slice(0, 6) : '000000');
  const alpha = $derived(valid && value.trim().length === 8 ? parseInt(value.trim().slice(6), 16) : 255);
  const upper = $derived(!/[a-f]/.test(value));
  let text = $state('');

  $effect(() => {
    text = value;
  });

  function emit(rgb: string, a: number) {
    // Keep the 6-digit form when the original had no alpha and alpha stays opaque.
    const keepShort = valid && value.trim().length === 6 && a === 255;
    let out = keepShort ? rgb : rgb + a.toString(16).padStart(2, '0');
    out = upper ? out.toUpperCase() : out.toLowerCase();
    onchange(out);
  }
</script>

<div class="color">
  <label class="swatch" style:--c={cssColor(value, 'transparent')} title="Pick a colour">
    <input type="color" value={`#${hex6}`} oninput={(e) => emit(e.currentTarget.value.slice(1), alpha)} />
  </label>
  <input
    class="hex mono"
    class:bad={!valid}
    bind:value={text}
    spellcheck="false"
    onchange={() => onchange(text.trim())}
    onkeydown={(e) => e.key === 'Enter' && onchange(text.trim())}
  />
  <input class="alpha" type="range" min="0" max="255" value={alpha} disabled={!valid} title="Opacity {Math.round((alpha / 255) * 100)}%" oninput={(e) => emit(hex6, Number(e.currentTarget.value))} />
</div>

<style>
  .color {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .swatch {
    position: relative;
    width: 26px;
    height: 24px;
    flex: none;
    border-radius: 5px;
    border: 1px solid var(--line-strong);
    background:
      linear-gradient(var(--c), var(--c)),
      repeating-conic-gradient(var(--checker-a) 0 25%, var(--checker-b) 0 50%) 0 0 / 8px 8px;
    cursor: pointer;
    overflow: hidden;
  }
  .swatch input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .hex {
    width: 92px;
    flex: none;
  }
  .hex.bad {
    border-color: var(--warn);
  }
  .alpha {
    flex: 1;
    min-width: 40px;
    accent-color: var(--brand);
  }
</style>
