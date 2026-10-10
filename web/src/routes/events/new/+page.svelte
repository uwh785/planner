<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { A, api } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { eventErrorKey, toDateInputValue } from '$lib/utils.js';
  import EventForm from '$lib/components/EventForm.svelte';
  import { ArrowLeft } from '@lucide/svelte';

  let saving = $state(false);
  let serverError = $state('');
  const defaultDate = $derived($page.url.searchParams.get('date'));

  $effect(() => {
    if (!A.token) goto('/');
  });

  function back() {
    goto(defaultDate ? `/tasks?date=${defaultDate}` : '/tasks');
  }

  async function handleSubmit(data) {
    saving = true;
    serverError = '';
    try {
      const created = await api('/api/events', { method: 'POST', body: data });
      goto(`/tasks?date=${toDateInputValue(created?.start_at ?? data.start_at)}`);
    } catch (e) {
      serverError = t(eventErrorKey(e.status));
    } finally {
      saving = false;
    }
  }
</script>

<div class="new-event-page">
  <div class="page-header">
    <button class="btn-back" onclick={back} aria-label="Back"><ArrowLeft size={18} /></button>
    <h1>{t('eventNew')}</h1>
  </div>

  <EventForm
    {defaultDate}
    {serverError}
    {saving}
    onsubmit={handleSubmit}
    oncancel={back}
  />
</div>

<style>
  .new-event-page {
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
  }

  h1 {
    font-size: 20px;
    font-weight: 600;
  }
</style>
