<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { A, api } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import TaskForm from '$lib/components/TaskForm.svelte';
  import CountdownRing from '$lib/components/CountdownRing.svelte';
  import { formatTime, formatDate, getProgressPercent, getRemainingMs } from '$lib/utils.js';
  import { ArrowLeft, Pencil, Trash2, X, Square, SquareCheck, Plus } from '@lucide/svelte';

  let task = $state(null);
  let loading = $state(true);
  let editing = $state(false);
  let newSubtask = $state('');

  const taskId = $derived($page.params.id);

  $effect(() => {
    if (!A.token) goto('/');
    else {
      loadTask();
    }
  });

  async function loadTask() {
    loading = true;
    try {
      task = await api(`/api/tasks/${taskId}`);
    } catch {
      goto('/tasks');
    } finally {
      loading = false;
    }
  }

  async function handleUpdate(data) {
    try {
      await api(`/api/tasks/${taskId}`, { method: 'PUT', body: data });
      editing = false;
      loadTask();
    } catch {}
  }

  async function handleDelete() {
    if (!confirm(t('taskDeleteConfirm'))) return;
    try {
      await api(`/api/tasks/${taskId}`, { method: 'DELETE' });
      goto('/tasks');
    } catch {}
  }

  async function handleStart() {
    await api(`/api/tasks/${taskId}/start`, { method: 'PUT' });
    loadTask();
  }

  async function handlePause() {
    await api(`/api/tasks/${taskId}/pause`, { method: 'PUT' });
    loadTask();
  }

  async function handleComplete() {
    await api(`/api/tasks/${taskId}/complete`, { method: 'PUT' });
    loadTask();
  }

  async function addSubtask() {
    if (!newSubtask.trim()) return;
    try {
      await api(`/api/tasks/${taskId}/subtasks`, {
        method: 'POST',
        body: { title: newSubtask.trim() }
      });
      newSubtask = '';
      loadTask();
    } catch {}
  }

  async function toggleSubtask(st) {
    try {
      await api(`/api/tasks/${taskId}/subtasks/${st.subtask_id}`, {
        method: 'PUT',
        body: { ...st, completed: !st.completed }
      });
      loadTask();
    } catch {}
  }

  async function deleteSubtask(sid) {
    try {
      await api(`/api/tasks/${taskId}/subtasks/${sid}`, { method: 'DELETE' });
      loadTask();
    } catch {}
  }
</script>

<div class="task-detail">
  {#if loading}
    <p class="loading">{t('msgSaving')}</p>
  {:else if !task}
    <p class="error">Task not found</p>
  {:else if editing}
    <div class="page-header">
      <button class="btn-back" onclick={() => editing = false} aria-label="Back"><ArrowLeft size={18} /></button>
      <h1>{t('taskEdit')}</h1>
    </div>
    <TaskForm
      {task}
      onsubmit={handleUpdate}
      oncancel={() => editing = false}
    />
  {:else}
    <div class="page-header">
      <button class="btn-back" onclick={() => goto('/tasks')} aria-label="Back"><ArrowLeft size={18} /></button>
      <h1>{task.title}</h1>
      <div class="header-actions">
        <button class="btn-icon" onclick={() => editing = true} aria-label="Edit"><Pencil size={16} /></button>
        <button class="btn-icon btn-danger" onclick={handleDelete} aria-label="Delete"><Trash2 size={16} /></button>
      </div>
    </div>

    {#if task.description}
      <p class="description">{task.description}</p>
    {/if}

    <div class="meta-grid">
      {#if task.priority > 0}
        <div class="meta-item">
          <span class="meta-label">{t('taskPriority')}</span>
          <span class="meta-value priority-{task.priority}">
            {[, t('taskPriorityLow'), t('taskPriorityMedium'), t('taskPriorityHigh')][task.priority]}
          </span>
        </div>
      {/if}

      {#if task.due_date}
        <div class="meta-item">
          <span class="meta-label">{t('taskDueDate')}</span>
          <span class="meta-value">{formatDate(task.due_date)}</span>
        </div>
      {/if}

      <div class="meta-item">
        <span class="meta-label">{t('taskStatus')}</span>
        <span class="meta-value status-{task.status}">{task.status}</span>
      </div>
    </div>

    {#if task.duration_ms}
      <div class="timer-section">
        <CountdownRing
          progress={getProgressPercent(task)}
          size={80}
          strokeWidth={6}
          status={task.status}
        />
        <div class="timer-detail">
          <span class="timer-label">{t('taskTimeLeft')}</span>
          <span class="timer-value">{formatTime(getRemainingMs(task))}</span>
        </div>
      </div>
    {/if}

    <div class="actions">
      {#if task.status === 'pending'}
        <button class="btn-action btn-start" onclick={handleStart}>{t('taskStart')}</button>
      {:else if task.status === 'in_progress'}
        <button class="btn-action btn-pause" onclick={handlePause}>{t('taskPause')}</button>
      {/if}
      {#if task.status !== 'completed'}
        <button class="btn-action btn-complete" onclick={handleComplete}>{t('taskComplete')}</button>
      {/if}
    </div>

    {#if task.subtasks}
      <section class="section">
        <h3>{t('taskSubtasks')}</h3>
        <div class="subtask-list">
          {#each task.subtasks as st}
            <div class="subtask-item" class:completed={st.completed}>
              <button class="subtask-check" onclick={() => toggleSubtask(st)} aria-label={st.completed ? 'Mark subtask as pending' : 'Mark subtask as done'}>
                {#if st.completed}<SquareCheck size={18} />{:else}<Square size={18} />{/if}
              </button>
              <span class="subtask-title">{st.title}</span>
              <button class="subtask-del" onclick={() => deleteSubtask(st.subtask_id)} aria-label="Delete subtask"><X size={16} /></button>
            </div>
          {/each}
        </div>
        <form class="subtask-add" onsubmit={e => { e.preventDefault(); addSubtask(); }}>
          <input
            type="text"
            bind:value={newSubtask}
            placeholder={t('taskSubtaskNew')}
          />
          <button type="submit" aria-label="Add subtask"><Plus size={18} /></button>
        </form>
      </section>
    {/if}
  {/if}
</div>

<style>
  .task-detail {
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
    flex-shrink: 0;
  }

  h1 {
    font-size: 20px;
    font-weight: 600;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .btn-icon {
    min-width: 44px;
    min-height: 44px;
    border-radius: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-danger:hover {
    border-color: var(--red);
  }

  .description {
    color: var(--text2);
    font-size: 15px;
    line-height: 1.5;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .meta-label {
    font-size: 12px;
    color: var(--text2);
  }

  .meta-value {
    font-size: 14px;
    font-weight: 500;
  }

  .status-pending { color: var(--text2); }
  .status-in_progress { color: var(--accent); }
  .status-completed { color: var(--green); }

  .timer-section {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .timer-detail {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .timer-label {
    font-size: 13px;
    color: var(--text2);
  }

  .timer-value {
    font-size: 24px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .actions {
    display: flex;
    gap: 12px;
  }

  .btn-action {
    flex: 1;
    padding: 12px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-action:hover {
    opacity: 0.9;
  }

  .btn-start {
    background: var(--accent);
    color: white;
  }

  .btn-pause {
    background: var(--orange);
    color: white;
  }

  .btn-complete {
    background: var(--green);
    color: white;
  }

  .section h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .subtask-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .subtask-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .subtask-item.completed .subtask-title {
    text-decoration: line-through;
    color: var(--text2);
  }

  .subtask-check {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    flex-shrink: 0;
  }

  .subtask-title {
    flex: 1;
    font-size: 14px;
  }

  .subtask-del {
    background: none;
    border: none;
    color: var(--text2);
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    flex-shrink: 0;
  }

  .subtask-del:hover {
    color: var(--red);
  }

  .subtask-add {
    display: flex;
    gap: 8px;
  }

  .subtask-add input {
    flex: 1;
    min-height: 44px;
    padding: 8px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 14px;
    outline: none;
  }

  .subtask-add input:focus {
    border-color: var(--accent);
  }

  .subtask-add button {
    min-width: 44px;
    min-height: 44px;
    border-radius: 8px;
    background: var(--accent);
    color: white;
    border: none;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading, .error {
    text-align: center;
    padding: 20px;
    color: var(--text2);
  }

  .error {
    color: var(--red);
  }
</style>
