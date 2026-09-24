<script>
  import { goto } from '$app/navigation';
  import { A, api } from '$lib/api.svelte.js';
  import { dashboard } from '$lib/stores.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import TaskCard from '$lib/components/TaskCard.svelte';
  import CountdownRing from '$lib/components/CountdownRing.svelte';
  import { splitTodayClasses, formatMinuteDuration, formatTimeRange, startOfLocalDay, addDays } from '$lib/utils.js';

  let loading = $state(true);
  let error = $state('');
  let todayClasses = $state([]);
  let todayTasks = $state([]);
  let todayTasksLoading = $state(true);

  function currentMinuteOfDay() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  let nowMinute = $state(currentMinuteOfDay());

  $effect(() => {
    if (!A.token) goto('/');
    else {
      loadDashboard();
      loadTodayTasks();
    }
  });

  $effect(() => {
    if (!A.token) return;
    loadTodayClasses();
    const interval = setInterval(() => {
      nowMinute = currentMinuteOfDay();
      loadTodayClasses();
    }, 30000);
    return () => clearInterval(interval);
  });

  async function loadTodayClasses() {
    try {
      const dow = new Date().getDay();
      todayClasses = await api(`/api/classes?day=${dow}`);
    } catch {}
  }

  const todaySplit = $derived(splitTodayClasses(todayClasses, nowMinute));

  async function loadDashboard() {
    loading = true;
    try {
      const res = await api('/api/dashboard');
      dashboard.value = res;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadTodayTasks() {
    todayTasksLoading = true;
    try {
      const from = startOfLocalDay(Date.now());
      const to = addDays(from, 1);
      const [todayRes, overdueRes] = await Promise.all([
        api(`/api/tasks?from=${from}&to=${to}`),
        api('/api/tasks?status=overdue')
      ]);
      const merged = new Map();
      for (const task of [...(todayRes || []), ...(overdueRes || [])]) {
        if (task.status === 'completed') continue;
        merged.set(task.task_id, task);
      }
      todayTasks = Array.from(merged.values());
    } catch {
      todayTasks = [];
    } finally {
      todayTasksLoading = false;
    }
  }

  async function handleStart(task) {
    await api(`/api/tasks/${task.task_id}/start`, { method: 'PUT' });
    loadDashboard();
    loadTodayTasks();
  }

  async function handlePause(task) {
    await api(`/api/tasks/${task.task_id}/pause`, { method: 'PUT' });
    loadDashboard();
    loadTodayTasks();
  }

  async function handleComplete(task) {
    await api(`/api/tasks/${task.task_id}/complete`, { method: 'PUT' });
    loadDashboard();
    loadTodayTasks();
  }

  function goToTask(task) {
    goto(`/tasks/${task.task_id}`);
  }
</script>

<div class="dashboard">
  <h1>{t('dashboardTitle')}</h1>

  {#if todayClasses.length > 0}
    <section class="today-classes">
      <div class="today-classes-header">
        <h2>{t('scheduleTodayTitle')}</h2>
        <a href="/schedule" class="today-classes-link">{t('scheduleViewLink')}</a>
      </div>

      {#if todaySplit.current}
        {@const c = todaySplit.current}
        <div class="today-class-card current" style="--card-color: {c.color || 'var(--accent)'}">
          <CountdownRing
            progress={Math.min(Math.max((nowMinute - c.start_minute) / (c.end_minute - c.start_minute), 0), 1)}
            size={44}
            strokeWidth={4}
            status="in_progress"
          />
          <div class="today-class-info">
            <span class="today-class-subject">{c.subject}</span>
            <span class="today-class-sub">{t('scheduleEndsIn')} {formatMinuteDuration(c.end_minute - nowMinute)}</span>
          </div>
        </div>
      {/if}

      {#if todaySplit.next}
        {@const n = todaySplit.next}
        <div class="today-class-card next" style="--card-color: {n.color || 'var(--accent)'}">
          <div class="today-class-info">
            <span class="today-class-subject">{n.subject}</span>
            <span class="today-class-sub">{t('scheduleStartsIn')} {formatMinuteDuration(n.start_minute - nowMinute)}</span>
          </div>
        </div>
      {/if}

      {#if todaySplit.upcoming.length > 0}
        <div class="today-class-rest">
          {#each todaySplit.upcoming as u (u.class_id)}
            <div class="today-class-mini" style="--card-color: {u.color || 'var(--accent)'}">
              <span class="mini-subject">{u.subject}</span>
              <span class="mini-time">{formatTimeRange(u.start_minute, u.end_minute)}</span>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <section class="today-tasks">
    <h2>{t('dashboardTodayTasks')}</h2>
    {#if todayTasksLoading}
      <p class="loading">{t('msgSaving')}</p>
    {:else if todayTasks.length === 0}
      <div class="empty-state">
        <p>{t('dashboardNothingToday')}</p>
        <a href="/tasks/new" class="today-tasks-link">{t('taskNew')}</a>
      </div>
    {:else}
      <div class="task-list">
        {#each todayTasks as task (task.task_id)}
          <TaskCard
            {task}
            onstart={handleStart}
            onpause={handlePause}
            oncomplete={handleComplete}
            onclick={goToTask}
          />
        {/each}
      </div>
    {/if}
  </section>

  {#if loading}
    <p class="loading">{t('msgSaving')}</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if dashboard.value}
    {@const d = dashboard.value}

    <div class="stats">
      <div class="stat-card">
        <span class="stat-value">{d.summary.pending}</span>
        <span class="stat-label">{t('dashboardPending')}</span>
      </div>
      <div class="stat-card stat-progress">
        <span class="stat-value">{d.summary.in_progress}</span>
        <span class="stat-label">{t('dashboardInProgress')}</span>
      </div>
      <div class="stat-card stat-done">
        <span class="stat-value">{d.summary.completed}</span>
        <span class="stat-label">{t('dashboardCompleted')}</span>
      </div>
      <div class="stat-card stat-overdue">
        <span class="stat-value">{d.summary.overdue}</span>
        <span class="stat-label">{t('dashboardOverdue')}</span>
      </div>
    </div>

    {#if d.active.length > 0}
      <section class="section">
        <h2>{t('dashboardActive')}</h2>
        <div class="task-list">
          {#each d.active as task}
            <TaskCard
              {task}
              onstart={handleStart}
              onpause={handlePause}
              oncomplete={handleComplete}
              onclick={goToTask}
            />
          {/each}
        </div>
      </section>
    {:else}
      <div class="empty-state">
        <p>{t('dashboardNoActive')}</p>
      </div>
    {/if}

    {#if d.overdue.length > 0}
      <section class="section">
        <h2 class="overdue-title">{t('dashboardOverdue')}</h2>
        <div class="task-list">
          {#each d.overdue as task}
            <TaskCard
              {task}
              onstart={handleStart}
              onpause={handlePause}
              oncomplete={handleComplete}
              onclick={goToTask}
            />
          {/each}
        </div>
      </section>
    {/if}

    {#if d.upcoming.length > 0}
      <section class="section">
        <h2>{t('dashboardUpcoming')}</h2>
        <div class="task-list">
          {#each d.upcoming as task}
            <TaskCard
              {task}
              onstart={handleStart}
              onpause={handlePause}
              oncomplete={handleComplete}
              onclick={goToTask}
            />
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  h1 {
    font-size: 24px;
    font-weight: 700;
  }

  h2 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .overdue-title {
    color: var(--red);
  }

  .today-classes {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
  }

  .today-classes-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .today-classes-header h2 {
    margin-bottom: 0;
  }

  .today-classes-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 4px 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
  }

  .today-class-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border-radius: 10px;
    background: var(--surface2);
    border-left: 4px solid var(--card-color);
  }

  .today-class-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .today-class-subject {
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .today-class-sub {
    font-size: 13px;
    color: var(--text2);
  }

  .today-class-rest {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .today-class-mini {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--surface2);
    border-left: 3px solid var(--card-color);
    font-size: 13px;
  }

  .mini-subject {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mini-time {
    color: var(--text2);
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: 12px;
    color: var(--text2);
  }

  .stat-progress .stat-value { color: var(--accent); }
  .stat-done .stat-value { color: var(--green); }
  .stat-overdue .stat-value { color: var(--red); }

  .section {
    margin-top: 8px;
  }

  .today-tasks-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 4px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--accent);
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text2);
  }

  .loading, .error {
    text-align: center;
    padding: 20px;
  }

  .error {
    color: var(--red);
  }

  @media (min-width: 500px) {
    .stats {
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
