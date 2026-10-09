# Events

## Objective
Let the user record one-off dated events (e.g. "thesis presentation on Nov 14 at 10:00") separately from tasks.

## Problem
The only creatable item is a task. A task models work to do (status, priority, timer, subtasks, completion). An event is something that happens at a time: it has a start, an optional end, an optional location, and is never started, paused, or completed.

## Why
The user felt events are different from tasks and only had "new task" available.

## Scope
- New `events` entity, separate from `tasks` (no `type` flag on Task — avoids task-only fields and `if type == event` branches leaking into events).
- Fields: title, description (notes), location, start_at (epoch ms), end_at (epoch ms, optional), all_day, color.
- One-off only; no recurrence.
- Backend CRUD at `/api/events` with `from`/`to` range filter.
- Storage ceiling for events (applies to every plan), text length limits, body size limit — reusing the storage-caps machinery.
- Frontend: the "+" lets the user choose Task or Event; event create/edit form; events shown in the tasks day view, calendar month, and dashboard "today".

## Out of scope
- Recurring events, reminders/notifications, invitations, external calendar sync.
- Free plan limit for events (only the hard ceiling).

## Constraints
- Branch `feat/events` was stacked on `feat/storage-caps`; after storage-caps merged into `main` (d82b62c) it sits directly on `main`.
- Mirror the existing class-session layering: model + Validate func, store methods, app handlers, migration in `backend/cmd/migrate/main.go`.
- Test-first where a deterministic test exists. Runner: `go test ./...` in `backend/`; integration tests need `TEST_DATABASE_URL` (skip otherwise). Frontend check: `npm run build` in `web/`.
- Artifacts (code, UI copy, comments) in English; Spanish UI strings go through the existing i18n file.

## Tasks
- [x] T1 Backend events: migration, model + validation, store CRUD + range list, handlers + routes, storage ceiling, tests - route: delegated writer (5+ non-trivial files)
- [ ] T2 Frontend create/edit: Task/Event chooser on "+", event form, `/events/new` and `/events/[id]`, i18n - route: delegated writer
- [ ] T3 Frontend display: events in tasks day view, calendar month, dashboard today - route: delegated writer

## Acceptance criteria
- POST `/api/events` with a valid body returns 201; missing title, end before start, or oversized text returns 400; body over the limit returns 413.
- GET `/api/events?from=&to=` returns only the user's non-deleted events overlapping the range.
- PUT/DELETE on another user's event returns 404.
- Creating past the events ceiling is refused with the same non-402 status used by other ceilings.
- The user can create, edit, and delete an event from the UI and sees it on its day in the calendar, the day view, and the dashboard.
- `go test ./...` passes; `npm run build` passes.

## Delivery
- Strategy: ask-on-risk. Forecast ~900 authored lines across 3 tasks (exceeds ~400): ask for chain strategy before the second work-unit commit.

## Progress
- Branch `feat/events` created on top of `feat/storage-caps` (d82b62c).

## Next step
T1.
