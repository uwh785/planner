<script>
  import { t } from '$lib/i18n.svelte.js';
  import { minutesToTime, timeToMinutes } from '$lib/utils.js';
  import { Trash2 } from '@lucide/svelte';
  import { untrack } from 'svelte';

  let {
    cls = null,
    defaultDayOfWeek = 1,
    serverError = '',
    onsubmit,
    oncancel,
    ondelete
  } = $props();

  const SWATCHES = ['#0A84FF', '#30D158', '#FFD60A', '#FF453A', '#FF9F0A', '#BF5AF2', '#FF375F', '#64D2FF'];

  let subject = $state(untrack(() => cls?.subject || ''));
  let dayOfWeek = $state(untrack(() => cls?.day_of_week ?? defaultDayOfWeek));
  let startTime = $state(untrack(() => cls ? minutesToTime(cls.start_minute) : '08:00'));
  let endTime = $state(untrack(() => cls ? minutesToTime(cls.end_minute) : '09:00'));
  let room = $state(untrack(() => cls?.room || ''));
  let teacher = $state(untrack(() => cls?.teacher || ''));
  let color = $state(untrack(() => cls?.color || SWATCHES[0]));
  let clientError = $state('');

  const dayOptions = $derived(t('scheduleDayNames').map((name, i) => ({ value: (i + 1) % 7, label: name })));

  function handleSubmit() {
    clientError = '';
    if (!subject.trim()) return;
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (end <= start) {
      clientError = t('scheduleEndAfterStart');
      return;
    }
    onsubmit?.({
      subject: subject.trim(),
      day_of_week: Number(dayOfWeek),
      start_minute: start,
      end_minute: end,
      room: room.trim(),
      teacher: teacher.trim(),
      color
    });
  }
</script>

<form class="class-form" onsubmit={e => { e.preventDefault(); handleSubmit(); }}>
  {#if clientError || serverError}
    <p class="form-error">{clientError || serverError}</p>
  {/if}

  <div class="form-group">
    <label for="subject">{t('scheduleSubject')}</label>
    <input id="subject" type="text" bind:value={subject} placeholder={t('scheduleSubject')} required />
  </div>

  <div class="form-group">
    <label for="day">{t('scheduleDay')}</label>
    <select id="day" bind:value={dayOfWeek}>
      {#each dayOptions as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>

  <div class="form-row">
    <div class="form-group">
      <label for="startTime">{t('scheduleStart')}</label>
      <input id="startTime" type="time" bind:value={startTime} required />
    </div>
    <div class="form-group">
      <label for="endTime">{t('scheduleEnd')}</label>
      <input id="endTime" type="time" bind:value={endTime} required />
    </div>
  </div>

  <div class="form-row">
    <div class="form-group">
      <label for="room">{t('scheduleRoom')}</label>
      <input id="room" type="text" bind:value={room} placeholder={t('scheduleRoom')} />
    </div>
    <div class="form-group">
      <label for="teacher">{t('scheduleTeacher')}</label>
      <input id="teacher" type="text" bind:value={teacher} placeholder={t('scheduleTeacher')} />
    </div>
  </div>

  <div class="form-group">
    <span id="colorLabel" class="color-label">{t('scheduleColor')}</span>
    <div class="swatches" role="group" aria-labelledby="colorLabel">
      {#each SWATCHES as swatch}
        <button
          type="button"
          class="swatch"
          class:active={color === swatch}
          style="--swatch-color: {swatch}"
          onclick={() => color = swatch}
          aria-label={`Select color ${swatch}`}
        ></button>
      {/each}
      <input type="color" bind:value={color} class="swatch-custom" aria-label="Custom color" />
    </div>
  </div>

  <div class="form-actions">
    {#if ondelete}
      <button type="button" class="btn-delete" onclick={ondelete} aria-label="Delete class">
        <Trash2 size={16} />
      </button>
    {/if}
    <div class="form-actions-right">
      <button type="button" class="btn-cancel" onclick={oncancel}>{t('taskCancel')}</button>
      <button type="submit" class="btn-save">{t('taskSave')}</button>
    </div>
  </div>
</form>

<style>
  .class-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-error {
    color: var(--red);
    font-size: 13px;
    padding: 10px 12px;
    background: color-mix(in srgb, var(--red) 12%, transparent);
    border-radius: 8px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label, .color-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text2);
  }

  input, select {
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

  input:focus, select:focus {
    border-color: var(--accent);
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .swatch {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    border-radius: 50%;
    background: var(--swatch-color);
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }

  .swatch.active {
    border-color: var(--text);
  }

  .swatch-custom {
    min-width: 44px;
    min-height: 44px;
    padding: 2px;
    border-radius: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    cursor: pointer;
  }

  .form-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 8px;
  }

  .form-actions-right {
    display: flex;
    gap: 12px;
    margin-left: auto;
  }

  .btn-delete, .btn-cancel, .btn-save {
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

  .btn-delete {
    min-width: 44px;
    padding: 10px;
    background: var(--surface2);
    color: var(--red);
  }

  .btn-delete:hover {
    opacity: 0.85;
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
