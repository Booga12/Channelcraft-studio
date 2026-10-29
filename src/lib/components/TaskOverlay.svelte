<script lang="ts">
  // Covers the window while a long job runs (see task.svelte.ts): its steps, real progress and
  // a changing playful line, so it's clear something is happening and how far along it is.
  import { tick, untrack } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import CheckIcon from '@lucide/svelte/icons/check';
  import CircleDashedIcon from '@lucide/svelte/icons/circle-dashed';
  import MinusIcon from '@lucide/svelte/icons/minus';
  import Gamepad2Icon from '@lucide/svelte/icons/gamepad-2';
  import PartyPopperIcon from '@lucide/svelte/icons/party-popper';
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
  import XIcon from '@lucide/svelte/icons/x';
  import { Progress } from '$lib/components/ui/progress';
  import { Spinner } from '$lib/components/ui/spinner';
  import { Button } from '$lib/components/ui/button';
  import { task } from '$lib/task.svelte';
  import { QuipBag } from '$lib/quips';

  const t = $derived(task.current);
  const running = $derived(task.running);
  const bag = new QuipBag();
  let quip = $state('');
  let elapsed = $state(0);

  // A new line every few seconds, and straight away when the next step starts.
  $effect(() => {
    if (!t || t.error || t.finished) return;
    quip = bag.next(running?.id);
    const timer = setInterval(() => (quip = bag.next()), 2800);
    return () => clearInterval(timer);
  });

  $effect(() => {
    if (!t) return;
    const timer = setInterval(() => (elapsed = Math.floor((Date.now() - t.startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  });

  let root = $state<HTMLElement | null>(null);
  let card = $state<HTMLElement | null>(null);
  let closeBtn = $state<HTMLElement | null>(null);
  const shown = $derived(!!t);

  // While the overlay shows, the rest of the app can't be reached: everything beside it (up to
  // <body>) is made inert, and focus moves into the card. Undone when it closes, and focus goes
  // back to where it was.
  $effect(() => {
    if (!shown || !root) return;
    const el = root;
    return untrack(() => {
      const opener = document.activeElement as HTMLElement | null;
      const made: HTMLElement[] = [];
      const path = new Set<Element>();
      const hide = (sib: Element) => {
        if (path.has(sib) || !(sib instanceof HTMLElement) || sib.inert || sib.matches('script, style')) return;
        sib.inert = true;
        made.push(sib);
      };
      // Parts added during the job (the editor replacing the start screen, a toast) are made inert too.
      const watch = new MutationObserver((records) => {
        for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && hide(n));
      });
      for (let node: HTMLElement = el; node !== document.body; ) {
        const parent = node.parentElement;
        if (!parent) break;
        path.add(node);
        for (const sib of Array.from(parent.children)) if (sib !== node) hide(sib);
        watch.observe(parent, { childList: true });
        node = parent;
      }
      card?.focus({ preventScroll: true });
      return () => {
        watch.disconnect();
        for (const m of made) m.inert = false;
        const lost = !document.activeElement || document.activeElement === document.body || el.contains(document.activeElement);
        if (lost && opener?.isConnected) opener.focus({ preventScroll: true });
      };
    });
  });

  // When a job fails, focus goes to Close.
  $effect(() => {
    if (t?.error) tick().then(() => closeBtn?.focus());
  });

  // Once a job has failed, Escape closes the message like the Close button does.
  // While it shows, no other key reaches the editor (saving, undo, nudging) behind it.
  function onkeydown(e: KeyboardEvent) {
    if (!t) return;
    if (e.key === 'Escape' && t.error) {
      e.preventDefault();
      e.stopPropagation();
      task.close();
      return;
    }
    if (e.key !== 'Tab') e.stopPropagation();
  }
</script>

<svelte:window onkeydowncapture={onkeydown} />

{#if t}
  <div class="ui-new fixed inset-0 z-[60] grid place-items-center bg-background/55 p-4 backdrop-blur-md" transition:fade={{ duration: 180 }} role="dialog" aria-modal="true" aria-labelledby="task-title" bind:this={root}>
    <div bind:this={card} tabindex="-1" class="outline-none w-full max-w-[440px] rounded-2xl bg-card p-6 text-card-foreground shadow-elev-4 ring-1 ring-foreground/10" in:scale={{ start: 0.94, duration: 260, easing: cubicOut }} out:scale={{ start: 0.97, duration: 160 }}>
      <div class="flex items-center gap-3">
        <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-from to-brand-to text-white shadow-elev-2" class:animate-bounce-soft={!t.error && !t.finished}>
          {#if t.error}
            <TriangleAlertIcon class="size-5" />
          {:else if t.finished}
            <PartyPopperIcon class="size-5" />
          {:else}
            <Gamepad2Icon class="size-5" />
          {/if}
        </div>
        <div class="min-w-0">
          <h2 id="task-title" class="m-0 truncate text-base font-semibold">{t.error ? 'Something went wrong' : t.finished ? 'All set!' : t.title}</h2>
          <div class="relative h-5 overflow-hidden text-sm text-muted-foreground" aria-live="polite">
            {#if t.error}
              <span>{t.title} didn't finish.</span>
            {:else if t.finished}
              <span in:fade>Have fun with your new theme.</span>
            {:else}
              {#key quip}
                <span class="absolute inset-0 truncate" in:fly={{ y: 10, duration: 260, easing: cubicOut }} out:fly={{ y: -10, duration: 200 }}>{quip}</span>
              {/key}
            {/if}
          </div>
        </div>
      </div>

      <Progress class="mt-5 h-1.5 {t.error ? '[&>[data-slot=progress-indicator]]:!bg-destructive [&>[data-slot=progress-indicator]]:!bg-none' : ''} [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-brand-from [&>[data-slot=progress-indicator]]:to-brand-to [&>[data-slot=progress-indicator]]:duration-500" value={task.progress * 100} />

      <ol class="mt-4 flex list-none flex-col gap-2 p-0">
        {#each t.steps as s (s.id)}
          <li class="flex items-center gap-2.5 text-sm transition-colors duration-300" class:text-muted-foreground={s.state !== 'running'} class:font-medium={s.state === 'running'}>
            <span class="grid size-5 shrink-0 place-items-center">
              {#if s.state === 'done'}
                <span class="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground" in:scale={{ start: 0.4, duration: 240, easing: cubicOut }}><CheckIcon class="size-3" strokeWidth={3} /></span>
              {:else if s.state === 'running'}
                <Spinner class="size-4 text-primary" />
              {:else if s.state === 'failed'}
                <span class="grid size-5 place-items-center rounded-full bg-destructive text-white" in:scale={{ start: 0.4, duration: 240, easing: cubicOut }}><XIcon class="size-3" strokeWidth={3} /></span>
              {:else if s.state === 'skipped'}
                <MinusIcon class="size-4 opacity-50" />
              {:else}
                <CircleDashedIcon class="size-4 opacity-50" />
              {/if}
            </span>
            <span class:line-through={s.state === 'skipped'} class:opacity-60={s.state === 'skipped'}>{s.label}</span>
          </li>
        {/each}
      </ol>

      {#if t.error}
        <p class="mt-4 mb-0 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{t.error}</p>
        <div class="mt-4 flex justify-end">
          <Button bind:ref={closeBtn} onclick={() => task.close()}>Close</Button>
        </div>
      {:else if elapsed >= 10 && !t.finished}
        <p class="mt-4 mb-0 text-xs text-muted-foreground" in:fade>Still going ({elapsed}s). Copying lots of pictures or a slow connection can take a minute.</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* A gentle hop for the icon while the job runs. */
  .animate-bounce-soft {
    animation: hop 1.4s var(--ease-in-out) infinite;
  }
  @keyframes hop {
    0%,
    100% {
      transform: translateY(0) rotate(0);
    }
    30% {
      transform: translateY(-3px) rotate(-6deg);
    }
    60% {
      transform: translateY(0) rotate(4deg);
    }
  }
</style>
