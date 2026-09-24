<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { A, api } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import TaskForm from '$lib/components/TaskForm.svelte';
  import { ArrowLeft } from '@lucide/svelte';

  let loading = $state(false);
  const defaultDate = $derived($page.url.searchParams.get('date'));

  $effect(() => {
    if (!A.token) goto('/');
  });

  async function handleSubmit(data) {
    loading = true;
    try {
      await api('/api/tasks', { method: 'POST', body: data });
      goto('/tasks');
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }
</script>

<div class="new-task-page">
  <div class="page-header">
    <button class="btn-back" onclick={() => goto('/tasks')} aria-label="Back"><ArrowLeft size={18} /></button>
    <h1>{t('taskNew')}</h1>
  </div>

  <TaskForm
    defaultDate={defaultDate}
    onsubmit={handleSubmit}
    oncancel={() => goto('/tasks')}
  />
</div>

<style>
  .new-task-page {
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
