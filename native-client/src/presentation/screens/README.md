Screens are containers that wire application use cases to presentational components.

- `SessionGate` picks the screen from the session state (`useSession`): loading, retry when the saved session is unreadable, the auth flow when signed out or expired, `SignedInNavigator` otherwise.
- `navigation/SignedInNavigator` opens the user's database, builds the planner services and shows a native stack (`routes.ts` has the typed route map; screens draw their own header and change without animation; Android's back button pops the stack).
- `ListsScreen` (home: All tasks and the lists with open counts, quick add a list, the sync status line), `TasksScreen` (quick add, Open, collapsed Completed, undo window), `TaskEditScreen` and `ListEditScreen` (explicit Save, confirmed Delete, a guard on unsaved changes), `AccountScreen` (who is signed in, Sign out, development-only controls).
- `AuthScreen` validates, calls `login`/`register` and maps typed errors to short messages (`authMessages.ts`).
- `StartupErrorScreen` explains a misconfigured build instead of crashing.
- `SyncStatusLine` reads the sync status (`useSyncStatus`); `DevTaskButton` (development builds only, on the Account screen) queues a sample task for manual sync tests.
