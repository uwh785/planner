<script>
  import { t } from '$lib/i18n.svelte.js';
  import { Calendar, Clock, X } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import {
    startOfLocalDay,
    addDays,
    toDateInputValue,
    fromDateInputValue,
    toTimeInputValue,
    combineLocalDateTime
  } from '$lib/utils.js';

  let {
    task = null,
    defaultDate = null,
    onsubmit,
    oncancel
  } = $props();

  const todayStr = toDateInputValue(Date.now());
  const tomorrowStr = toDateInputValue(addDays(startOfLocalDay(Date.now()), 1));

  function initialDateMode() {
    if (task?.due_date) {
      const dayStr = toDateInputValue(task.due_date);
      if (dayStr === todayStr) return 'today';
      if (dayStr === tomorrowStr) return 'tomorrow';
      return 'pick';
    }
    if (defaultDate) {
      if (defaultDate === todayStr) return 'today';
      if (defaultDate === tomorrowStr) return 'tomorrow';
      return 'pick';
    }
    return 'none';
  }

  function initialPickedDate() {
    if (task?.due_date) return toDateInputValue(task.due_date);
    if (defaultDate) return defaultDate;
    return todayStr;
  }

  let title = $state(untrack(() => task?.title || ''));
  let description = $state(untrack(() => task?.description || ''));
  let priority = $state(untrack(() => task?.priority || 0));
  let durationHours = $state(untrack(() => task?.duration_ms ? Math.floor(task.duration_ms / 3600000) : 0));
  let durationMinutes = $state(untrack(() => task?.duration_ms ? Math.floor((task.duration_ms % 3600000) / 60000) : 0));

  let dateMode = $state(untrack(() => initialDateMode()));
  let pickedDate = $state(untrack(() => initialPickedDate()));
  let showTime = $state(untrack(() => !!(task?.due_date && !task.due_all_day)));
  let timeValue = $state(untrack(() => task?.due_date && !task.due_all_day ? toTimeInputValue(task.due_date) : ''));

  function selectToday() {
    dateMode = 'today';
  }

  function selectTomorrow() {
    dateMode = 'tomorrow';
  }

  function selectPick() {
    dateMode = 'pick';
    if (!pickedDate) pickedDate = todayStr;
  }

  function selectNone() {
    dateMode = 'none';
    showTime = false;
    timeValue = '';
  }

  function toggleTime() {
    if (showTime) {
      showTime = false;
      timeValue = '';
    } else {
      showTime = true;
      if (!timeValue) timeValue = '09:00';
    }
  }

  function currentDateStr() {
    if (dateMode === 'today') return todayStr;
    if (dateMode === 'tomorrow') return tomorrowStr;
    if (dateMode === 'pick') return pickedDate;
    return null;
  }

  function handleSubmit() {
    const dateStr = currentDateStr();
    let due_date = null;
    let due_all_day = false;
    if (dateStr) {
      if (showTime && timeValue) {
        due_date = combineLocalDateTime(dateStr, timeValue);
        due_all_day = false;
      } else {
        due_date = fromDateInputValue(dateStr);
        due_all_day = true;
      }
    }
    const data = {
      title: title.trim(),
      description: description.trim(),
      priority: Number(priority),
      list_id: task?.list_id ?? null,
      due_date,
      due_all_day,
      duration_ms: (Number(durationHours) * 3600000) + (Number(durationMinutes) * 60000) || null,
    };
    if (!data.title) return;
    onsubmit?.(data);
  }
</script>

<form class="task-form" onsubmit={e => { e.preventDefault(); handleSubmit(); }}>
  <div class="form-group">
    <label for="title">{t('taskTitle')}</label>
    <input
      id="title"
      type="text"
      bind:value={title}
      placeholder={t('taskTitle')}
      required
    />
  </div>

  <div class="form-group">
    <label for="description">{t('taskDescription')}</label>
    <textarea
      id="description"
      bind:value={description}
      placeholder={t('taskDescription')}
      rows="3"
    ></textarea>
  </div>

  <div class="form-group">
    <label for="priority">{t('taskPriority')}</label>
    <select id="priority" bind:value={priority}>
      <option value={0}>{t('taskPriorityNone')}</option>
      <option value={1}>{t('taskPriorityLow')}</option>
      <option value={2}>{t('taskPriorityMedium')}</option>
      <option value={3}>{t('taskPriorityHigh')}</option>
    </select>
  </div>

  <div class="form-group">
    <span id="due-date-label" class="due-date-label">{t('taskDueDate')}</span>
    <div class="date-chips" role="group" aria-labelledby="due-date-label">
      <button type="button" class="chip" class:active={dateMode === 'today'} onclick={selectToday}>
        {t('dateToday')}
      </button>
      <button type="button" class="chip" class:active={dateMode === 'tomorrow'} onclick={selectTomorrow}>
        {t('dateTomorrow')}
      </button>
      <button type="button" class="chip" class:active={dateMode === 'pick'} onclick={selectPick}>
        <Calendar size={14} />
        {t('datePick')}
      </button>
      <button type="button" class="chip chip-clear" class:active={dateMode === 'none'} onclick={selectNone}>
        <X size={14} />
        {t('dateNone')}
      </button>
    </div>

    {#if dateMode === 'pick'}
      <input
        type="date"
        class="date-input"
        bind:value={pickedDate}
        aria-label={t('taskDueDate')}
      />
    {/if}

    {#if dateMode !== 'none'}
      <div class="time-row">
        <button type="button" class="time-toggle" class:active={showTime} onclick={toggleTime}>
          <Clock size={14} />
          {showTime ? t('dateRemoveTime') : t('dateAddTime')}
        </button>
        {#if showTime}
          <input
            type="time"
            class="time-input"
            bind:value={timeValue}
            aria-label={t('dateAddTime')}
          />
        {/if}
      </div>
    {/if}
  </div>

  <div class="form-group">
    <span id="duration-label" class="due-date-label">{t('taskDuration')}</span>
    <div class="duration-row" role="group" aria-labelledby="duration-label">
      <input
        type="number"
        bind:value={durationHours}
        min="0"
        max="999"
        placeholder="0"
      />
      <span>h</span>
      <input
        type="number"
        bind:value={durationMinutes}
        min="0"
        max="59"
        placeholder="0"
      />
      <span>min</span>
    </div>
  </div>

  <div class="form-actions">
    <button type="button" class="btn-cancel" onclick={oncancel}>
      {t('taskCancel')}
    </button>
    <button type="submit" class="btn-save">
      {t('taskSave')}
    </button>
  </div>
</form>

<style>
  .task-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label, .due-date-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text2);
  }

  input, select, textarea {
    min-height: 44px;
    padding: 10px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 15px;
    outline: none;
    transition: border-color 0.15s;
  }

  input:focus, select:focus, textarea:focus {
    border-color: var(--accent);
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }

  .date-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text2);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
    transition: all 0.15s;
  }

  .chip:hover {
    color: var(--text);
    border-color: var(--text2);
  }

  .chip.active {
    color: var(--accent);
    border-color: var(--accent);
    background: rgba(10, 132, 255, 0.1);
  }

  .chip-clear.active {
    color: var(--red);
    border-color: var(--red);
    background: transparent;
  }

  .date-input {
    margin-top: 4px;
  }

  .time-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
  }

  .time-toggle {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text2);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
    transition: all 0.15s;
  }

  .time-toggle:hover {
    color: var(--text);
    border-color: var(--text2);
  }

  .time-toggle.active {
    color: var(--accent);
    border-color: var(--accent);
    background: rgba(10, 132, 255, 0.1);
  }

  .time-input {
    flex: 1;
    max-width: 140px;
  }

  .duration-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .duration-row input {
    width: 70px;
    text-align: center;
  }

  .duration-row span {
    color: var(--text2);
    font-size: 14px;
  }

  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding-top: 8px;
  }

  .btn-cancel, .btn-save {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }

  .btn-cancel {
    background: var(--surface2);
    color: var(--text);
  }

  .btn-cancel:hover {
    background: var(--border);
  }

  .btn-save {
    background: var(--accent);
    color: white;
  }

  .btn-save:hover {
    opacity: 0.9;
  }
</style>
