<script>
  import { t } from '$lib/i18n.svelte.js';
  import { Trash2 } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import {
    toDateInputValue,
    toTimeInputValue,
    eventTimesFromInputs,
    isEventEndValid
  } from '$lib/utils.js';

  let {
    event = null,
    defaultDate = null,
    serverError = '',
    saving = false,
    onsubmit,
    oncancel,
    ondelete
  } = $props();

  const SWATCHES = ['#0A84FF', '#30D158', '#FFD60A', '#FF453A', '#FF9F0A', '#BF5AF2', '#FF375F', '#64D2FF'];

  // Limits mirror backend/pkg/model/event.go.
  const TITLE_MAX = 200;
  const LOCATION_MAX = 200;
  const DESCRIPTION_MAX = 5000;

  let title = $state(untrack(() => event?.title || ''));
  let date = $state(untrack(() => event ? toDateInputValue(event.start_at) : (defaultDate || toDateInputValue(Date.now()))));
  let allDay = $state(untrack(() => !!event?.all_day));
  let startTime = $state(untrack(() => event && !event.all_day ? toTimeInputValue(event.start_at) : '09:00'));
  let endTime = $state(untrack(() => event?.end_at && !event.all_day ? toTimeInputValue(event.end_at) : ''));
  let location = $state(untrack(() => event?.location || ''));
  let description = $state(untrack(() => event?.description || ''));
  let color = $state(untrack(() => event?.color || SWATCHES[0]));
  let clientError = $state('');

  function handleSubmit() {
    clientError = '';
    if (!title.trim()) return;
    const times = eventTimesFromInputs(date, allDay, startTime, endTime);
    if (!times) {
      clientError = t('eventStartRequired');
      return;
    }
    if (!isEventEndValid(times)) {
      clientError = t('eventEndAfterStart');
      return;
    }
    onsubmit?.({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      start_at: times.start_at,
      end_at: times.end_at,
      all_day: allDay,
      color
    });
  }
</script>

<form class="event-form" onsubmit={e => { e.preventDefault(); handleSubmit(); }}>
  {#if clientError || serverError}
    <p class="form-error" role="alert">{clientError || serverError}</p>
  {/if}

  <div class="form-group">
    <label for="event-title">{t('eventTitle')}</label>
    <input
      id="event-title"
      type="text"
      bind:value={title}
      placeholder={t('eventTitle')}
      maxlength={TITLE_MAX}
      required
    />
  </div>

  <div class="form-group">
    <label for="event-date">{t('eventDate')}</label>
    <input id="event-date" type="date" bind:value={date} required />
  </div>

  <label class="toggle">
    <input type="checkbox" bind:checked={allDay} />
    <span>{t('eventAllDay')}</span>
  </label>

  {#if !allDay}
    <div class="form-row">
      <div class="form-group">
        <label for="event-start">{t('eventStart')}</label>
        <input id="event-start" type="time" bind:value={startTime} required />
      </div>
      <div class="form-group">
        <label for="event-end">{t('eventEnd')}</label>
        <input id="event-end" type="time" bind:value={endTime} />
      </div>
    </div>
  {/if}

  <div class="form-group">
    <label for="event-location">{t('eventLocation')}</label>
    <input
      id="event-location"
      type="text"
      bind:value={location}
      placeholder={t('eventLocation')}
      maxlength={LOCATION_MAX}
    />
  </div>

  <div class="form-group">
    <label for="event-notes">{t('eventNotes')}</label>
    <textarea
      id="event-notes"
      bind:value={description}
      placeholder={t('eventNotes')}
      maxlength={DESCRIPTION_MAX}
      rows="3"
    ></textarea>
  </div>

  <div class="form-group">
    <span id="event-color-label" class="color-label">{t('eventColor')}</span>
    <div class="swatches" role="group" aria-labelledby="event-color-label">
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
      <input
        type="color"
        bind:value={color}
        class="swatch-custom"
        aria-label="Custom color"
      />
    </div>
  </div>

  <div class="form-actions">
    {#if ondelete}
      <button type="button" class="btn-delete" onclick={ondelete} aria-label={t('eventDelete')}>
        <Trash2 size={16} />
      </button>
    {/if}
    <div class="form-actions-right">
      <button type="button" class="btn-cancel" onclick={oncancel}>{t('taskCancel')}</button>
      <button type="submit" class="btn-save" disabled={saving}>{t('taskSave')}</button>
    </div>
  </div>
</form>

<style>
  .event-form {
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

  input[type="text"], input[type="date"], input[type="time"], textarea {
    min-height: 44px;
    padding: 10px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 15px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }

  textarea {
    resize: vertical;
  }

  input:focus, textarea:focus {
    border-color: var(--accent);
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    font-size: 15px;
    color: var(--text);
    cursor: pointer;
  }

  .toggle input {
    width: 20px;
    height: 20px;
    accent-color: var(--accent);
    cursor: pointer;
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

  .btn-save:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
