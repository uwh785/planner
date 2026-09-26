<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { A, api } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { loadPlan, limitNotice, isAtLimit, limitFor } from '$lib/plan.svelte.js';
  import TaskForm from '$lib/components/TaskForm.svelte';
  import { ArrowLeft, Sparkles } from '@lucide/svelte';

  let loading = $state(false);
  let limitHit = $state('');
  let otherError = $state('');
  const defaultDate = $derived($page.url.searchParams.get('date'));

  $effect(() => {
    if (!A.token) goto('/');
  });

  // Warn before the user hits the ceiling rather than only after the refusal.
  $effect(() => {
    if (A.token) loadPlan();
  });

  // Both read the plan store, so they re-evaluate when loadPlan resolves.
  const atTaskLimit = $derived(isAtLimit('tasks'));
  const taskLimit = $derived(limitFor('tasks'));

  async function handleSubmit(data) {
    loading = true;
    limitHit = '';
    otherError = '';
    try {
      await api('/api/tasks', { method: 'POST', body: data });
      goto('/tasks');
    } catch (e) {
      if (e.status === 402) {
        // The plan is too small, not a broken request: say so, and re-read the
        // usage so the numbers shown reflect the create that was refused.
        limitHit = limitNotice('tasks');
        loadPlan({ force: true });
      } else {
        otherError = e.message;
      }
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

  {#if limitHit}
    <div class="banner banner-limit" role="alert">
      <p class="banner-text">{limitHit}</p>
      <a href="/#pricing" class="btn-upgrade">
        <Sparkles size={16} />
        {t('planUpgradeCta')}
      </a>
    </div>
  {:else if atTaskLimit}
    <div class="banner banner-warn">
      <p class="banner-text">{t('planAtLimitHint').replace('{n}', String(taskLimit))}</p>
      <a href="/#pricing" class="btn-upgrade">
        <Sparkles size={16} />
        {t('planUpgradeCta')}
      </a>
    </div>
  {/if}

  {#if otherError}
    <div class="banner banner-error" role="alert">
      <p class="banner-text">{otherError}</p>
    </div>
  {/if}

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

  .banner {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--surface);
  }

  .banner-limit {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  }

  .banner-warn {
    border-color: color-mix(in srgb, var(--red) 40%, var(--border));
  }

  .banner-error {
    border-color: var(--red);
  }

  .banner-text {
    font-size: 14px;
    color: var(--text);
  }

  .btn-upgrade {
    align-self: flex-start;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
    border-radius: 8px;
    background: var(--accent);
    color: white;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }

  .btn-upgrade:hover {
    opacity: 0.9;
    text-decoration: none;
  }
</style>
