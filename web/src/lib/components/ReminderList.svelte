<script>
  import { t } from '$lib/i18n.svelte.js';
  import { formatShortDate } from '$lib/utils.js';

  // `reminders` comes from upcomingReminders(): [{ event, daysLeft }], soonest
  // first. Each row links to the event's edit page.
  let { reminders = [] } = $props();

  function countdown(daysLeft) {
    if (daysLeft === 1) return t('dateTomorrow');
    return t('reminderDaysLeft', { count: daysLeft });
  }
</script>

<ul class="reminder-list">
  {#each reminders as { event, daysLeft } (event.event_id)}
    <li>
      <a
        class="reminder-row"
        href={`/events/${event.event_id}`}
        style="--card-color: {event.color || 'var(--accent)'}"
      >
        <span class="row-bar"></span>
        <span class="row-body">
          <span class="row-title">{event.title}</span>
          <span class="row-date">{formatShortDate(event.start_at, t('months'))}</span>
        </span>
        <span class="row-countdown">{countdown(daysLeft)}</span>
      </a>
    </li>
  {/each}
</ul>

<style>
  /* One grouped surface: rows are split by a hairline, not boxed one by one. */
  .reminder-list {
    list-style: none;
    margin: 0;
    padding: 0;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }

  li + li {
    border-top: 1px solid var(--border);
  }

  .reminder-row {
    display: flex;
    align-items: stretch;
    gap: 10px;
    min-height: 44px;
    padding: 10px 12px;
    color: var(--text);
    text-decoration: none;
  }

  .reminder-row:hover {
    background: var(--surface);
  }

  .reminder-row:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .row-bar {
    width: 4px;
    border-radius: 2px;
    background: var(--card-color);
    flex-shrink: 0;
  }

  .row-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .row-title {
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-date {
    font-size: 13px;
    color: var(--text2);
    font-variant-numeric: tabular-nums;
  }

  .row-countdown {
    align-self: center;
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
