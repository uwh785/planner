<script>
  import { goto } from '$app/navigation';
  import { A, setToken } from '$lib/api.svelte.js';
  import { locale, t } from '$lib/i18n.svelte.js';

  $effect(() => {
    if (!A.token) goto('/');
  });

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
