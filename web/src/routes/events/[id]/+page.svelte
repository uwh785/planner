<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { A, api } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { eventErrorKey, toDateInputValue } from '$lib/utils.js';
  import EventForm from '$lib/components/EventForm.svelte';
  import { ArrowLeft } from '@lucide/svelte';

  let event = $state(null);
  let loading = $state(true);
  let notFound = $state(false);
  let loadError = $state('');
  let saving = $state(false);
  let serverError = $state('');

  const eventId = $derived($page.params.id);

  $effect(() => {
    if (!A.token) goto('/');
    else loadEvent();
  });

  async function loadEvent() {
    loading = true;
    notFound = false;
    loadError = '';
    try {
      event = await api(`/api/events/${eventId}`);
    } catch (e) {
      event = null;
      if (e.status === 404) notFound = true;
      else loadError = t('msgError');
    } finally {
      loading = false;
    }
  }

  // Returns to the day the event is on, so the user lands where they came from.
  function backToDay(startAt = event?.start_at) {
    goto(startAt ? `/tasks?date=${toDateInputValue(startAt)}` : '/tasks');
  }

  async function handleUpdate(data) {
    saving = true;
    serverError = '';
    try {
      const updated = await api(`/api/events/${eventId}`, { method: 'PUT', body: data });
      backToDay(updated?.start_at ?? data.start_at);
    } catch (e) {
      if (e.status === 404) notFound = true;
      else serverError = t(eventErrorKey(e.status));
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    if (!confirm(t('eventDeleteConfirm'))) return;
    serverError = '';
    try {
      await api(`/api/events/${eventId}`, { method: 'DELETE' });
      backToDay();
    } catch (e) {
      if (e.status === 404) notFound = true;
      else serverError = t('msgError');
    }
  }
</script>

<div class="event-detail">
  {#if loading}
    <p class="loading">{t('msgSaving')}</p>
  {:else if notFound || !event}
    <div class="page-header">
      <button class="btn-back" onclick={() => goto('/tasks')} aria-label="Back"><ArrowLeft size={18} /></button>
    </div>
    <div class="empty-state">
      <p>{notFound ? t('eventNotFound') : loadError}</p>
      <a href="/tasks" class="back-link">{t('eventBackToTasks')}</a>
    </div>
  {:else}
    <div class="page-header">
      <button class="btn-back" onclick={() => backToDay()} aria-label="Back"><ArrowLeft size={18} /></button>
      <h1>{t('eventEdit')}</h1>
    </div>
    <EventForm
      {event}
      {serverError}
      {saving}
      onsubmit={handleUpdate}
      oncancel={() => backToDay()}
      ondelete={handleDelete}
    />
  {/if}
</div>

<style>
  .event-detail {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-back {
    font-size: 18px;
    flex-shrink: 0;
  }

  h1 {
    font-size: 20px;
    font-weight: 600;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
    padding: 40px 20px;
    color: var(--text2);
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-size: 14px;
    font-weight: 600;
    color: var(--accent);
  }

  .loading {
    text-align: center;
    padding: 20px;
    color: var(--text2);
  }
</style>
