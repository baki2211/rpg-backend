# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Backend for Arcane Realms, a browser-based tabletop-style RPG. Plain JavaScript ESM (`"type": "module"`), no build step. Express 5, TypeORM 1.0 over PostgreSQL, native `ws` for realtime, JWT auth. CI runs on Node 20 and 22; the dev Dockerfile uses `node:20`.

`docs/` is the source of truth. Start at `docs/PROJECT_CONTEXT.md` and use `docs/DOCUMENTATION_INDEX.md` to pick a topic file. `README.md` is a shorter public overview.

## Commands

```bash
npm run dev                 # nodemon, watches src/
npm start                   # node src/index.js
npm run seed                # admin/user/map/location seed (src/jobs/seed.js)
docker compose up           # app + postgres for local dev

npm test                    # unit tests only (tests/unit, no DB needed)
npm run test:unit           # same as npm test
npm run test:integration    # tests/integration against the rpg_test DB (needs `docker compose up -d db`)
npm run test:all            # unit, then integration
npx vitest run tests/unit/domain/clashTable.test.js    # single file
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

Data migrations also exist. `AlignSkillRuleRows` rewrites seeded `mastery_tiers` and `MASTERY_TIER_*`/`OUTCOME_*` rows to the code defaults. Run `npm run migration:run` on a seeded DB **before** you start code from this version, or gameplay values change.

To verify, re-run generate into a throwaway name. It must report "No changes in database schema were found". `docs/migrations.md` covers the full workflow and the VPS sync.

## Architecture

- `src/index.js` is a thin entry point. It loads env, builds the app, creates the HTTP server, wires both WebSocket servers and the `upgrade` handler, then calls `startServer()` and `installShutdownHandlers()`.
- `src/app.js` builds the Express app (`createApp()`, which supertest can import). The middleware order is: CORS → compression → query monitoring → cookie/body parsing → a shim that sets `req.body = {}` when no parser matched (Express 5 leaves it undefined) → general rate limit on `/api` → CSRF on `/api` → all `/api/<domain>` routers → `/uploads` static → `errorHandler`.
- `src/lifecycle.js` initializes `AppDataSource`, monitors, the static data cache and background jobs (`sessionExpiration`, `memoryCleanup`), then starts listening. It also handles graceful shutdown. The parts of these jobs that write to the DB are guarded by `pg_try_advisory_lock` (`utils/advisoryLock.js`) so they're safe across multiple instances.
- Layering: `routes/` (verb wiring plus per-route middleware for role, rate limit and upload) → `controllers/` (static methods wrapped in `asyncHandler`, throwing `HttpError(status, msg)`) → `services/` (business logic) → TypeORM repositories.
- Models are TypeORM `EntitySchema` definitions, not classes, so entities are plain objects. Persist them with `repository.save(entity)` or `manager.save(...)`, never `entity.save()`. DB column names are camelCase, so quote them in raw SQL (`"userId"`). Check `src/models/` for real field names. For example, HP is `stats.hp`.
- Auth: the JWT is read only from the `token` httpOnly cookie. Mutating `/api` requests need an `X-CSRF-Token` header that matches the `csrfToken` cookie (double-submit); login and register are exempt. Roles are `user`, `staffer`, `master` and `admin`, gated by `requireRole([...])` in `middleware/authMiddleware.js`. Older map and race routes use `isAdmin` instead.
- Realtime: chat lives at `/ws/chat` and is authenticated in `websockets/upgradeHandler.js`. That handler also caps chat connections based on RSS memory pressure. Presence has no WebSocket: it runs over SSE (`routes/presenceRoutes.js`). `utils/memoryManager.js` can force-close WS connections under memory pressure.
- `utils/staticDataCache.js` preloads read-mostly tables (races, skills, stat definitions, combat constants). After editing those tables with direct SQL, bust the cache with `POST /api/admin/cache/reload[/:entity]`. Game tunables live in the `CombatConstant`, `MasteryTier` and `StatDefinition` rows. `staticDataCache.getSkillRules()` turns those rows into the rank and outcome tables. The defaults in `src/domain/skills/` are used when rows are missing or invalid. The game design isn't final: refactors keep current values, and rule questions go to `docs/game_design_gaps.md`.
- Domain flows that span several services:
  - **Session/Event**: creating an event mutates the location's existing free-role session in place (`isEvent=true`, `eventId` set), and closing the event reverts it. See `EventService` and the `Session*Service` split (CRUD / Lifecycle / Participant / Query).
  - **Combat**: `CombatService` handles the round lifecycle. `CombatActionService` handles submission through `TargetResolutionService` and `SkillExecutionService`. `CombatResolutionService` handles clash detection and resolution through `src/domain/combat/{roundClashes,clashTable}.js`. The d20 is rolled once per side at the request edge (`utils/dice.js`) and passed down.
  - **Skills**: `SkillEngine` is a thin shell over `src/domain/skills/{output,ranks,outcome,skillCost}.js`. Rank comes from usage (`SkillUsageService.incrementSkillUsage(…, manager)`) and the rules from `getSkillRules()`.
- **Transactions and locks**: a chat post, combat submit, `useSkill`, acquire skill and activate character each run in one transaction. Rows that get rewritten are locked through `utils/rowLocks.js`, in this order: users → characters by id → skill rows. `getActiveCharacter` is read-only.
- `AuditLogger` calls (`utils/auditLogger.js`) are observable security and support events, so don't remove them. Plain `logger` calls are diagnostic only.

## Code & test rules (from `docs/dev_rulebook.md`)

Pure game rules live in `src/domain/{chat,combat,skills,character}`. Services and controllers are shells around them. `.unit-testing-review.md` describes how the code is classified.

- **Domain code** (formulas, clash table, rank thresholds, derived stats, level-up) has no I/O: no repositories, services, logger, Redis or fs, and no work at import time. Pass d20 rolls and timestamps in as arguments, never `Math.random()` or `Date.now()` inside a decision. No module-level mutable state. Each rule table has one source of truth.
- **Controllers and services** follow validate → load → call domain → persist → notify, with no business `if`s. `await` every async call (a missing `await` on `resolveClash` once shipped). Each business operation runs in a single `AppDataSource.transaction(async (manager) => ...)`, and nested services take the `manager` as an argument.
- Don't add test-only exports, flags or `NODE_ENV === 'test'` branches.
- **Unit tests** (`tests/unit/`): no `vi.mock` for domain code (needing one means the code is in the wrong layer). Use hard-coded expected literals, AAA layout, small factory functions instead of shared `beforeEach` state, `it.each` across both sides of each threshold, and plain-English test names. No `vi.mock` remains in `tests/unit/`, so keep it that way.
- **Integration tests** (`tests/integration/`, `vitest.integration.config.js`): supertest against `createApp()` with real Postgres from docker-compose on a `*_test` DB (`rpg_test`), schema from migrations. Log in for real (cookie + CSRF, `support/auth.js`) and build data with `support/factories.js`. The only mocks allowed are the d20 module (`src/utils/dice.js` → `support/dice.js`, which always rolls 11) and WebSocket pushes. Clean data at the start, run sequentially, and keep to at most 5 logins per file (the in-memory login rate limit).
