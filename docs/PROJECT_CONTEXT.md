# RPG Backend (Arcane Realms)

> Node.js + Express backend for a browser-based tabletop-style RPG. Serves character/skill/combat data, hosts realtime chat (WebSocket) and presence (SSE), and gives masters/admins a session and event control surface.

## Stack

- **Language / runtime:** JavaScript (ESM), Node 20+ (Dockerfile `node:20`, CI Node 20 and 22), `"type": "module"`, no build step
- **Framework:** Express 5
- **ORM / DB:** TypeORM 1.0 over PostgreSQL 12 (entities defined as `EntitySchema` in `src/models/`)
- **Realtime:** native `ws` WebSocket for chat (`/ws/chat`); presence over SSE (`/api/presence/events`)
- **Auth:** JWT (HS256, 1h expiry) carried in `httpOnly` cookie; double-submit `csrfToken` cookie + `X-CSRF-Token` header on mutating requests; bcrypt for password hashing
- **Tests:** Vitest — unit (`tests/unit/`, pure `src/domain/` rules) and integration (`tests/integration/`, supertest + real Postgres on `rpg_test`)
- **CI:** GitHub Actions — unit suite on Node 20/22, integration suite against a `postgres:12` service

## Repo Shape

```
src/
  index.js              # entry: env, create app/server, wire WS upgrade, start, install shutdown
  app.js                # Express app builder: middleware + all /api/* mounts + static + errorHandler
  lifecycle.js          # startServer (DB init, monitors, jobs, listen) + installShutdownHandlers
  data-source.js        # TypeORM DataSource (pg pool, entity list)
  controllers/          # thin route handlers
  routes/               # express routers, one per domain
  domain/               # pure game rules (character, chat, combat, skills) + roles.js: no I/O
  services/             # load → domain → persist shells (CombatService, SkillEngine, etc.)
  models/               # TypeORM EntitySchema definitions
  middleware/           # auth, rate limit, validation, compression, query monitor
  websockets/           # ChatWebSocket, PresenceWebSocket, upgradeHandler
  jobs/                 # seed.js, sessionExpiration, memoryCleanup
  utils/                # logger, auditLogger, memoryManager, dbHealthMonitor, caches
  migrations/           # TypeORM migrations, schema and data (see database.md)
scripts/                # initialize-combat-constants.js, run-migration.js
tests/unit/             # Vitest unit tests (domain rules, pure utils)
tests/integration/      # supertest + Postgres scenarios (support/ = harness)
uploads/                # user-uploaded character/map images (served at /uploads)
docker-compose.yml      # app + postgres:12
```

## Entry Points

- `src/index.js` — thin entry point: loads env, builds the app, creates the HTTP server, wires the WS upgrade handler at `/ws/chat`, calls `startServer()` / `installShutdownHandlers()`. The actual work lives in `src/app.js` (Express + `/api/*` mounts), `src/lifecycle.js` (DB init, monitors, jobs, listen, graceful shutdown), and `src/websockets/upgradeHandler.js` (JWT auth + dynamic connection budget).
- `src/data-source.js` — TypeORM `AppDataSource`. `synchronize` only when `NODE_ENV=development` (override with `DB_SYNC`); everywhere else schema comes from `src/migrations/`.
- `src/jobs/seed.js` — initial DB seed (admin/user/map/location) — run via `npm run seed` or `docker compose exec app node src/jobs/seed.js`.

## Key Concepts

- **Session-Event lifecycle** — A `Session` at a `Location` is either "Free Role" (default) or "Event" (`isEvent=true`, `eventId` set). Creating an event mutates the existing free-role session in place; closing the event reverts it. See `EventService` and the `Session*Service` split.
- **Skill system** — Skills belong to a `SkillBranch` and `SkillType` and scale off up to three character stats (`scalingStats`). Output = impact × (skill rank + branch rank multipliers) × d20 outcome; ranks come from use counts. `SkillEngine` is a thin shell over `src/domain/skills/`; tunable tables come from DB rows via `staticDataCache.getSkillRules()`. Full rules: `game_design.md`.
- **Combat** — Turn-based `CombatRound` with `CombatAction`s submitted per character. Split across `CombatService` (round lifecycle), `CombatActionService` (submission, via `TargetResolutionService` + `SkillExecutionService`), and `CombatResolutionService` (clash detection + resolution, via `src/domain/combat/{roundClashes,clashTable}.js`). `PvPService` / `PvPResolutionService` serve `/pvp/resolve` and the `/skills/use` clash path. The d20 is rolled once per side at the request edge (`utils/dice.js`).
- **Roles** — `user`, `staffer`, `master`, `admin`. Masters/admins run events, sessions, combat rounds and the wiki (`requireRole(MASTER_OR_ADMIN_ROLES)`, `src/domain/roles.js`). Every `/api/sessions` write is master/admin only; players join a location's session implicitly.
- **Realtime** — Chat WS at `/ws/chat`, authenticated and connection-capped by memory pressure (15 → 12 → 8) in `websockets/upgradeHandler.js`. Presence is SSE (`routes/presenceRoutes.js`).
- **Transactions** — each business operation (chat post, combat submit, skill use, acquire skill, activate character) runs in one transaction, locking rows via `utils/rowLocks.js` (users → characters by id → skill rows).

## How To Get Productive

1. Read [`setup.md`](setup.md) to get the app and DB running.
2. Read [`architecture.md`](architecture.md) for the request lifecycle and where business logic lives.
3. Read [`dev_rulebook.md`](dev_rulebook.md) before writing code or tests.
4. Use [`DOCUMENTATION_INDEX.md`](DOCUMENTATION_INDEX.md) to jump to API, DB, game rules, deployment, or known issues.

## Hard Rules

- Do not turn `synchronize` on outside dev. It is on only when `NODE_ENV=development` (override with `DB_SYNC=true|false`). Schema changes outside dev ship via migrations in `src/migrations/`.
- Column names in DB are camelCase (`"userId"`, `"createdAt"`) — always quote in hand-written SQL.
- Never bypass `authenticateToken` / `requireRole` on routes that touch character or session state.
- `JWT_SECRET` must be set; the server refuses to start without it (`src/index.js`).
- Game values aren't final: refactors keep current numbers; rule questions go in `game_design_gaps.md`.
- Keep `AuditLogger` calls; they are observable security/support events.
