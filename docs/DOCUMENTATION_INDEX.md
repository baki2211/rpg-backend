# Documentation Index

> Map of every file in `docs/`. Load the one you need; don't read them all.

## Start Here

- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — overview, stack, key concepts, hard rules. Load first.
- [dev_rulebook.md](dev_rulebook.md) — where code goes and how to test it. Before writing any code or test.

## Reference

| File | What's inside | When to load |
|------|---------------|--------------|
| [setup.md](setup.md) | Docker and native install, env vars, seed, verifying | First time on the project |
| [architecture.md](architecture.md) | Request + WS/SSE lifecycle, layering, transactions, subsystems, jobs | Before any cross-cutting change |
| [backend.md](backend.md) | Domain modules, services, middleware, websockets, utils | Server-side changes |
| [api.md](api.md) | Route mount table, auth/CSRF, per-domain endpoints, health, rate limits | Changing the public surface |
| [database.md](database.md) | 24 tables, conventions, migration list, seed, default-row endpoints | Schema or query work |
| [testing.md](testing.md) | Unit and integration suites, harness, how to write a scenario, CI | Adding tests |


## Conventions

- One topic per file; cross-link instead of duplicating. Each file stays under ~200 lines.
- Point at files and functions, not line numbers (they rot).
- Don't record history ("split on 2026-06-12", "was 37k") in reference docs; git has it. Dates belong only
  on status lines ("checked 2026-10-25") and in plans.
- Links are relative to the file.
