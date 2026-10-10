<script>
  import { CalendarDays, MapPin } from '@lucide/svelte';
  import { t } from '$lib/i18n.svelte.js';
  import { formatEventTime, formatShortDate } from '$lib/utils.js';

  // `showDate` prefixes the start date, for lists that span several days.
  let { event, onclick, showDate = false } = $props();

  const timeLabel = $derived(formatEventTime(event, t('eventAllDay'), t('months')));
</script>

<button
  type="button"
  class="event-card"
  style="--card-color: {event.color || 'var(--accent)'}"
  onclick={() => onclick?.(event)}
>
  <span class="card-bar"></span>
  <div class="card-body">
    <span class="card-title">{event.title}</span>
    <span class="card-time">
      <CalendarDays size={13} />
      {#if showDate}<span class="card-date">{formatShortDate(event.start_at, t('months'))}</span>{/if}
      {timeLabel}
    </span>
    {#if event.location}
      <span class="card-meta"><MapPin size={12} /><span class="meta-text">{event.location}</span></span>
    {/if}
  </div>
</button>

<style>
  .event-card {
    display: flex;
    align-items: stretch;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .event-card:hover {
    border-color: var(--card-color);
  }

  .card-bar {
    width: 4px;
    border-radius: 2px;
    background: var(--card-color);
    flex-shrink: 0;
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .card-title {
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-time {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    color: var(--text2);
    font-variant-numeric: tabular-nums;
  }

  .card-date {
    font-weight: 600;
  }

  .card-meta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    font-size: 12px;
    color: var(--text2);
  }

  .meta-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
