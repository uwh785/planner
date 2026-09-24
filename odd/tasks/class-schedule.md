# Weekly class schedule

## Objective
Let the user store a weekly class timetable (identical every week) and see today's classes on the dashboard.

## Problem / why
The planner only models tasks (deadline, countdown, status). Classes are recurring fixed time slots that are never "completed", so they need their own entity instead of overloading tasks.

## Scope
- Backend: `class_sessions` table, store CRUD, `/api/classes` endpoints (auth required, per-user).
- Dashboard: "Today's classes" section above the stats (current class highlighted with progress ring until it ends, next class with "starts in X min", rest of the day listed; hidden when no classes today).
- New `/schedule` page: create / edit / delete classes. Mobile and tablet: one day at a time via day tabs (L M M J V S D). From 960px: full week in 7 equal columns, widened beyond the 720px content column (at 640px the columns were too narrow and truncated subjects).
- Navigation: add "Horario"/"Schedule" tab (bottom bar + top nav).
- Out of scope: alternating weeks, date ranges, notifications, importing timetables.

## Data model
`class_sessions`: `user_id` (FK app_users), `class_id` (PK, `cls_` prefix), `subject` TEXT NOT NULL, `day_of_week` INT 0-6 (0 = Sunday), `start_minute` INT 0-1439, `end_minute` INT 1-1440 (> start), `room` TEXT default '', `teacher` TEXT default '', `color` TEXT default '#0A84FF', `updated_at` BIGINT, `deleted` INT default 0. Index on (`user_id`, `day_of_week`).

## Constraints
- Follow existing patterns (pkg/store, pkg/app, cmd/migrate numbered SQL, soft delete, `{data: ...}` responses, prisma schema kept in sync as documentation).
- Mobile first: base styles for 375px, `min-width` queries only, touch targets >= 44x44px, no hover-only interactions.
- Icons only from `@lucide/svelte`. UI copy through i18n (`es` + `en`).
- Validation server-side: subject required, day 0-6, 0 <= start < end <= 1440; 400 on invalid input.
- TDD: strict mode enabled (global config). Go runner: `go test ./...` in `backend/`. Frontend has no test runner: verified with Playwright measurements + screenshots.
- No git repo: work-unit commits not possible until `git init`.

## Tasks
- [x] T1 Backend: migration + prisma model, model struct, store CRUD, validation, handlers, routes; tests first (RED -> GREEN). (route: delegated writer — 4+ non-trivial files)
- [x] T2 Frontend `/schedule` page + i18n keys + nav tab. (route: delegated writer)
- [x] T3 Dashboard "Today's classes" section. (route: delegated writer, same as T2)
- [x] T4 Browser verification at 375/768/1280: CRUD flow, dashboard current/next logic, no overflow, no targets < 44px. (route: parent)

## Acceptance criteria
- `go test ./...` passes, including new tests for validation and the classes store/handlers.
- `POST /api/classes` rejects invalid day/time/subject with 400; users only see their own classes.
- Dashboard shows today's classes ordered by start time with correct current/next state; section hidden when none.
- `/schedule` supports create, edit, delete on mobile and desktop.
- `npm run build` passes; no `max-width` media queries; no text glyph icons.

## Progress / evidence
- T1 (delegated writer): new `pkg/model/class.go` (+ tests), store CRUD + `ErrNotFound`, handlers/routes in `pkg/app/app.go` (+ httptest tests), migration appended, prisma model. RED observed (undefined symbols), GREEN: `go test ./...` 23 passed; with `TEST_DATABASE_URL` 24 passed; `go vet` clean; migrate OK.
- Parent spot check: `go test ./...` 23 passed; live API: empty subject -> 400, `?day=9` -> 400, create -> `cls_` id + default color, list by day OK.
- API contract: `GET /api/classes?day=0..6`, `POST /api/classes` (201), `PUT /api/classes/{id}` (200/404), `DELETE /api/classes/{id}` (200/404); errors `{"error": msg}`; body `{subject, day_of_week, start_minute, end_minute, room, teacher, color}`.
- T2/T3 (delegated writer): `schedule/+page.svelte`, `ClassCard.svelte`, `ClassForm.svelte` (new); `utils.js` pure helpers (`splitTodayClasses`, time conversions); i18n es/en; "Horario" tab (CalendarClock) in bottom bar + top nav; dashboard "Today's classes" with 30s refresh.
- Parent fixes after browser check: form row overflowed at 375px (`repeat(2, minmax(0, 1fr))`); week view moved to >= 960px with equal `minmax(0, 1fr)` columns and wider breakout; color swatches 36px -> 44px.
- T4 evidence (Playwright): dashboard shows current class (ring 50%, "Termina en 30 min") and next ("Empieza en 1 h"); UI create -> edit ("Biologia II", room B3) -> delete confirmed in DB (`deleted = 1`); client validation shows "La hora de fin debe ser posterior a la de inicio"; API 400 on empty subject and `?day=9`. At 375/768/1280 on dashboard, schedule and schedule form: no horizontal overflow, zero targets < 44px.
- `npm run build` passes; no `max-width` queries; no glyph icons; `go test ./...` passes.
- Screenshots: `.playwright-mcp/sched-*.png`.
- Commits: not possible (no git repo).

## Next step
- `git init` + commit. Optional: localized empty-state wording in week columns is long ("No hay clases este día"); could be shortened.
