<script>
  import { t } from '$lib/i18n.svelte.js';
  import { minutesToTime, timeToMinutes, normalizeSubject, filterSubjects } from '$lib/utils.js';
  import { Trash2, ChevronDown } from '@lucide/svelte';
  import { untrack } from 'svelte';

  let {
    cls = null,
    defaultDayOfWeek = 1,
    subjectCatalog = new Map(),
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

  // Editing starts with the class's own teacher and color, so they count as
  // already owned by the user and the inheritance below must not overwrite them.
  let teacherEdited = $state(!!cls);
  let colorEdited = $state(!!cls);
  let inherited = $state(false);

  const dayOptions = $derived(t('scheduleDayNames').map((name, i) => ({ value: (i + 1) % 7, label: name })));
  const subjectMatch = $derived(subjectCatalog.get(normalizeSubject(subject)));

  // The subject stays free text so a new subject can be typed; the dropdown
  // only offers the ones already in use.
  let subjectOpen = $state(false);
  let activeIndex = $state(-1);
  // An exact match lists everything so the dropdown still works as a picker
  // once a subject has been chosen.
  const subjectOptions = $derived(filterSubjects(subjectCatalog, subjectMatch ? '' : subject));
  const showSubjectList = $derived(subjectOpen && subjectOptions.length > 0);

  function openSubjects() {
    subjectOpen = true;
    activeIndex = -1;
  }

  // Read the open state before focusing: focusing fires onfocus, which opens
  // the list, and toggling after that would close it again on the first click.
  function toggleSubjects() {
    const wasOpen = subjectOpen;
    document.getElementById('subject')?.focus();
    if (wasOpen) subjectOpen = false;
    else openSubjects();
  }

  function pickSubject(known) {
    subject = known.subject;
    subjectOpen = false;
    activeIndex = -1;
  }

  function onSubjectKeydown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!subjectOpen) openSubjects();
      const n = subjectOptions.length;
      if (!n) return;
      if (activeIndex < 0) activeIndex = e.key === 'ArrowDown' ? 0 : n - 1;
      else activeIndex = (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
    } else if (e.key === 'Enter' && showSubjectList && activeIndex >= 0) {
      e.preventDefault();
      pickSubject(subjectOptions[activeIndex]);
    } else if (e.key === 'Escape' && subjectOpen) {
      e.preventDefault();
      subjectOpen = false;
    }
  }

  $effect(() => {
    if (!subjectMatch) {
      inherited = false;
      return;
    }
    if (!teacherEdited) teacher = subjectMatch.teacher;
    if (!colorEdited) color = subjectMatch.color;
    inherited = !teacherEdited && !colorEdited;
  });

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
    <div class="combo">
      <input
        id="subject"
        type="text"
        bind:value={subject}
        placeholder={t('scheduleSubject')}
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="subject-options"
        aria-expanded={showSubjectList}
        aria-activedescendant={showSubjectList && activeIndex >= 0 ? `subject-option-${activeIndex}` : undefined}
        onfocus={openSubjects}
        onclick={() => subjectOpen = true}
        oninput={() => { subjectOpen = true; activeIndex = -1; }}
        onkeydown={onSubjectKeydown}
        onblur={() => subjectOpen = false}
        required
      />
      {#if subjectCatalog.size > 0}
        <button
          type="button"
          class="combo-toggle"
          tabindex="-1"
          aria-label={t('scheduleSubjectShowAll')}
          onpointerdown={e => e.preventDefault()}
          onclick={toggleSubjects}
        >
          <ChevronDown size={18} />
        </button>
      {/if}
      {#if showSubjectList}
        <ul id="subject-options" class="combo-list" role="listbox">
          {#each subjectOptions as known, i (known.subject)}
            <li
              id="subject-option-{i}"
              role="option"
              aria-selected={i === activeIndex}
              class:active={i === activeIndex}
              onpointerdown={e => e.preventDefault()}
              onclick={() => pickSubject(known)}
            >
              <span class="combo-dot" style="--swatch-color: {known.color || 'transparent'}"></span>
              <span class="combo-name">{known.subject}</span>
              {#if known.teacher}<span class="combo-teacher">{known.teacher}</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    {#if inherited}
      <p class="form-hint">{t('scheduleSubjectInherited')}</p>
    {/if}
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
      <input
        id="teacher"
        type="text"
        bind:value={teacher}
        oninput={() => teacherEdited = true}
        placeholder={t('scheduleTeacher')}
      />
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
          onclick={() => { color = swatch; colorEdited = true; }}
          aria-label={`Select color ${swatch}`}
        ></button>
      {/each}
      <input
        type="color"
        bind:value={color}
        oninput={() => colorEdited = true}
        class="swatch-custom"
        aria-label="Custom color"
      />
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

  .form-hint {
    font-size: 12px;
    color: var(--text2);
    opacity: 0.8;
  }

  .combo {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .combo input {
    padding-right: 48px;
  }

  .combo-toggle {
    position: absolute;
    top: 0;
    right: 0;
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text2);
    cursor: pointer;
  }

  .combo-list {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 10;
    max-height: 240px;
    overflow-y: auto;
    margin: 0;
    padding: 4px;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.25);
  }

  .combo-list li {
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text);
    font-size: 15px;
  }

  .combo-list li.active {
    background: var(--surface2);
  }

  @media (hover: hover) {
    .combo-list li:hover {
      background: var(--surface2);
    }
  }

  .combo-dot {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--swatch-color);
  }

  .combo-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .combo-teacher {
    font-size: 12px;
    color: var(--text2);
    white-space: nowrap;
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
