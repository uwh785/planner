<script>
  import '../app.css';
  import { A, loadToken, loadUser, setToken } from '$lib/api.svelte.js';
  import { locale, t } from '$lib/i18n.svelte.js';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ModeWatcher } from 'mode-watcher';
  import { LayoutDashboard, ListTodo, CalendarClock, CalendarDays, Settings } from '@lucide/svelte';

  let { children } = $props();

  loadToken();

  $effect(() => {
    if (A.token && !A.user) loadUser();
  });

  let navItems = $derived([
    { href: '/dashboard', label: t('navDashboard'), icon: LayoutDashboard },
    { href: '/tasks', label: t('navTasks'), icon: ListTodo },
    { href: '/schedule', label: t('navSchedule'), icon: CalendarClock },
    { href: '/calendar', label: t('navCalendar'), icon: CalendarDays },
    { href: '/config', label: t('navConfig'), icon: Settings }
  ]);

  let currentPath = $derived($page.url.pathname);
  const bareRoutes = ['/', '/login'];
  let showNav = $derived(A.token && !bareRoutes.includes(currentPath));
  let fullBleed = $derived(currentPath === '/');

  function handleLogout() {
    setToken('');
    goto('/');
  }

  function toggleLang() {
    locale.value = locale.value === 'es' ? 'en' : 'es';
  }
</script>

<ModeWatcher themeColors={{ dark: '#000000', light: '#f2f2f7' }} />

{#if showNav}
  <nav class="topnav">
    <div class="topnav-inner">
      <a href="/dashboard" class="topnav-logo">{t('appName')}</a>
      <div class="topnav-links">
        {#each navItems as item}
          <a
            href={item.href}
            class="topnav-link"
            class:active={currentPath.startsWith(item.href)}
          >
            {item.label}
          </a>
        {/each}
        <button class="topnav-lang" onclick={toggleLang} aria-label="Toggle language">
          {locale.value.toUpperCase()}
        </button>
      </div>
    </div>
  </nav>

  <nav class="bottomnav">
    {#each navItems as item}
      <a
        href={item.href}
        class="bottomnav-tab"
        class:active={currentPath.startsWith(item.href)}
      >
        <item.icon size={22} />
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>
{/if}

<main class:has-nav={showNav} class:full={fullBleed}>
  {@render children()}
</main>

<style>
  .topnav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 56px;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    z-index: 100;
    display: flex;
    align-items: center;
  }

  .topnav-inner {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .topnav-logo {
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    text-decoration: none;
    letter-spacing: -0.3px;
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }

  .topnav-logo:hover { text-decoration: none; }

  .topnav-links {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .topnav-link {
    display: none;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text2);
    text-decoration: none;
    transition: all 0.15s;
  }

  .topnav-link:hover {
    color: var(--text);
    background: var(--surface);
    text-decoration: none;
  }

  .topnav-link.active {
    color: var(--accent);
    background: rgba(10, 132, 255, 0.1);
  }

  .topnav-lang {
    min-width: 44px;
    min-height: 44px;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .topnav-lang:hover {
    color: var(--text);
    border-color: var(--text2);
  }

  .bottomnav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: stretch;
    justify-content: space-around;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid var(--border);
    padding-bottom: env(safe-area-inset-bottom);
    z-index: 100;
  }

  .bottomnav-tab {
    flex: 1;
    min-height: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 6px 4px;
    color: var(--text2);
    text-decoration: none;
    font-size: 11px;
    font-weight: 500;
  }

  .bottomnav-tab.active {
    color: var(--accent);
  }

  main {
    padding: 20px;
    max-width: 720px;
    margin: 0 auto;
  }

  main.has-nav {
    padding-top: 76px;
    padding-bottom: calc(76px + env(safe-area-inset-bottom));
  }

  main.full {
    max-width: none;
    padding: 0;
  }

  @media (min-width: 640px) {
    .topnav-link {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
    }

    .bottomnav {
      display: none;
    }

    main.has-nav {
      padding-bottom: 20px;
    }
  }
</style>
