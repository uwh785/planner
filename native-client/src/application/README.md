The application layer holds use cases and ports. It depends only on the domain.

- `auth`: session use cases and the authenticated HTTP client.
- `sync`: the sync engine (push then pull, backoff, status), the scheduler that decides when it runs and the coordinator that binds both to the signed-in user. See the Sync section of the root README.
- `planner`: what the lists and tasks screens use, built per signed-in container by `createPlanner`. `PlannerQueries` (open counts per list, tasks by list or "All tasks" split into open and completed, plain and `LiveQuery` versions that rerun on `container.dataChanges`, which fires after local writes and applied pulls), `ListUseCases` and `TaskUseCases` (validation is the domain's), `CompletionWindow` (the five-second undo window; flushed on background, on leaving the screen and before sign-out), `Notices` (the one line the screens say out loud).

Completing a task: the backend has no reopen transition and ignores status on update, so completion is final. It is queued as the timer op `complete` (`{at}`) behind the task's create. A `conflict` answer to it means the server already has the task completed, so the entry is cleared; `not_found` retries five times and then parks as blocked. The undo window exists because of this: nothing is written until it elapses, and a process kill inside it loses the tick.
