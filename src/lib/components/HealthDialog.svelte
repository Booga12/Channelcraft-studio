<script lang="ts">
  // Check theme: what would look broken in RetroBat, each with a fix, Show me and Ignore. Opens
  // by itself before Try it in RetroBat or Export when there is something, with a way to carry on.
  import CheckIcon from '@lucide/svelte/icons/check';
  import ImageOffIcon from '@lucide/svelte/icons/image-off';
  import TypeIcon from '@lucide/svelte/icons/type';
  import MoveIcon from '@lucide/svelte/icons/move';
  import ScissorsIcon from '@lucide/svelte/icons/scissors';
  import ContrastIcon from '@lucide/svelte/icons/contrast';
  import { Button } from '$lib/components/ui/button';
  import { ed } from '$lib/editor.svelte';
  import { elementLabel, viewLabel } from '$lib/friendly';
  import { HEALTH_LABEL, type HealthKind } from '$lib/theme/health';
  import AppDialog from './AppDialog.svelte';

  const ICONS: Record<HealthKind, typeof CheckIcon> = {
    'missing-file': ImageOffIcon,
    'missing-font': TypeIcon,
    'off-screen': MoveIcon,
    'cut-off': ScissorsIcon,
    'hard-to-read': ContrastIcon,
  };

  const issues = $derived(ed.healthIssues);
  const ignored = $derived(ed.healthAll.length - issues.length);
  const fixable = $derived(issues.filter((i) => i.fix).length);
  const then = ed.healthThen;

  function close() {
    ed.showHealth = false;
    ed.healthThen = null;
  }

  function carryOn() {
    close();
    then?.run();
  }

  const screens = (views: string[]) => (views.length > 2 ? `${viewLabel(views[0])} and ${views.length - 1} more screens` : views.map((v) => viewLabel(v)).join(' and '));
</script>

<AppDialog
  title="Check theme"
  description={then ? 'A few things may look wrong in RetroBat. Fix them first, or carry on.' : 'Things that may look wrong in RetroBat: missing pictures and fonts, parts off the screen and hard-to-read text.'}
  onclose={close}
  class="sm:max-w-2xl"
>
  {#snippet footer()}
    {#if fixable > 1}<Button variant="outline" onclick={() => ed.fixAllHealth()}>Fix all {fixable}</Button>{/if}
    {#if then}
      <Button variant={issues.length ? 'outline' : 'default'} onclick={carryOn}>{issues.length ? then.label : 'Continue'}</Button>
    {:else}
      <Button onclick={close}>Done</Button>
    {/if}
  {/snippet}

  {#if !issues.length}
    <div class="good">
      <span class="tick"><CheckIcon /></span>
      <p><b>Looks good.</b> Nothing missing, nothing off the screen.</p>
    </div>
  {:else}
    <ul class="list">
      {#each issues as issue (issue.key)}
        {@const Icon = ICONS[issue.kind]}
        <li>
          <span class="kind"><Icon /></span>
          <div class="what">
            <p class="title">
              {HEALTH_LABEL[issue.kind]}{#if issue.element}<span class="dim"> · {elementLabel(issue.element)}</span>{/if}
            </p>
            <p class="text">{issue.text}</p>
            {#if issue.views.length}<p class="where">On {screens(issue.views)}</p>{/if}
          </div>
          <div class="btns">
            {#if issue.fix}<Button size="sm" onclick={() => ed.fixHealth(issue)}>{issue.fix.label}</Button>{/if}
            {#if issue.element}<Button size="sm" variant="outline" onclick={() => ed.showHealthIssue(issue)}>Show me</Button>{/if}
            <Button size="sm" variant="ghost" onclick={() => ed.ignoreHealth(issue)} title="It's on purpose: don't mention it again for this theme">Ignore</Button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  {#if ignored > 0}
    <p class="ignored">{ignored} ignored · <button class="link" onclick={() => ed.unignoreHealth()}>Show again</button></p>
  {/if}
</AppDialog>

<style>
  .good {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 4px;
  }
  .tick {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: color-mix(in oklab, var(--primary) 18%, transparent);
    color: var(--primary);
    flex: none;
  }
  .tick :global(svg) {
    width: 20px;
    height: 20px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 4px 12px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .kind {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: var(--muted);
    color: var(--muted-foreground);
  }
  .kind :global(svg) {
    width: 16px;
    height: 16px;
  }
  .what p {
    margin: 0;
  }
  .title {
    font-weight: 600;
    font-size: 13px;
  }
  .dim,
  .where {
    color: var(--muted-foreground);
    font-weight: 400;
  }
  .text {
    font-size: 13px;
    margin-top: 2px !important;
  }
  .where {
    font-size: 12px;
    margin-top: 2px !important;
  }
  .btns {
    grid-column: 2;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .ignored {
    margin: 12px 0 0;
    font-size: 12px;
    color: var(--muted-foreground);
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--primary);
    cursor: pointer;
    font: inherit;
  }
</style>
