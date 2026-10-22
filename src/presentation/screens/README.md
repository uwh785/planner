Screens are containers that wire application use cases to presentational components.

- `SessionGate` picks the screen from the session state (`useSession`): loading, retry when the saved session is unreadable, the auth flow when signed out or expired, the signed-in home otherwise. There is no navigation library yet.
- `AuthScreen` validates, calls `login`/`register` and maps typed errors to short messages (`authMessages.ts`).
- `SignedInHomeScreen` is a placeholder until M5; it holds the user's database open and signs out.
- `StartupErrorScreen` explains a misconfigured build instead of crashing.
