<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { A, api } from '$lib/api.svelte.js';
  import { tasks, search } from '$lib/stores.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import TaskCard from '$lib/components/TaskCard.svelte';
  import TaskFilters from '$lib/components/TaskFilters.svelte';
  import EventCard from '$lib/components/EventCard.svelte';
  import { Plus, X, ListTodo, CalendarDays } from '@lucide/svelte';
  import { groupTasksByDay, fromDateInputValue, addDays, formatShortDate, startOfLocalDay, sortEvents } from '$lib/utils.js';

  let loading = $state(true);
  let filter = $state('all');
  let debounceTimer;

  const dateParam = $derived($page.url.searchParams.get('date'));

  $effect(() => {
    dateParam;
    if (!A.token) goto('/');
    else {
      loadTasks();
      loadEvents();
    }
  });

  // Events load on their own: a failure only hides the events section and
  // never touches the tasks list. With a date filter they are that day's
  // events; without one, the next 7 days starting today.
  let events = $state([]);
  let eventsRequest = 0;

  async function loadEvents() {
    const request = ++eventsRequest;
    let from = dateParam ? fromDateInputValue(dateParam) : startOfLocalDay(Date.now());
    if (from === null) from = startOfLocalDay(Date.now());
    const to = addDays(from, dateParam ? 1 : 7);
    try {
      const res = await api(`/api/events?from=${from}&to=${to}`);
      if (request === eventsRequest) events = sortEvents(res || []);
    } catch (e) {
      console.error(e);
      if (request === eventsRequest) events = [];
    }
  }

  function goToEvent(event) {
    goto(`/events/${event.event_id}`);
  }

  async function loadTasks() {
    loading = true;
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (search.value) params.set('search', search.value);
      if (dateParam) {
        const from = fromDateInputValue(dateParam);
        if (from !== null) {
          params.set('from', String(from));
          params.set('to', String(addDays(from, 1)));
        }
      }
      const qs = params.toString();
      const res = await api(`/api/tasks${qs ? '?' + qs : ''}`);
      tasks.value = res;
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function handleFilter(f) {
    filter = f;
    loadTasks();
  }

  function handleSearch(e) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      search.value = e.target.value;
      loadTasks();
    }, 300);
  }

  async function handleStart(task) {
    await api(`/api/tasks/${task.task_id}/start`, { method: 'PUT' });
    loadTasks();
  }

  async function handlePause(task) {
    await api(`/api/tasks/${task.task_id}/pause`, { method: 'PUT' });
    loadTasks();
  }

  async function handleComplete(task) {
    await api(`/api/tasks/${task.task_id}/complete`, { method: 'PUT' });
    loadTasks();
  }

  function goToTask(task) {
    goto(`/tasks/${task.task_id}`);
  }

  function clearDateFilter() {
    goto('/tasks');
  }

  // The "+" opens a small menu so the user picks what to create; both targets
  // keep the day being viewed as their default date.
  let newMenuOpen = $state(false);
  let newMenuEl = $state(null);

  function goToNew(kind) {
    newMenuOpen = false;
    const base = kind === 'event' ? '/events/new' : '/tasks/new';
    goto(dateParam ? `${base}?date=${dateParam}` : base);
  }

  function handleWindowClick(e) {
    if (newMenuOpen && newMenuEl && !newMenuEl.contains(e.target)) newMenuOpen = false;
  }

  function handleWindowKeydown(e) {
    if (newMenuOpen && e.key === 'Escape') newMenuOpen = false;
  }

  const grouped = $derived(groupTasksByDay(tasks.value, Date.now()));

  const dateHeaderLabel = $derived(() => {
    if (!dateParam) return '';
    const ms = fromDateInputValue(dateParam);
    return ms !== null ? formatShortDate(ms, t('months')) : dateParam;
  });

  const groupSections = $derived(() => [
    { key: 'overdue', label: t('groupOverdue'), items: grouped.overdue, overdueGroup: true },
    { key: 'today', label: t('groupToday'), items: grouped.today },
    { key: 'tomorrow', label: t('groupTomorrow'), items: grouped.tomorrow },
    { key: 'upcoming', label: t('groupUpcoming'), items: grouped.upcoming },
    { key: 'noDate', label: t('groupNoDate'), items: grouped.noDate },
    { key: 'earlier', label: t('groupEarlier'), items: grouped.earlier }
  ]);
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div class="tasks-page">
  <div class="tasks-header">
    <h1>{t('tasksTitle')}</h1>
    <div class="new-menu" bind:this={newMenuEl}>
      <button
        class="btn-add"
        onclick={() => newMenuOpen = !newMenuOpen}
        aria-label={t('newChooserLabel')}
        aria-haspopup="menu"
        aria-expanded={newMenuOpen}
      ><Plus size={20} /></button>
      {#if newMenuOpen}
        <div class="new-menu-list" role="menu">
          <button class="new-menu-item" role="menuitem" onclick={() => goToNew('task')}>
            <ListTodo size={18} />
            {t('newChooserTask')}
          </button>
          <button class="new-menu-item" role="menuitem" onclick={() => goToNew('event')}>
            <CalendarDays size={18} />
            {t('newChooserEvent')}
          </button>
        </div>
      {/if}
    </div>
  </div>

  {#if dateParam}
    <div class="date-filter-banner">
      <span>{t('tasksDateFilterPrefix')} {dateHeaderLabel()}</span>
      <button class="btn-clear-date" onclick={clearDateFilter} aria-label="Clear date filter"><X size={18} /></button>
    </div>
  {/if}

  <div class="tasks-toolbar">
    <input
      type="search"
      placeholder={t('tasksSearch')}
      oninput={handleSearch}
    />
    <TaskFilters activeFilter={filter} onfilter={handleFilter} />
  </div>

  {#if events.length > 0}
    <section class="task-group event-group">
      <h2 class="group-title">
        {dateParam ? t('eventsDayTitle') : t('eventsUpcomingTitle')}
        <span class="group-count">{events.length}</span>
      </h2>
      <div class="task-list">
        {#each events as event (event.event_id)}
          <EventCard {event} showDate={!dateParam} onclick={goToEvent} />
        {/each}
      </div>
    </section>
  {/if}

  {#if loading}
    <p class="loading">{t('msgSaving')}</p>
  {:else if tasks.value.length === 0}
    <div class="empty-state">
      <p>{t('tasksEmpty')}</p>
      <p class="hint">{t('tasksEmptyHint')}</p>
    </div>
  {:else if dateParam}
    <div class="task-list">
      {#each tasks.value as task}
        <TaskCard
          {task}
          onstart={handleStart}
          onpause={handlePause}
          oncomplete={handleComplete}
          onclick={goToTask}
        />
      {/each}
    </div>
  {:else}
    {#each groupSections() as section (section.key)}
      {#if section.items.length > 0}
        <section class="task-group">
          <h2 class="group-title" class:group-overdue={section.overdueGroup}>
            {section.label}
            <span class="group-count">{section.items.length}</span>
          </h2>
          <div class="task-list">
            {#each section.items as task (task.task_id)}
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
    {/each}
  {/if}
</div>

<style>
  .tasks-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .tasks-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h1 {
    font-size: 24px;
    font-weight: 700;
  }

  .btn-add {
    min-width: 44px;
    min-height: 44px;
    border-radius: 10px;
    background: var(--accent);
    color: white;
    border: none;
    font-size: 20px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-add:hover {
    opacity: 0.9;
  }

  .new-menu {
    position: relative;
  }

  .new-menu-list {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 10;
    min-width: 160px;
    display: flex;
    flex-direction: column;
    padding: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .new-menu-item {
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    font-size: 15px;
    text-align: left;
    cursor: pointer;
  }

  .new-menu-item:hover, .new-menu-item:focus-visible {
    background: var(--surface2);
  }

  .date-filter-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
  }

  .btn-clear-date {
    min-width: 44px;
    min-height: 44px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--text2);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .btn-clear-date:hover {
    color: var(--text);
  }

  .tasks-toolbar {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  input[type="search"] {
    width: 100%;
    padding: 10px 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 15px;
    outline: none;
  }

  input[type="search"]:focus {
    border-color: var(--accent);
  }

  .task-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .group-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text2);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .group-title.group-overdue {
    color: var(--red);
  }

  .group-count {
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
    background: var(--surface2);
    border-radius: 10px;
    padding: 1px 8px;
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
  }

  .empty-state p {
    color: var(--text2);
    font-size: 16px;
  }

  .hint {
    font-size: 14px !important;
    margin-top: 8px;
  }

  .loading {
    text-align: center;
    padding: 20px;
    color: var(--text2);
  }
</style>
