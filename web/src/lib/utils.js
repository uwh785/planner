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

// getElapsedMs returns how much of a task's countdown has run so far: the
// accumulated elapsed_ms from previous in_progress segments (persisted by
// the backend on pause/complete), plus the current running segment
// (now - started_at) when the task is actively in_progress. A paused task
// (no started_at) has no running segment, so this stays frozen at its
// accumulated value.
export function getElapsedMs(task, nowMs = Date.now()) {
  const base = task.elapsed_ms || 0;
  if (task.status === 'in_progress' && task.started_at) {
    return base + Math.max(nowMs - task.started_at, 0);
  }
  return base;
}

// A completed task always shows full progress and zero remaining time,
// regardless of duration_ms/elapsed_ms (e.g. completed straight from
// pending, before any time elapsed).
export function getProgressPercent(task, nowMs = Date.now()) {
  if (task.status === 'completed') return 1;
  if (!task.duration_ms) return 0;
  return Math.min(getElapsedMs(task, nowMs) / task.duration_ms, 1);
}

export function getRemainingMs(task, nowMs = Date.now()) {
  if (task.status === 'completed') return 0;
  if (!task.duration_ms) return 0;
  return Math.max(task.duration_ms - getElapsedMs(task, nowMs), 0);
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

// Subjects are compared through this key, never displayed through it. The
// server stores them upper-cased but keeps the accents, so folding is what
// lets "FISICA" find "Física" and inherit its teacher and color. NFD splits
// "Í" into "I" plus a combining acute, and those marks are then dropped --
// NFD alone is not a fold, it only makes the string longer.
export function normalizeSubject(subject) {
  return (subject || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function buildSubjectCatalog(classes) {
  const catalog = new Map();
  for (const c of Array.isArray(classes) ? classes : []) {
    const key = normalizeSubject(c.subject);
    if (key && !catalog.has(key)) {
      catalog.set(key, { subject: c.subject, teacher: c.teacher || '', color: c.color || '' });
    }
  }
  return catalog;
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

// Builds an event's start_at/end_at (epoch ms) from the form inputs. An
// all-day event starts at local midnight of its date and has no end; a timed
// event without an end time also has no end. Returns null when the date or
// start time is missing or malformed.
export function eventTimesFromInputs(dateStr, allDay, startTime, endTime) {
  if (allDay) {
    const start = fromDateInputValue(dateStr);
    return start === null ? null : { start_at: start, end_at: null };
  }
  if (!startTime) return null;
  const start = combineLocalDateTime(dateStr, startTime);
  if (start === null) return null;
  const end = endTime ? combineLocalDateTime(dateStr, endTime) : null;
  return { start_at: start, end_at: end };
}

// Mirrors the backend rule: an event may end when it starts, never before.
export function isEventEndValid(times) {
  return !times || times.end_at === null || times.end_at >= times.start_at;
}

// Maps a failed event save to the i18n key of the message to show. The api
// helper hides the backend's message, so the status is all there is to go on:
// 409 is the storage ceiling (not a plan limit), 413 an oversized body.
export function eventErrorKey(status) {
  if (status === 409) return 'eventStorageLimit';
  if (status === 413) return 'eventTooLarge';
  if (status === 400) return 'eventInvalid';
  return 'eventSaveError';
}

// --- Event display helpers ---

// Local midnight of the last day an event occupies. The end is exclusive, so
// an event ending exactly at midnight does not spill into that day; an event
// without an end (all-day, or timed with no end time) occupies only its
// start day.
function eventLastDayStart(event) {
  const start = event.start_at;
  const end = event.end_at;
  const last = end !== null && end !== undefined && end > start ? end - 1 : start;
  return startOfLocalDay(last);
}

// 'YYYY-MM-DD' keys of every local day the event spans, in order. Capped so a
// malformed range can never loop for long.
export function eventDayKeys(event, maxDays = 366) {
  if (!event || !event.start_at) return [];
  const keys = [];
  const lastDay = eventLastDayStart(event);
  let day = startOfLocalDay(event.start_at);
  while (day <= lastDay && keys.length < maxDays) {
    keys.push(toDateInputValue(day));
    day = addDays(day, 1);
  }
  return keys;
}

// Orders events for display: by day, all-day ones first within a day, then by
// start time.
export function sortEvents(events) {
  return [...(Array.isArray(events) ? events : [])].sort((a, b) => {
    // All-day events lead only within their own day, never across days.
    const dayDiff = startOfLocalDay(a.start_at) - startOfLocalDay(b.start_at);
    if (dayDiff !== 0) return dayDiff;
    if (!!a.all_day !== !!b.all_day) return a.all_day ? -1 : 1;
    return a.start_at - b.start_at;
  });
}

// Events that occupy the local day starting at `dayStartMs`, sorted.
export function eventsOnDay(events, dayStartMs) {
  const list = Array.isArray(events) ? events : [];
  const dayStart = startOfLocalDay(dayStartMs);
  return sortEvents(
    list.filter((e) => e?.start_at && startOfLocalDay(e.start_at) <= dayStart && eventLastDayStart(e) >= dayStart)
  );
}

// Map of 'YYYY-MM-DD' -> sorted events occupying that day; multi-day events
// appear under every day they span.
export function groupEventsByDay(events) {
  const map = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    for (const key of eventDayKeys(event)) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    }
  }
  for (const [key, list] of map) map.set(key, sortEvents(list));
  return map;
}

// Human time label for an event: `allDayLabel` for all-day events, "HH:MM" for
// a timed event without an end, "HH:MM – HH:MM" for a same-day range, and the
// end date added ("HH:MM – 14 nov HH:MM") when it ends on a later day.
export function formatEventTime(event, allDayLabel, monthNames) {
  if (!event) return '';
  if (event.all_day) return allDayLabel || '';
  const start = toTimeInputValue(event.start_at);
  const end = event.end_at;
  if (end === null || end === undefined) return start;
  const endTime = toTimeInputValue(end);
  if (isSameLocalDay(event.start_at, end)) return `${start} – ${endTime}`;
  return `${start} – ${formatShortDate(end, monthNames)} ${endTime}`;
}
