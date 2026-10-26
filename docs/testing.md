# Testing

> How the two test suites work and how to add to them. The rules for writing tests are in
> [`dev_rulebook.md`](dev_rulebook.md) §5–6; this file covers the mechanics.

## Suites

| Suite | Command | Config | Needs | Size (2026-10-25) |
|---|---|---|---|---|
| Unit (`tests/unit/`) | `npm test` / `npm run test:unit` | `vitest.config.js` | nothing | 24 files, 599 tests, < 1 s |
| Integration (`tests/integration/`) | `npm run test:integration` | `vitest.integration.config.js` | `docker compose up -d db` | 39 files, 102 tests, ~30 s |

`npm run test:all` runs both. Single file: `npx vitest run <path>` (add
`--config vitest.integration.config.js` for integration). Single test: `-t "<name substring>"`.

CI (`.github/workflows/`, push and PR to `main`):
- `node.js.yml` `build`: unit suite on Node 20 and 22.
- `node.js.yml` `integration`: integration suite on Node 22 with a `postgres:12` service.

## Unit tests

- Cover `src/domain/` and the pure helpers listed under "Domain paths" in
  [`.unit-testing-review.md`](../.unit-testing-review.md) (`inputValidator`, `healthStatus`,
  `httpResponseForError`, `inCharacterLockOrder`, `withTimeout`), plus `errorHandler`.
- Layout mirrors the source: `tests/unit/{domain,middleware,utils}/`.
- No `vi.mock` anywhere in `tests/unit/`. `restoreMocks` is on.
- Pass rolls and timestamps as arguments; never depend on `Math.random` or the clock.

## Integration tests

Supertest against `createApp()` with real Postgres. Files run one at a time (`fileParallelism: false`)
and each file gets fresh modules, so in-process state such as rate-limit counters doesn't leak.

### Harness (`tests/integration/support/`)

| File | Role |
|---|---|
| `env.js` | Connection settings from the shell, then `.env`, then compose defaults. The DB is always `TEST_DB_NAME` or `rpg_test`, never `DB_NAME`, and must end in `_test`. `DB_SYNC=false`; fixed `JWT_SECRET`. |
| `globalSetup.js` | Once per run: creates `rpg_test` if missing, runs `src/migrations/`, fails on schema drift between models and migrations. |
| `setup.js` | Per file: initializes `AppDataSource`; `resetDatabase()` before **every** test (`TRUNCATE … RESTART IDENTITY CASCADE` on every entity table, guarded by `current_database()`, and clears `staticDataCache`); destroys the connection after the file. |
| `auth.js` | `logIn(app, user)` posts to `/api/auth/login`, keeps the cookie in a supertest agent and echoes `csrfToken` as `X-CSRF-Token`. Returns `{ status, headers, body }`. |
| `factories.js` | `makeUser`, `makeCharacter`, `makeSkill`, `giveSkill`, `makeCombatRound`, ... Insert rows through repositories. Pass only the fields the test cares about. |
| `database.js` | `query(sql, params)` re-reads state in the assert step. Quote camelCase columns. |
| `dice.js` | Replacement for `src/utils/dice.js`: every d20 is 11 (Standard, ×1.0). |

### Writing a scenario

- **Arrange** with factories, then log in. **Act** with one HTTP call. **Assert** the status and body,
  then re-read the DB with `query`.
- Expected numbers are hand-computed literals. With no scaling stats and 0 uses,
  `output = basePower × 2 × 1.0`.
- If the scenario depends on the d20:
  `vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'))`.
  That and WebSocket pushes are the only allowed mocks; no HTTP route under test pushes yet, so no WS spy
  exists. When one is needed, inject a handwritten spy at the broadcaster edge.
- **At most 5 logins per file**: `authAttemptLimit` allows 5 per 15 min per IP with the in-memory store.
- Redis is never used in tests (the store is created in `lifecycle.js`, which tests don't call). If a test
  ever needs it, run a real Redis container; don't mock `ioredis`.

## Not covered yet

- WebSocket servers (`src/websockets/`) and the presence SSE stream have no tests.
- Background jobs are covered only where an HTTP route triggers them (`engineLogCleanup.test.js`).
