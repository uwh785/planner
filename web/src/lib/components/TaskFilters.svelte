<script>
  import { t } from '$lib/i18n.svelte.js';

  let { activeFilter = 'all', onfilter } = $props();

  const filters = $derived([
    { key: 'all', label: t('tasksAll') },
    { key: 'pending', label: t('tasksPending') },
    { key: 'in_progress', label: t('tasksInProgress') },
    { key: 'completed', label: t('tasksCompleted') },
    { key: 'overdue', label: t('dashboardOverdue') },
  ]);
</script>

<div class="filters">
  {#each filters as f}
    <button
      class="filter-btn"
      class:active={activeFilter === f.key}
      onclick={() => onfilter?.(f.key)}
    >
      {f.label}
    </button>
  {/each}
</div>

<style>
  .filters {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .filters::-webkit-scrollbar {
    display: none;
  }

  .filter-btn {
    min-height: 44px;
    display: flex;
    align-items: center;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text2);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .filter-btn:hover {
    color: var(--text);
    border-color: var(--text2);
  }

  .filter-btn.active {
    color: var(--accent);
    border-color: var(--accent);
    background: rgba(10, 132, 255, 0.1);
  }
</style>
