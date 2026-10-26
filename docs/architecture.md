# Architecture

> How a request flows from HTTP/WS in to data and back out, and where the moving pieces live.

## Overview

One Node process: an Express app and the chat WebSocket server share one HTTP server. TypeORM owns the
schema and a `pg` pool talks to Postgres. Game rules are pure functions in `src/domain/`; services load
data, call them, persist, and notify. Background jobs are in-process intervals started after
`AppDataSource.initialize()`.

## HTTP request lifecycle (`src/app.js`)

1. `cors`: allowlist from `CORS_ALLOWED_ORIGINS`, default `localhost:3000`, `localhost:3001`,
2. `compressionMiddleware` + `compressionStatsMiddleware`.
3. `queryMonitoringMiddleware`: tags requests so slow queries are attributed to a route.
4. `cookieParser` → `express.json({ limit: '10mb' })` → `express.urlencoded(...)`.
5. Shim: `req.body = {}` when no parser matched (Express 5 leaves it `undefined`).
6. `/api`: `RateLimitMiddleware.generalApiLimit`. Stricter per-domain limits sit on individual routes.
7. `/api`: `verifyCsrfToken`. `POST | PUT | PATCH | DELETE` need `X-CSRF-Token` equal to the `csrfToken`
   cookie; `/api/auth/login` and `/api/auth/register` are exempt.
8. `/api/<domain>` routers (full list in [`api.md`](api.md)). Per route: `authenticateToken` (JWT from the
   `token` cookie only), then `requireRole(MASTER_OR_ADMIN_ROLES)` (`src/domain/roles.js`) or the older
   `isAdmin` on map/race/health routes.
9. Controller → service → domain → TypeORM → Postgres.
10. `/uploads` static, then `errorHandler` last (`HttpError` → status + `{ message }`).

## WebSocket and realtime

- `src/index.js` wires `server.on('upgrade', createUpgradeHandler({ chatWS, jwtSecret }))`
  (`src/websockets/upgradeHandler.js`). It accepts only `/ws/chat`, reads the JWT from the raw `Cookie`
  header, and computes a connection cap from RSS pressure: 15, then 12 above 70% and 8 above 85% of
  `WS_MEMORY_BUDGET_MB` (default 512). Over the cap → 503.
- Presence runs over **SSE**: `GET /api/presence/events`, with `POST /api/presence/location` and
  `/heartbeat` (`routes/presenceRoutes.js`). There is no presence WebSocket.

## Layering

```
HTTP / WS → middleware → routes → controllers → services ──→ TypeORM → Postgres
                                                   │
                                                   ├→ src/domain/  (pure rules, no I/O)
                                                   └→ src/utils/   (logger, auditLogger, caches, locks)
```

- **Routes** wire verbs to controllers and attach role, rate-limit and upload middleware.
- **Controllers** are static methods wrapped in `asyncHandler`: validate input (`InputValidator`), call a
  service, shape the response, throw `HttpError(status, msg)`.
- **Services** follow validate → load → domain → persist → notify. Each business operation runs in one
  `AppDataSource.transaction`; nested services take the `manager`. Rewritten rows are locked through
  `utils/rowLocks.js` in the order users → characters by id → skill rows.
- **Domain** (`src/domain/{character,chat,combat,skills}`, `roles.js`): no repositories, logger, clock or
  randomness. See [`dev_rulebook.md`](dev_rulebook.md).
- **Models** are TypeORM `EntitySchema` definitions; entities are plain objects.

## Cross-cutting subsystems

- **AuditLogger** (`utils/auditLogger.js`): security and support events. Observable behaviour; keep the calls.
- **memoryManager** (`utils/memoryManager.js`): polls RSS against `RSS_BUDGET_BYTES` (default 512 MB;
  warning/critical/emergency at 68/78/88%). Emergency cleanup can close WS connections.
- **dbHealthMonitor**: periodic DB ping, reported on `/api/health`.
- **staticDataCache**: caches races, skills, branches, types, stat definitions, ranks, combat
  constants and mastery tiers; `getSkillRules()` builds the rank/outcome tables. Reload after direct SQL edits:
  `POST /api/admin/cache/reload[/:entity]`.
- **queryMonitor** (`utils/queryMonitor.js`, `monitoredRepositories.js`): slow-query stats at
  `/api/admin/query-stats`.

## Background jobs

Started in `startServer()` (`src/lifecycle.js`), stopped in `gracefulShutdown`:

- `SessionExpirationJob` (`src/jobs/sessionExpiration.js`): closes idle sessions.
- `MemoryCleanupJob` (`src/jobs/memoryCleanup.js`): GC nudges, cache trims, chat and engine-log purges.

DB-writing steps are wrapped in `pg_try_advisory_lock` (`utils/advisoryLock.js`), so with several
instances they run on one; per-process steps run everywhere.

## Static files

`uploads/` is created on boot and served at `/uploads`. In `docker-compose.yml` it's a volume.

## Related

[`api.md`](api.md) · [`backend.md`](backend.md) · [`database.md`](database.md) · [`DOCUMENTATION_INDEX.md`](DOCUMENTATION_INDEX.md)
