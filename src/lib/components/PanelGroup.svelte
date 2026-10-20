<script lang="ts">
  // A docked panel with tabs and a collapse arrow, like the panels in Adobe apps.
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    tabs,
    active = $bindable(),
    collapsed = $bindable(false),
    children,
    actions,
  }: {
    tabs: { id: string; label: string; icon?: string; title?: string; count?: number }[];
    active: string;
    collapsed?: boolean;
    children: Snippet;
    actions?: Snippet;
  } = $props();
</script>

<section class="group" class:collapsed>
  <header>
    <button class="collapse" onclick={() => (collapsed = !collapsed)} title={collapsed ? 'Expand' : 'Collapse'} aria-expanded={!collapsed}>
      <span class:rot={collapsed}><Icon name="chevron" size={12} /></span>
    </button>
    <div class="tabs" role="tablist">
      {#each tabs as t (t.id)}
        <button
          class="tab"
          role="tab"
          aria-selected={active === t.id}
          class:on={active === t.id}
          title={t.title}
          onclick={() => {
            active = t.id;
            collapsed = false;
          }}
        >
          {t.label}
          {#if t.count}<span class="count">{t.count}</span>{/if}
        </button>
      {/each}
    </div>
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
  </header>
  {#if !collapsed}
    <div class="body">
      {@render children()}
    </div>
  {/if}
</section>

<style>
  .group {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--panel);
  }
  .group.collapsed {
    flex: none !important;
  }
  header {
    display: flex;
    align-items: stretch;
    height: 30px;
    background: var(--frame);
    border-bottom: 1px solid var(--line);
    flex: none;
  }
  .collapse {
    width: 24px;
    padding: 0;
    display: grid;
    place-items: center;
    background: transparent;
    color: var(--text-faint);
    border-radius: 0;
  }
  .collapse .rot {
    display: block;
    transform: rotate(-90deg);
  }
  .tabs {
    flex: 1;
    display: flex;
    min-width: 0;
  }
  .tab {
    background: transparent;
    border-radius: 0;
    padding: 0 12px;
    color: var(--text-faint);
    font-weight: 600;
    font-size: 11.5px;
  }
  .tab:hover:not(.on) {
    color: var(--text-dim);
    background: transparent;
  }
  .tab.on {
    background: var(--panel);
    color: var(--text);
  }
  .count {
    font-weight: 400;
    color: var(--text-faint);
    margin-left: 3px;
    font-size: 10.5px;
  }
  .actions {
    display: flex;
    align-items: center;
    padding-right: 4px;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
</style>
