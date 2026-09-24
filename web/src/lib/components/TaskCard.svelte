<script>
  import CountdownRing from './CountdownRing.svelte';
  import { t } from '$lib/i18n.svelte.js';
  import {
    formatTime,
    formatShortDate,
    isOverdue,
    isSameLocalDay,
    startOfLocalDay,
    addDays,
    toTimeInputValue,
    getProgressPercent,
    getRemainingMs
  } from '$lib/utils.js';

  let { task, onstart, onpause, oncomplete, onclick } = $props();

  let progress = $state(0);
  let remaining = $state(0);
  let interval;

  $effect(() => {
    if (task.status === 'in_progress' && task.started_at && task.duration_ms) {
      const update = () => {
        progress = getProgressPercent(task);
        remaining = getRemainingMs(task);
      };
      update();
      interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    } else if (task.duration_ms && task.started_at) {
      progress = getProgressPercent(task);
      remaining = getRemainingMs(task);
    } else {
      progress = task.status === 'completed' ? 1 : 0;
      remaining = task.duration_ms || 0;
    }
  });

  const priorityLabel = $derived(() => {
    const labels = { 0: '', 1: t('taskPriorityLow'), 2: t('taskPriorityMedium'), 3: t('taskPriorityHigh') };
    return labels[task.priority] || '';
  });

  const priorityClass = $derived(() => {
    const classes = { 0: 'priority-none', 1: 'priority-low', 2: 'priority-medium', 3: 'priority-high' };
    return classes[task.priority] || 'priority-none';
  });

  const overdue = $derived(isOverdue(task));

  const dueDateLabel = $derived(() => {
    if (!task.due_date) return '';
    const now = Date.now();
    if (isSameLocalDay(task.due_date, now)) return t('dateToday');
    if (isSameLocalDay(task.due_date, addDays(startOfLocalDay(now), 1))) return t('dateTomorrow');
    return formatShortDate(task.due_date, t('months'));
  });

  const dueTimeLabel = $derived(() => (task.due_date && !task.due_all_day ? toTimeInputValue(task.due_date) : ''));

  function handleKeydown(e) {
    // Ignore keydowns bubbling up from the inner action buttons (e.g. Enter
    // activating "Start"/"Pause"/"Complete") so they don't also navigate.
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onclick?.(task);
    }
  }
</script>

<div
  class="task-card"
  class:overdue
  class:completed={task.status === 'completed'}
  class:in-progress={task.status === 'in_progress'}
  onclick={() => onclick?.(task)}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
>
  <div class="task-header">
    <div class="task-title-row">
      <span class="task-dot" class:active={task.status === 'in_progress'}></span>
      <h3 class="task-title">{task.title}</h3>
      {#if task.priority > 0}
        <span class="task-priority {priorityClass()}">{priorityLabel()}</span>
      {/if}
    </div>
    <div class="task-meta">
      {#if task.due_date}
        <span class="task-due" class:overdue>
          {dueDateLabel()}{#if dueTimeLabel()}&nbsp;{dueTimeLabel()}{/if}
        </span>
      {/if}
    </div>
  </div>

  {#if task.description}
    <p class="task-desc">{task.description}</p>
  {/if}

  {#if task.duration_ms}
    <div class="task-timer">
      <CountdownRing {progress} size={40} strokeWidth={3} status={task.status} />
      <div class="timer-info">
        {#if task.status === 'completed'}
          <span class="timer-done">{t('taskComplete')}</span>
        {:else if progress >= 1}
          <span class="timer-over">{t('taskTimeOver')}</span>
        {:else}
          <span class="timer-label">{t('taskTimeLeft')}</span>
          <span class="timer-value">{formatTime(remaining)}</span>
        {/if}
      </div>
    </div>
  {/if}

  <div class="task-actions">
    {#if task.status === 'pending'}
      <button class="btn-action btn-start" onclick={e => { e.stopPropagation(); onstart?.(task); }}>
        {t('taskStart')}
      </button>
    {:else if task.status === 'in_progress'}
      <button class="btn-action btn-pause" onclick={e => { e.stopPropagation(); onpause?.(task); }}>
        {t('taskPause')}
      </button>
    {/if}
    {#if task.status !== 'completed'}
      <button class="btn-action btn-complete" onclick={e => { e.stopPropagation(); oncomplete?.(task); }}>
        {t('taskComplete')}
      </button>
    {/if}
  </div>
</div>

<style>
  .task-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .task-card:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }

  .task-card.overdue {
    border-color: var(--red);
    border-left: 3px solid var(--red);
  }

  .task-card.in-progress {
    border-color: var(--accent);
    border-left: 3px solid var(--accent);
  }

  .task-card.completed {
    opacity: 0.6;
  }

  .task-header {
    margin-bottom: 8px;
  }

  .task-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .task-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text2);
    flex-shrink: 0;
  }

  .task-dot.active {
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
  }

  .task-title {
    font-size: 16px;
    font-weight: 600;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-priority {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--surface2);
    flex-shrink: 0;
  }

  .task-meta {
    display: flex;
    gap: 12px;
    margin-top: 4px;
    font-size: 13px;
    color: var(--text2);
  }

  .task-due.overdue {
    color: var(--red);
    font-weight: 600;
  }

  .task-desc {
    font-size: 14px;
    color: var(--text2);
    margin-bottom: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-timer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--surface2);
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .timer-info {
    display: flex;
    flex-direction: column;
  }

  .timer-label {
    font-size: 12px;
    color: var(--text2);
  }

  .timer-value {
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .timer-done {
    color: var(--green);
    font-weight: 600;
  }

  .timer-over {
    color: var(--red);
    font-weight: 600;
  }

  .task-actions {
    display: flex;
    gap: 8px;
  }

  .btn-action {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-action:hover {
    background: var(--surface2);
  }

  .btn-start {
    border-color: var(--accent);
    color: var(--accent);
  }

  .btn-pause {
    border-color: var(--orange);
    color: var(--orange);
  }

  .btn-complete {
    border-color: var(--green);
    color: var(--green);
  }
</style>
