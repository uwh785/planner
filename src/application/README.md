The application layer holds use cases and ports. It depends only on the domain.

- `auth`: session use cases and the authenticated HTTP client.
- `sync`: the sync engine (push then pull, backoff, status), the scheduler that decides when it runs and the coordinator that binds both to the signed-in user. See the Sync section of the root README.
