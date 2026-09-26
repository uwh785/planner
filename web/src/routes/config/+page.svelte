<script>
  import { goto } from '$app/navigation';
  import { A, setToken } from '$lib/api.svelte.js';
  import { locale, t } from '$lib/i18n.svelte.js';
  import {
    P, loadPlan, isPro, usageLabel, limitFor
  } from '$lib/plan.svelte.js';
  import { Sparkles } from '@lucide/svelte';

  $effect(() => {
    if (!A.token) goto('/');
  });

  $effect(() => {
    if (A.token) loadPlan();
  });

  // The backend reports an uncapped resource as -1.
  function unlimited(resource) {
    return limitFor(resource) === -1;
  }

  function toggleLang() {
    locale.value = locale.value === 'es' ? 'en' : 'es';
  }

  function handleLogout() {
    setToken('');
    goto('/');
  }
</script>

<div class="config-page">
  <h1>{t('configTitle')}</h1>

  {#if P.loaded}
    <div class="config-section">
      <div class="plan-head">
        <h3>{t('planUsageTitle')}</h3>
        <span class="plan-badge" class:plan-badge-pro={isPro()}>
          {isPro() ? t('planBadgePro') : t('planBadgeFree')}
        </span>
      </div>

      <div class="config-item">
        <span class="config-label">{t('planResourceTasks')}</span>
        <span class="config-value" class:config-value-max={unlimited('tasks')}>
          {unlimited('tasks') ? `${usageLabel('tasks')} · ${t('planUnlimited')}` : usageLabel('tasks')}
        </span>
      </div>
      <div class="config-item">
        <span class="config-label">{t('planResourceLists')}</span>
        <span class="config-value" class:config-value-max={unlimited('lists')}>
          {unlimited('lists') ? `${usageLabel('lists')} · ${t('planUnlimited')}` : usageLabel('lists')}
        </span>
      </div>
      <div class="config-item">
        <span class="config-label">{t('planResourceTags')}</span>
        <span class="config-value" class:config-value-max={unlimited('tags')}>
          {unlimited('tags') ? `${usageLabel('tags')} · ${t('planUnlimited')}` : usageLabel('tags')}
        </span>
      </div>

      {#if !isPro()}
        <a href="/#pricing" class="btn-upgrade">
          <Sparkles size={16} />
          {t('planUpgradeCta')}
        </a>
      {/if}
    </div>
  {/if}

  <div class="config-section">
    <h3>{t('configUser')}</h3>
    <div class="config-item">
      <span class="config-label">Email</span>
      <span class="config-value">{A.user?.email || '-'}</span>
    </div>
    <!-- Registration no longer asks for a name and stores the email instead, so only show a real one. -->
    {#if A.user?.name && A.user.name !== A.user.email}
      <div class="config-item">
        <span class="config-label">{t('registerName')}</span>
        <span class="config-value">{A.user.name}</span>
      </div>
    {/if}
  </div>

  <div class="config-section">
    <h3>{t('configLanguage')}</h3>
    <button class="lang-toggle" onclick={toggleLang}>
      {locale.value === 'es' ? 'Español' : 'English'}
    </button>
  </div>

  <button class="btn-logout" onclick={handleLogout}>
    {t('configLogout')}
  </button>
</div>

<style>
  .config-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  h1 {
    font-size: 24px;
    font-weight: 700;
  }

  .config-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
  }

  .config-section h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text2);
    margin-bottom: 12px;
  }

  .plan-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .plan-head h3 {
    margin-bottom: 0;
  }

  .plan-badge {
    padding: 3px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text2);
    background: var(--surface2);
    border: 1px solid var(--border);
  }

  .plan-badge-pro {
    color: white;
    background: var(--accent);
    border-color: var(--accent);
  }

  .config-value-max {
    color: var(--accent);
  }

  .btn-upgrade {
    margin-top: 14px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 16px;
    border-radius: 8px;
    background: var(--accent);
    color: white;
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
  }

  .btn-upgrade:hover {
    opacity: 0.9;
    text-decoration: none;
  }

  .config-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }

  .config-item:last-child {
    border-bottom: none;
  }

  .config-label {
    color: var(--text2);
    font-size: 14px;
  }

  .config-value {
    font-size: 14px;
    font-weight: 500;
  }

  .lang-toggle {
    min-height: 44px;
    display: flex;
    align-items: center;
    padding: 10px 16px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 14px;
    cursor: pointer;
    width: 100%;
    text-align: left;
  }

  .lang-toggle:hover {
    border-color: var(--accent);
  }

  .btn-logout {
    padding: 14px;
    background: var(--red);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-logout:hover {
    opacity: 0.9;
  }
</style>
