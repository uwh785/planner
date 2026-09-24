export function formatTime(ms) {
  if (!ms || ms <= 0) return '0m';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Short local-day label, e.g. "24 sep". `monthNames` lets callers pass a
// localized month list (e.g. t('months')); defaults to Spanish abbreviations.
export function formatShortDate(ms, monthNames) {
  if (!ms) return '';
  const d = new Date(ms);
  const months = monthNames || ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${d.getDate()} ${(months[d.getMonth()] || '').toLowerCase()}`;
}

// --- Local day / date-time helpers (all pure, no Date.now() side effects
// except where the timestamp is explicitly passed in). ---

export function startOfLocalDay(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Adds `n` local calendar days to `ms`, preserving the wall-clock
// hour/minute/second (safe across DST transitions).
export function addDays(ms, n) {
  const d = new Date(ms);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + n,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds()
  ).getTime();
}

export function isSameLocalDay(a, b) {
  if (!a || !b) return false;
  return startOfLocalDay(a) === startOfLocalDay(b);
}

// 'YYYY-MM-DD' in local time, suitable for <input type="date">.
export function toDateInputValue(ms) {
  if (!ms && ms !== 0) return '';
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Inverse of toDateInputValue: local midnight (ms) of that date, or null.
export function fromDateInputValue(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}

// 'HH:MM' in local time, suitable for <input type="time">.
export function toTimeInputValue(ms) {
  if (!ms && ms !== 0) return '';
  const d = new Date(ms);
  const h = d.getHours().toString().padStart(2, '0');
  const mi = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${mi}`;
}

// Combines a 'YYYY-MM-DD' date and 'HH:MM' time (both local) into ms.
export function combineLocalDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const [h, mi] = (timeStr || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, h || 0, mi || 0, 0, 0).getTime();
}

// Overdue rule: timed tasks are overdue once due_date has passed; all-day
// tasks are overdue only once their local day has fully ended. Completed
// tasks are never overdue.
export function isOverdue(task, nowMs = Date.now()) {
  if (!task?.due_date || task.status === 'completed') return false;
  if (task.due_all_day) return task.due_date + 86400000 <= nowMs;
  return task.due_date < nowMs;
}

// Groups tasks into calendar-day buckets using local day boundaries and the
// isOverdue rule above. "Today" is also the catch-all for any non-overdue
// task whose due day is today or earlier (e.g. a completed task from a past
// day) — this keeps the four time buckets contiguous without a fifth
// "past but done" bucket. Each bucket is sorted by due_date ascending.
export function groupTasksByDay(tasksList, nowMs = Date.now()) {
  const list = Array.isArray(tasksList) ? tasksList : [];
  const todayStart = startOfLocalDay(nowMs);
  const tomorrowStart = addDays(todayStart, 1);
  const afterTomorrowStart = addDays(todayStart, 2);

  const groups = { overdue: [], today: [], tomorrow: [], upcoming: [], noDate: [], earlier: [] };

  for (const task of list) {
    if (!task.due_date) {
      groups.noDate.push(task);
    } else if (isOverdue(task, nowMs)) {
      groups.overdue.push(task);
    } else if (task.due_date < todayStart) {
      // Past days that are not overdue can only be completed tasks.
      groups.earlier.push(task);
    } else if (task.due_date < tomorrowStart) {
      groups.today.push(task);
    } else if (task.due_date < afterTomorrowStart) {
      groups.tomorrow.push(task);
    } else {
      groups.upcoming.push(task);
    }
  }

  const byDueDate = (a, b) => a.due_date - b.due_date;
  groups.overdue.sort(byDueDate);
  groups.today.sort(byDueDate);
  groups.tomorrow.sort(byDueDate);
  groups.upcoming.sort(byDueDate);
  groups.earlier.sort((a, b) => b.due_date - a.due_date);

  return groups;
}

export function getProgressPercent(task) {
  if (!task.duration_ms || !task.started_at) return 0;
  const elapsed = Date.now() - task.started_at;
  return Math.min(elapsed / task.duration_ms, 1);
}

export function getRemainingMs(task) {
  if (!task.duration_ms || !task.started_at) return task.duration_ms || 0;
  const elapsed = Date.now() - task.started_at;
  return Math.max(task.duration_ms - elapsed, 0);
}

export function minutesToTime(minutes) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatTimeRange(startMinute, endMinute) {
  return `${minutesToTime(startMinute)} – ${minutesToTime(endMinute)}`;
}

export function formatMinuteDuration(totalMinutes) {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h} h ${rem} min` : `${h} h`;
}

export function dowToMondayIndex(dow) {
  return (dow + 6) % 7;
}

export function mondayIndexToDow(index) {
  return (index + 1) % 7;
}

export function splitTodayClasses(classes, nowMinute) {
  const list = Array.isArray(classes) ? classes : [];
  let current = null;
  const future = [];
  for (const c of list) {
    if (c.start_minute <= nowMinute && nowMinute < c.end_minute) {
      if (!current) current = c;
    } else if (c.start_minute > nowMinute) {
      future.push(c);
    }
  }
  future.sort((a, b) => a.start_minute - b.start_minute);
  const next = future.length > 0 ? future[0] : null;
  const upcoming = future.slice(1);
  return { current, next, upcoming };
}
