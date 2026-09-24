<script>
  import { Check } from '@lucide/svelte';

  let { progress = 0, size = 48, strokeWidth = 4, status = 'pending' } = $props();

  const radius = $derived((size - strokeWidth) / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const offset = $derived(circumference * (1 - progress));

  const color = $derived(() => {
    if (status === 'completed') return 'var(--green)';
    if (progress >= 1) return 'var(--red)';
    if (progress > 0.75) return 'var(--red)';
    if (progress > 0.5) return 'var(--orange)';
    if (progress > 0.25) return 'var(--yellow)';
    return 'var(--green)';
  });

  const isUrgent = $derived(progress > 0.75 && status !== 'completed');
</script>

<div class="countdown-ring" style="width: {size}px; height: {size}px;" class:urgent={isUrgent}>
  <svg width={size} height={size} viewBox="0 0 {size} {size}">
    <circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke="var(--border)"
      stroke-width={strokeWidth}
    />
    <circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke={color()}
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-dasharray={circumference}
      stroke-dashoffset={offset}
      transform="rotate(-90 {size / 2} {size / 2})"
      style="transition: stroke-dashoffset 1s linear, stroke 0.3s;"
    />
  </svg>
  <div class="countdown-center">
    {#if status === 'completed'}
      <span class="check"><Check size={16} strokeWidth={3} /></span>
    {:else}
      <span class="percent">{Math.round(progress * 100)}%</span>
    {/if}
  </div>
</div>

<style>
  .countdown-ring {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .countdown-center {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .percent {
    font-size: 11px;
    font-weight: 600;
    color: var(--text2);
  }

  .check {
    display: flex;
    font-size: 16px;
    color: var(--green);
    font-weight: 700;
  }

  .urgent {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
</style>
