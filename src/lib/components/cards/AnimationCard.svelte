<script lang="ts">
  // Animations as tiles that move when you point at them, with a speed, a start time (so parts
  // come in one after another) and "use on all".
  import { untrack } from 'svelte';
  import SparklesIcon from '@lucide/svelte/icons/sparkles';
  import PlayIcon from '@lucide/svelte/icons/play';
  import { ed } from '$lib/editor.svelte';
  import { ANIMATIONS, entranceDelay, EXITS, exitOf, misplayed, presetOf, screenOf, STILL_TYPES, tuningOf, type AnimPreset } from '$lib/theme/animations';
  import { animDemo, DELAYS, delayName, SPEEDS, speedName } from '$lib/theme/simpleProps';
  import type { ResolvedElement } from '$lib/theme/resolver';
  import Card from './Card.svelte';
  import Seg from './Seg.svelte';

  let { el }: { el: ResolvedElement } = $props();

  const screen = $derived(screenOf(ed.view));
  const id = $derived(presetOf(el, screen));
  const tuning = $derived(tuningOf(el, screen));
  const still = $derived(STILL_TYPES.has(el.type));
  const wontPlay = $derived(misplayed(el, screen) && !!tuning);
  const exitId = $derived(exitOf(el));
  type Group = AnimPreset['kind'];
  const GROUPS: { id: Group; label: string }[] = [
    { id: 'entrance', label: 'Comes in' },
    { id: 'combo', label: 'Then moves' },
    { id: 'loop', label: 'Keeps moving' },
  ];
  let group = $state<Group>('entrance');
  $effect(() => {
    el.name;
    group = untrack(() => tuning?.preset.kind ?? 'entrance');
  });
  const tiles = $derived(ANIMATIONS.filter((a) => a.kind === group));
  const speed = $derived(tuning ? speedName(tuning.speed) : 'normal');
  const delay = $derived(tuning ? delayName(entranceDelay(tuning)) : 'now');
  const kindWord = $derived(['text', 'datetime', 'clock'].includes(el.type) ? 'texts' : el.type === 'image' || el.type === 'video' ? 'pictures' : 'parts like this');

  function pick(a: AnimPreset | null) {
    ed.setAnimation(el.name, a?.id ?? null);
  }
  function setSpeed(s: (typeof SPEEDS)[number]['id']) {
    if (!tuning) return;
    ed.tuneAnimation(el.name, tuning.amount, SPEEDS.find((x) => x.id === s)!.speed);
  }
  function all() {
    const n = ed.animateAllLike(el.name);
    ed.notify(n ? `All ${n} ${kindWord} on this screen now use it, one after another from the top. Ctrl+Z to undo.` : `There are no other ${kindWord} on this screen to give it to.`);
  }
</script>

<Card id="animation" title="Animation" icon={SparklesIcon} summary={id === 'custom' ? 'From the theme' : (tuning?.preset.label ?? '')}>
  {#if !still}
    <Seg label="Kind of animation" options={GROUPS} value={group} onpick={(g) => (group = g)} />
  {/if}
  <div class="tiles motion-ok">
    <button class:on={!id} onclick={() => pick(null)}><span class="demo none"></span>None</button>
    {#each still ? tiles.filter((a) => a.kind === 'entrance') : tiles as a (a.id)}
      <button class:on={id === a.id} title={a.help} onclick={() => pick(a)}><span class="demo {animDemo(a.id)}"></span>{a.label}</button>
    {/each}
  </div>
  {#if id === 'custom'}<p class="note">This part has its own animation from the theme. Picking one here replaces it.</p>{/if}
  {#if wontPlay}
    <div class="alert">
      <div>RetroBat doesn't play this animation on the console screen: it was written for game lists.</div>
      <button class="small" onclick={() => ed.fixAnimation(el.name)}>Make it play here</button>
    </div>
  {/if}
  {#if still}<p class="note">Videos only come in: moving all the time makes them stutter. To move one, animate a frame around it.</p>{/if}

  {#if tuning}
    <div class="row">
      <div class="lbl">Speed</div>
      <Seg label="Speed" options={SPEEDS.map((s) => ({ id: s.id, label: s.label }))} value={speed} onpick={setSpeed} />
    </div>
    {#if tuning.preset.amount}
      <div class="row">
        <div class="lbl">How much it moves <b>{Math.round(tuning.amount * 100)}%</b></div>
        <input type="range" min="0.25" max="3" step="0.05" value={tuning.amount} aria-label="How much it moves" oninput={(e) => ed.tuneAnimation(el.name, e.currentTarget.valueAsNumber, tuning.speed, { coalesce: `tune.${el.name}` })} />
      </div>
    {/if}
    {#if tuning.preset.kind === 'entrance'}
      <div class="row">
        <div class="lbl">When it starts</div>
        <Seg label="When it starts" options={DELAYS.map((d) => ({ id: d.id, label: d.label }))} value={delay} onpick={(d) => ed.setAnimationDelay(el.name, DELAYS.find((x) => x.id === d)!.ms)} />
        <p class="note">Parts coming in one after another look smooth: the title first, then the picture, then the rest.</p>
      </div>
    {/if}
    <div class="btns">
      <button class="small" onclick={() => ed.replayAnimations()} title="Play it again in the preview (R)"><PlayIcon size={12} /> Play it again</button>
      <button class="small" onclick={all} title="Give every one of the {kindWord} on this screen this animation, one after another">Use on all {kindWord}</button>
    </div>
    {#if !ed.playAnimations}
      <p class="warn">Animations are switched off in the preview. <button class="ghost small" onclick={() => ed.replayAnimations()}>Turn them on</button></p>
    {/if}
    <p class="note">{tuning.preset.kind === 'loop' ? 'Keeps gently moving while the screen is open.' : `Plays as the screen opens and every time you move to another ${screen === 'console' ? 'console' : 'game'}.`}</p>
  {/if}

  {#if screen === 'list'}
    <div class="row">
      <div class="lbl">When you move on</div>
      <select value={exitId ?? ''} onchange={(e) => ed.setExit(el.name, e.currentTarget.value || null)}>
        <option value="">RetroBat's own quick fade</option>
        {#if exitId === 'custom'}<option value="custom" disabled>From the theme</option>{/if}
        {#each EXITS as x (x.id)}<option value={x.id} title={x.help}>{x.label}</option>{/each}
      </select>
    </div>
  {/if}
</Card>

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 6px;
  }
  .tiles button {
    border: 1px solid var(--line-strong);
    background: var(--bg);
    border-radius: 8px;
    padding: 8px 3px 6px;
    display: grid;
    gap: 5px;
    justify-items: center;
    font-size: 11px;
    line-height: 1.2;
    min-width: 0;
  }
  .tiles button.on {
    border-color: var(--brand);
    background: var(--brand-soft);
  }
  .demo {
    width: 20px;
    height: 13px;
    border-radius: 3px;
    background: var(--brand);
  }
  .demo.none {
    background: var(--line-strong);
  }
  .tiles button:hover .demo.fade {
    animation: d-fade 1.1s ease-out infinite;
  }
  .tiles button:hover .demo.slide {
    animation: d-slide 1.1s ease-out infinite;
  }
  .tiles button:hover .demo.rise {
    animation: d-rise 1.1s ease-out infinite;
  }
  .tiles button:hover .demo.pop {
    animation: d-pop 1.1s ease-out infinite;
  }
  .tiles button:hover .demo.tilt {
    animation: d-tilt 1.1s ease-out infinite;
  }
  .tiles button:hover .demo.bob {
    animation: d-bob 1.4s ease-in-out infinite;
  }
  .tiles button:hover .demo.sway {
    animation: d-sway 1.4s ease-in-out infinite;
  }
  .tiles button:hover .demo.pulse {
    animation: d-pulse 1.2s ease-in-out infinite;
  }
  .tiles button:hover .demo.spin {
    animation: d-spin 1.6s linear infinite;
  }
  .tiles button:hover .demo.drift {
    animation: d-drift 2s ease-in-out infinite;
  }
  @keyframes d-fade {
    from {
      opacity: 0;
    }
  }
  @keyframes d-slide {
    from {
      opacity: 0;
      translate: -10px 0;
    }
  }
  @keyframes d-rise {
    from {
      opacity: 0;
      translate: 0 8px;
    }
  }
  @keyframes d-pop {
    0% {
      opacity: 0;
      scale: 0.4;
    }
    70% {
      scale: 1.15;
    }
  }
  @keyframes d-tilt {
    from {
      opacity: 0;
      rotate: -20deg;
    }
  }
  @keyframes d-bob {
    50% {
      translate: 0 -4px;
    }
  }
  @keyframes d-sway {
    25% {
      rotate: -10deg;
    }
    75% {
      rotate: 10deg;
    }
  }
  @keyframes d-pulse {
    50% {
      scale: 1.2;
    }
  }
  @keyframes d-spin {
    to {
      rotate: 360deg;
    }
  }
  @keyframes d-drift {
    50% {
      translate: 5px 0;
    }
  }
  .btns {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .btns button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  select {
    width: 100%;
  }
</style>
