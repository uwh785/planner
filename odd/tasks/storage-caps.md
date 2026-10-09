# Storage caps

## Objective
Stop any authenticated user, Free or Pro, from growing the database without bound.

## Problem
- Pro has no limits at all (`plan.Unlimited`).
- The Free task limit counts only non-completed, non-deleted tasks, so a create -> complete (or create -> delete) loop is unbounded.
- Classes and subtasks have no limits for any plan.
- Only `class_sessions.subject` has a length limit; other text fields and request bodies are unbounded.

## Why
The user wants Pro granted by manual DB insert to be safe to hand out, and noted an authenticated user could saturate the database.

## Scope
- Hard storage ceilings for every plan, counting every row the user owns (completed and soft-deleted included):
  tasks 5000, lists 100, tags 200, classes 100, subtasks 50 per task.
- Free keeps its existing, tighter plan limits (50 active tasks, 3 lists, 10 tags) on top of the ceilings.
- Length limits on user text fields.
- Request body size limit.

## Out of scope
- Rate limiting: the backend runs on Vercel serverless, so an in-memory limiter does not share state across instances. Needs an external store (e.g. Upstash); separate decision.
- Payment provider / checkout.
- Purging old soft-deleted rows (see Follow-ups).

## Constraints
- Plan limits keep returning 402 (upgrade helps). A storage ceiling returns a non-402 status because upgrading does not lift it.
- `plan` package stays free of DB/HTTP concerns.
- TDD: strict mode enabled (session config). Runner: `go test ./...` in `backend/`. Integration tests need `TEST_DATABASE_URL`, otherwise they skip.

## Tasks
- [x] T1 Storage ceilings for tasks, lists, tags, classes, subtasks (backend) - route: delegated writer (4+ files: plan, store, app, tests)
- [x] T2 Text length limits and request body size limit (backend) - route: delegated writer (same worker)
- [ ] T3 Frontend shows the ceiling error on create forms that lack it - route: delegated writer (same worker)

## Acceptance criteria
- Creating the 5001st task (any status, any plan) is refused; same for each resource at its ceiling.
- Free still gets 402 at its existing plan limits.
- Oversized text or body is refused with 400 / 413.
- `go test ./...` passes; `npm run build` in `web/` passes.

## Progress
- Branch `feat/storage-caps` created from `main` (5a54f38).
- T1 committed in 4af7780.
- T2 verified: `go vet ./...` clean, `go test ./...` 149 passed (2026-10-09).

## Follow-ups
- Counting soft-deleted and completed rows means a long-term heavy user eventually hits the 5000-task ceiling permanently. Consider purging soft-deleted rows after N days, or archiving.

## Next step
T1.
