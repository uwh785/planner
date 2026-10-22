The infrastructure layer implements application ports (SQLite, HTTP, secure storage, notifications).

- `sync`: NetInfo connectivity, AppState lifecycle and real timers behind the sync ports.
- `db/NotifyingDatabase`: tells the sync scheduler about committed local writes.
