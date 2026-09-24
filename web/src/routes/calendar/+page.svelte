<script>
  import { goto } from '$app/navigation';
  import { A, api } from '$lib/api.svelte.js';
  import { t, locale } from '$lib/i18n.svelte.js';
  import { toDateInputValue } from '$lib/utils.js';
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';

  let currentDate = $state(new Date());
  let tasks = $state([]);
  let loading = $state(true);

  const year = $derived(currentDate.getFullYear());
  const month = $derived(currentDate.getMonth());

  const daysInMonth = $derived(new Date(year, month + 1, 0).getDate());
  const firstDayOfWeek = $derived(new Date(year, month, 1).getDay());

  const monthName = $derived(t('months')[month]);

  $effect(() => {
    if (!A.token) goto('/');
    else loadMonth();
  });

  async function loadMonth() {
    loading = true;
    try {
      const from = new Date(year, month, 1).getTime();
      const to = new Date(year, month + 1, 1).getTime();
      const params = new URLSearchParams({ from: String(from), to: String(to), limit: '100' });
      const res = await api(`/api/tasks?${params.toString()}`);
      tasks = res || [];
    } catch {
      tasks = [];
    } finally {
      loading = false;
    }
  }

  function getTasksForDay(day) {
    const date = new Date(year, month, day);
    const start = date.getTime();
    const end = start + 86400000;
    return tasks.filter(t => t.due_date && t.due_date >= start && t.due_date < end);
  }

  function prevMonth() {
    currentDate = new Date(year, month - 1, 1);
  }

  function nextMonth() {
    currentDate = new Date(year, month + 1, 1);
  }

  function goToDay(day) {
    const d = new Date(year, month, day);
    goto(`/tasks?date=${toDateInputValue(d.getTime())}`);
  }

  const calendarDays = $derived(() => {
    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  });
</script>

<div class="calendar-page">
  <h1>{t('navCalendar')}</h1>

  <div class="calendar-nav">
    <button onclick={prevMonth} aria-label="Previous month"><ChevronLeft size={18} /></button>
    <span class="month-label">{monthName} {year}</span>
    <button onclick={nextMonth} aria-label="Next month"><ChevronRight size={18} /></button>
  </div>

  <div class="calendar-grid">
    {#each t('days') as dayName}
      <div class="day-header">{dayName}</div>
    {/each}

    {#each calendarDays() as day}
      {#if day === null}
        <div class="day-cell empty"></div>
      {:else}
        {@const dayTasks = getTasksForDay(day)}
        <button
          class="day-cell"
          class:has-tasks={dayTasks.length > 0}
          onclick={() => goToDay(day)}
        >
          <span class="day-number">{day}</span>
          {#if dayTasks.length > 0}
            <div class="day-dots">
              {#each dayTasks.slice(0, 3) as _}
                <span class="dot"></span>
              {/each}
              {#if dayTasks.length > 3}
                <span class="more">+{dayTasks.length - 3}</span>
              {/if}
            </div>
          {/if}
        </button>
      {/if}
    {/each}
  </div>
</div>

<style>
  .calendar-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  h1 {
    font-size: 24px;
    font-weight: 700;
  }

  .calendar-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .calendar-nav button {
    min-width: 44px;
    min-height: 44px;
    border-radius: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .month-label {
    font-size: 18px;
    font-weight: 600;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .day-header {
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
    padding: 8px 0;
  }

  .day-cell {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    padding: 4px;
  }

  .day-cell:hover {
    border-color: var(--accent);
  }

  .day-cell.empty {
    background: transparent;
    border: none;
    cursor: default;
  }

  .day-cell.has-tasks {
    border-color: var(--accent);
  }

  .day-number {
    font-size: 12px;
    font-weight: 500;
  }

  .day-dots {
    display: flex;
    gap: 3px;
    align-items: center;
  }

  .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
  }

  .more {
    font-size: 10px;
    color: var(--text2);
  }

  @media (min-width: 500px) {
    .day-cell {
      border-radius: 8px;
    }

    .day-number {
      font-size: 14px;
    }
  }
</style>
