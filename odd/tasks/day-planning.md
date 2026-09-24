# Day planning (today / tomorrow)

## Objective
Support the use case "during the day or every night I add tasks to do tomorrow or on a given date": quick date assignment, optional time, and views grouped by calendar day.

## Problem (verified in code)
1. No Today/Tomorrow view: dashboard "upcoming" is a rolling 24h window (`backend/pkg/app/app.go` dashboard), not calendar days.
2. Due date input is `datetime-local` (time mandatory), no shortcuts.
3. Calendar day tap navigates to `/tasks?date=YYYY-MM-DD`, but the tasks page ignores it and the API has no date filter; calendar only loads pending tasks.
4. Timezone bug: `TaskForm.svelte` pre-fills with `toISOString()` (UTC), shifting the time by the UTC offset on every edit.

## Design decisions
- New column `tasks.due_all_day BOOLEAN NOT NULL DEFAULT false` (JSON `due_all_day`). Date-only tasks store `due_date` = local midnight (ms) of that day, computed by the client.
- Day boundaries are the user's local days; the server stays timezone-agnostic: the client sends `from`/`to` epoch-ms ranges (`GET /api/tasks?from=<ms>&to=<ms>`, half-open `[from, to)` on `due_date`).
- Overdue: timed task -> `due_date < now`; all-day task -> overdue only after its day ends (`due_date + 86400000 <= now`). Applies to the `overdue` filter and the dashboard summary.
- Grouping (Overdue / Today / Tomorrow / Upcoming / No date) is a pure client helper over the loaded tasks, using local day boundaries.

## Scope
- Backend: migration + prisma, model field, store select/create/update, `from`/`to` filter with validation (400 on non-integer or from >= to), overdue logic, tests.
- Frontend: TaskForm quick chips (Today / Tomorrow / Pick date) + optional time toggle, local-time prefill fix; tasks page grouped sections + `?date=YYYY-MM-DD` filter with a clear-filter control; calendar loads tasks via range and shows all non-deleted ones for the month; dashboard "Today's tasks" section (today + overdue, not completed); task card shows "Today"/"Tomorrow"/date and time only when set.
- Out of scope: recurring tasks, reminders/notifications, drag-and-drop rescheduling.

## Constraints
- Mobile first (base 375px, `min-width` queries, >= 44x44 targets, no hover-only), Lucide icons only, i18n es + en.
- TDD strict: backend `go test ./...` (RED -> GREEN). Frontend has no runner: pure helpers checked with node + Playwright verification.
- No git repo: work-unit commits not possible.

## Tasks
- [x] T1 Backend: `due_all_day`, range filter, overdue logic, tests. (route: delegated writer — 4+ files)
- [x] T2 Frontend form: chips + optional time + TZ fix. (route: delegated writer)
- [x] T3 Frontend views: tasks grouping + `?date` filter, calendar range load, dashboard "Today's tasks", card date label. (route: delegated writer, same as T2)
- [x] T4 Browser verification at 375/768/1280 incl. create-for-tomorrow flow and edit round-trip keeps the time. (route: parent)

## Acceptance criteria
- Creating a task with "Tomorrow" (no time) shows it under "Tomorrow" and not as overdue until tomorrow ends.
- Editing a timed task and saving without changes keeps the exact same `due_date`.
- Tapping a calendar day shows only that day's tasks, with a way to clear the filter.
- Dashboard shows today's (and overdue) pending tasks.
- `go test ./...` and `npm run build` pass; no overflow and no targets < 44px at 375/768/1280.

## Progress / evidence
- T1 (delegated writer): `due_all_day` in model/store/migration 15/prisma; `TaskFilters.From/To`; shared `overdueCondition` used by filter and summary; `parseDateRange` in app. RED: compile errors (unknown field DueAllDay, undefined parseDateRange). GREEN: `go test ./...` 42 passed; with TEST_DATABASE_URL 44 passed; `go vet` clean; migrate OK.
- Parent spot check: `go test ./...` ok; live API `?from=abc` -> 400, `from>to` -> 400, task JSON has `due_all_day`.
- T2/T3 (delegated writer): TaskForm chips (Hoy/Mañana/Elegir fecha/Sin fecha) + optional time, local prefill; `utils.js` date helpers + `groupTasksByDay`; tasks page grouped sections + `?date` filter + clear button; calendar month range load (all statuses) + local date navigation; dashboard "Tareas de hoy"; TaskCard labels. No `toISOString` left in src.
- Parent fix: completed tasks from past days landed in "Today"; added `earlier` bucket ("Anteriores"/"Earlier"), node check: oldDone -> earlier, oldPending -> overdue, all-day today -> today.
- T4 evidence (Playwright, TZ -05): "Mañana" without time saved `due_date` = local midnight tomorrow, `due_all_day: true`, listed under Mañana; timed task edit -> save kept `due_date` 1790278200000 exactly; calendar tap on 24 -> `/tasks?date=2026-09-24` shows only that day with "Clear date filter"; dashboard shows "Tareas de hoy" (empty state when nothing pending today). No overflow and no targets < 44px at 375/768/1280 on dashboard, tasks, tasks?date, calendar, tasks/new (date + time inputs open).
- `go test ./...` ok; `npm run build` ok. Screenshots `.playwright-mcp/day-*.png`.
- Commits: not possible (no git repo).

## Next step
- Dashboard still has the old backend "Próximas a vencer" section (rolling 24h), now redundant with "Tareas de hoy" — candidate for removal.
