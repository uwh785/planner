<script>
  import { goto } from '$app/navigation';
  import { A, setToken, api } from '$lib/api.svelte.js';
  import { locale, t } from '$lib/i18n.svelte.js';

  let isLogin = $state(true);
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  $effect(() => {
    if (A.token) goto('/dashboard');
  });

  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      const path = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = { email, password };
      const res = await api(path, { method: 'POST', body });
      setToken(res.token);
      A.user = res.user ?? null;
      goto('/dashboard');
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function toggleMode() {
    isLogin = !isLogin;
    error = '';
  }

  function toggleLang() {
    locale.value = locale.value === 'es' ? 'en' : 'es';
  }
</script>

<div class="auth-page">
  <div class="auth-card">
    <div class="auth-header">
      <h1>{t('appName')}</h1>
      <p>{isLogin ? t('loginTitle') : t('registerTitle')}</p>
    </div>

    <form onsubmit={e => { e.preventDefault(); handleSubmit(); }}>
      <div class="form-group">
        <label for="email">{t('loginEmail')}</label>
        <input id="email" type="email" bind:value={email} required />
      </div>

      <div class="form-group">
        <label for="password">{t('loginPassword')}</label>
        <input id="password" type="password" bind:value={password} required />
      </div>

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <button type="submit" class="btn-primary" disabled={loading}>
        {loading ? '...' : (isLogin ? t('loginButton') : t('registerButton'))}
      </button>
    </form>

    <div class="auth-footer">
      <button class="link-btn" onclick={toggleMode}>
        {isLogin ? t('loginNoAccount') + ' ' + t('loginRegister') : t('registerHasAccount') + ' ' + t('registerLogin')}
      </button>
      <button class="link-btn" onclick={toggleLang}>
        {locale.value.toUpperCase()}
      </button>
    </div>
  </div>
</div>

<style>
  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .auth-card {
    width: 100%;
    max-width: 380px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 32px;
  }

  .auth-header {
    text-align: center;
    margin-bottom: 28px;
  }

  .auth-header h1 {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .auth-header p {
    color: var(--text2);
    font-size: 15px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text2);
    margin-bottom: 6px;
  }

  input {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 15px;
    outline: none;
  }

  input:focus {
    border-color: var(--accent);
  }

  .error {
    color: var(--red);
    font-size: 13px;
    margin-bottom: 12px;
    text-align: center;
  }

  .btn-primary {
    width: 100%;
    padding: 12px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 8px;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .auth-footer {
    margin-top: 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 14px;
    cursor: pointer;
  }

  .link-btn:hover {
    text-decoration: underline;
  }
</style>
