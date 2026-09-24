<script>
  import { formatTimeRange } from '$lib/utils.js';

  let { cls, onclick } = $props();
</script>

<button
  type="button"
  class="class-card"
  style="--card-color: {cls.color || 'var(--accent)'}"
  onclick={() => onclick?.(cls)}
>
  <span class="card-bar"></span>
  <div class="card-body">
    <span class="card-subject">{cls.subject}</span>
    <span class="card-time">{formatTimeRange(cls.start_minute, cls.end_minute)}</span>
    {#if cls.room || cls.teacher}
      <span class="card-meta">{[cls.room, cls.teacher].filter(Boolean).join(', ')}</span>
    {/if}
  </div>
</button>

<style>
  .class-card {
    display: flex;
    align-items: stretch;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text);
    text-align: left;
    cursor: pointer;
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

  .card-subject {
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-time {
    font-size: 13px;
    color: var(--text2);
    font-variant-numeric: tabular-nums;
  }

  .card-meta {
    font-size: 12px;
    color: var(--text2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
