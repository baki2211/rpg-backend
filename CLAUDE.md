# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Backend for Arcane Realms (https://arcanerealms.org), a browser-based tabletop-style RPG. Plain JavaScript ESM (`"type": "module"`), no build step. Express 5, TypeORM 1.0 over PostgreSQL, native `ws` for realtime, JWT auth. CI runs on Node 22; the dev Dockerfile uses `node:20`.

`docs/` is **gitignored** (local only), but when it's present it's the current source of truth. Start at `docs/PROJECT_CONTEXT.md` and use `docs/DOCUMENTATION_INDEX.md` to pick a topic file. `README.md` is a shorter overview that still gets committed.

## Commands

```bash
npm run dev                 # nodemon, watches src/
npm start                   # node src/index.js
npm run seed                # admin/user/map/location seed (src/jobs/seed.js)
docker compose up           # app + postgres for local dev

npm test                    # vitest run (all tests/**/*.test.js)
npm run test:unit           # tests/unit only
npx vitest run tests/unit/SkillEngine.test.js          # single file
npx vitest run -t "<test name substring>"              # single test by name
npm run test:coverage

npm run migration:run
npm run migration:revert
```

There is no linter configured.

The server refuses to start without `JWT_SECRET`. The DB is configured with discrete `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` variables; `DATABASE_URL` is not read. `REDIS_URL` is optional: if it's set, the rate limiter uses Redis, and otherwise it uses an in-memory store. See `.env-example`.

### Schema changes / migrations

`synchronize` is on only when `NODE_ENV=development` (override with `DB_SYNC=true|false`). Every environment outside dev changes schema only through `src/migrations/`. After editing a `src/models/*.js` EntitySchema, generate the migration against an empty `rpg_baseline` DB. If you diff against your live dev DB, the result comes back empty because synchronize has already applied the change.

```bash
DB_SYNC=false DB_NAME=rpg_baseline npm run migration:run
DB_SYNC=false DB_NAME=rpg_baseline npm run migration:generate -- src/migrations/<DescriptiveName>
```

To verify, re-run generate into a throwaway name. It must report "No changes in database schema were found". `docs/migrations.md` covers the full workflow and the VPS sync.

## Architecture

- `src/index.js` is a thin entry point. It loads env, builds the app, creates the HTTP server, wires both WebSocket servers and the `upgrade` handler, then calls `startServer()` and `installShutdownHandlers()`.
- `src/app.js` builds the Express app (`createApp()`, which supertest can import). The middleware order is: CORS → compression → query monitoring → cookie/body parsing → a shim that sets `req.body = {}` when no parser matched (Express 5 leaves it undefined) → general rate limit on `/api` → CSRF on `/api` → all `/api/<domain>` routers → `/uploads` static → `errorHandler`.
- `src/lifecycle.js` initializes `AppDataSource`, monitors, the static data cache and background jobs (`sessionExpiration`, `memoryCleanup`), then starts listening. It also handles graceful shutdown. The parts of these jobs that write to the DB are guarded by `pg_try_advisory_lock` (`utils/advisoryLock.js`) so they're safe across multiple instances.
- Layering: `routes/` (verb wiring plus per-route middleware for role, rate limit and upload) → `controllers/` (static methods wrapped in `asyncHandler`, throwing `HttpError(status, msg)`) → `services/` (business logic) → TypeORM repositories.
- Models are TypeORM `EntitySchema` definitions, not classes, so entities are plain objects. Persist them with `repository.save(entity)` or `manager.save(...)`, never `entity.save()`. DB column names are camelCase, so quote them in raw SQL (`"userId"`). Check `src/models/` for real field names. For example, HP is `stats.hp`.
- Auth: the JWT is read only from the `token` httpOnly cookie. Mutating `/api` requests need an `X-CSRF-Token` header that matches the `csrfToken` cookie (double-submit); login and register are exempt. Roles are `user`, `staffer`, `master` and `admin`, gated by `requireRole([...])` in `middleware/authMiddleware.js`. Older map and race routes use `isAdmin` instead.
- Realtime: chat lives at `/ws/chat` and is authenticated in `websockets/upgradeHandler.js`. That handler also caps chat connections based on RSS memory pressure. Presence WS is a separate server, cross-wired through `chatWS.setPresenceBroadcaster(...)`. `utils/memoryManager.js` can force-close WS connections under memory pressure.
- `utils/staticDataCache.js` preloads read-mostly tables (races, skills, stat definitions, combat constants). After editing those tables with direct SQL, bust the cache with `POST /api/admin/cache/reload[/:entity]`. Game tunables live in the `CombatConstant` and `StatDefinition` rows, not in code.
- Domain flows that span several services:
  - **Session/Event**: creating an event mutates the location's existing free-role session in place (`isEvent=true`, `eventId` set), and closing the event reverts it. See `EventService` and the `Session*Service` split (CRUD / Lifecycle / Participant / Query).
  - **Combat**: `CombatService` handles the round lifecycle. `CombatActionService` handles submission through `TargetResolutionService` and `SkillExecutionService`. `CombatResolutionService` handles clash detection and resolution through `PvPResolutionService`.
  - **Skills**: the path is `SkillEngine` → `SkillExecutionService` → `SkillValidationRuleService`. Mastery progresses through `MasteryTier` based on usage (`SkillUsageService`).
- `AuditLogger` calls (`utils/auditLogger.js`) are observable security and support events, so don't remove them. Plain `logger` calls are diagnostic only.

## Code & test rules (from `docs/dev_rulebook.md`)

The repo is moving pure game rules out of services into `src/domain/`, which doesn't exist yet. `.unit-testing-review.md` lists which service methods count as domain code until that move happens.

- **Domain code** (formulas, clash table, rank thresholds, derived stats, level-up) has no I/O: no repositories, services, logger, Redis or fs, and no work at import time. Pass d20 rolls and timestamps in as arguments, never `Math.random()` or `Date.now()` inside a decision. No module-level mutable state. Each rule table has one source of truth.
- **Controllers and services** follow validate → load → call domain → persist → notify, with no business `if`s. `await` every async call (a missing `await` on `resolveClash` once shipped). Each business operation runs in a single `AppDataSource.transaction(async (manager) => ...)`, and nested services take the `manager` as an argument.
- Don't add test-only exports, flags or `NODE_ENV === 'test'` branches.
- **Unit tests** (`tests/unit/`): no `vi.mock` for domain code (needing one means the code is in the wrong layer). Use hard-coded expected literals, AAA layout, small factory functions instead of shared `beforeEach` state, `it.each` across both sides of each threshold, and plain-English test names. The existing tests still mock `data-source.js`, which is a legacy pattern.
- **Integration tests** (`tests/integration/`, planned): supertest against `createApp()` with real Postgres from docker-compose and schema from migrations. Mock only WebSocket pushes. Clean data at the start and run sequentially.
