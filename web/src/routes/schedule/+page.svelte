<script>
  import { goto } from '$app/navigation';
  import { A, api } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import ClassCard from '$lib/components/ClassCard.svelte';
  import ClassForm from '$lib/components/ClassForm.svelte';
  import { dowToMondayIndex, mondayIndexToDow } from '$lib/utils.js';
  import { Plus, ArrowLeft } from '@lucide/svelte';

  let classes = $state([]);
  let loading = $state(true);
  let loadError = $state('');
  let selectedDayIndex = $state(dowToMondayIndex(new Date().getDay()));
  let mode = $state('list'); // 'list' | 'form'
  let editingClass = $state(null);
  let formError = $state('');

  $effect(() => {
    if (!A.token) goto('/');
    else loadClasses();
  });

  async function loadClasses() {
    loading = true;
    loadError = '';
    try {
      classes = await api('/api/classes');
    } catch (e) {
      loadError = e.message;
    } finally {
      loading = false;
    }
  }

  function classesForDow(dow) {
    return classes
      .filter(c => c.day_of_week === dow)
      .sort((a, b) => a.start_minute - b.start_minute);
  }

  function openAdd() {
    editingClass = null;
    formError = '';
    mode = 'form';
  }

  function openEdit(cls) {
    editingClass = cls;
    formError = '';
    mode = 'form';
  }

  function closeForm() {
    mode = 'list';
    editingClass = null;
    formError = '';
  }

  async function handleSubmit(data) {
    formError = '';
    try {
      if (editingClass) {
        await api(`/api/classes/${editingClass.class_id}`, { method: 'PUT', body: data });
      } else {
        await api('/api/classes', { method: 'POST', body: data });
      }
      closeForm();
      loadClasses();
    } catch (e) {
      formError = e.message;
    }
  }

  async function handleDelete() {
    if (!editingClass) return;
    if (!confirm(t('scheduleDeleteConfirm'))) return;
    formError = '';
    try {
      await api(`/api/classes/${editingClass.class_id}`, { method: 'DELETE' });
      closeForm();
      loadClasses();
    } catch (e) {
      formError = e.message;
    }
  }

  const dayShort = $derived(t('scheduleDayShort'));
  const dayNames = $derived(t('scheduleDayNames'));
  const weekIndices = [0, 1, 2, 3, 4, 5, 6];
</script>

<div class="schedule-page">
  {#if mode === 'form'}
    <div class="page-header">
      <button class="btn-back" onclick={closeForm} aria-label="Back"><ArrowLeft size={18} /></button>
      <h1>{editingClass ? t('scheduleEditClass') : t('scheduleNewClass')}</h1>
    </div>
    <ClassForm
      cls={editingClass}
      defaultDayOfWeek={mondayIndexToDow(selectedDayIndex)}
      serverError={formError}
      onsubmit={handleSubmit}
      oncancel={closeForm}
      ondelete={editingClass ? handleDelete : undefined}
    />
  {:else}
    <div class="schedule-header">
      <h1>{t('scheduleTitle')}</h1>
      <button class="btn-add" onclick={openAdd} aria-label="Add class"><Plus size={20} /></button>
    </div>

    <div class="day-tabs">
      {#each dayShort as label, i}
        <button
          type="button"
          class="day-tab"
          class:active={selectedDayIndex === i}
          onclick={() => selectedDayIndex = i}
        >
          {label}
        </button>
      {/each}
    </div>

    {#if loading}
      <p class="loading">{t('msgSaving')}</p>
    {:else if loadError}
      <p class="error">{loadError}</p>
    {:else}
      <div class="day-view">
        {#if classesForDow(mondayIndexToDow(selectedDayIndex)).length === 0}
          <div class="empty-state"><p>{t('scheduleEmptyDay')}</p></div>
        {:else}
          <div class="class-list">
            {#each classesForDow(mondayIndexToDow(selectedDayIndex)) as cls (cls.class_id)}
              <ClassCard {cls} onclick={openEdit} />
            {/each}
          </div>
        {/if}
      </div>

      <div class="week-view">
        {#each weekIndices as i}
          {@const dow = mondayIndexToDow(i)}
          <div class="week-column">
            <h2 class="week-day-name">{dayNames[i]}</h2>
            {#if classesForDow(dow).length === 0}
              <p class="week-empty">{t('scheduleEmptyDay')}</p>
            {:else}
              <div class="class-list">
                {#each classesForDow(dow) as cls (cls.class_id)}
                  <ClassCard {cls} onclick={openEdit} />
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .schedule-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .schedule-header {
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
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-add:hover {
    opacity: 0.9;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-back {
    flex-shrink: 0;
  }

  .day-tabs {
    display: flex;
    gap: 4px;
  }

  .day-tab {
    flex: 1;
    min-height: 44px;
    border-radius: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text2);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .day-tab.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .class-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text2);
  }

  .week-view {
    display: none;
  }

  .loading, .error {
    text-align: center;
    padding: 20px;
    color: var(--text2);
  }

  .error {
    color: var(--red);
  }

  /* The week grid needs more room than the 720px content column, so it
     only replaces the day tabs on wide screens and breaks out of the column. */
  @media (min-width: 960px) {
    .day-tabs {
      display: none;
    }

    .day-view {
      display: none;
    }

    .week-view {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 12px;
      width: min(1100px, calc(100vw - 48px));
      position: relative;
      left: 50%;
      transform: translateX(-50%);
    }

    .week-day-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text2);
      margin-bottom: 8px;
      text-align: center;
    }

    .week-empty {
      font-size: 12px;
      color: var(--text2);
      text-align: center;
      padding: 8px 0;
    }
  }
</style>
