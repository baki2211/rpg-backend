# API

> Map of mounted routes and WebSocket endpoints. For exact request/response shapes, read the controller file.

## Auth

All routes under `/api/*` (except auth and the public `GET /api/health` check) require `authenticateToken` (`middleware/authMiddleware.js`). The middleware reads `Cookie: token=<jwt>` only (no `Authorization: Bearer`).

Token payload: `{ id, username, role }`. Expiry: **1h**. Refresh endpoint will only issue a new token when the current one has ≤30 min remaining.

### CSRF (double-submit cookie)

All state-changing requests (`POST | PUT | PATCH | DELETE`) under `/api` must echo the `csrfToken` cookie value back as `X-CSRF-Token`. Missing/mismatched → `403`. Exempt: `/api/auth/login`, `/api/auth/register` (bootstrap — clients have no cookie yet). The `csrfToken` cookie is non-httpOnly, `SameSite=Lax`, rotated on every `/login` and `/refresh`. See `middleware/csrfMiddleware.js`.

Roles: `user` < `staffer` < `master` < `admin`. Most write paths on events, combat, characters and the wiki use `requireRole(MASTER_OR_ADMIN_ROLES)` (`src/domain/roles.js`); maps, races, health and query stats use the older `isAdmin`.

## Mount Points

All API routes are mounted under `/api` in `src/app.js`:

| Prefix | Router | Domain |
|--------|--------|--------|
| `/api/auth` | `routes/auth.js` | register, login, refresh, logout |
| `/api/user` | `routes/user.js` | profile, change password |
| `/api/admin` | `routes/admin.js` | admin dashboard guard, static-data cache reload |
| `/api/admin/query-stats` · `POST /api/admin/query-stats/reset` | inline in `src/app.js` | query monitor (admin) |
| `POST /api/admin/characters/recompute-stats` | `routes/admin.js` | recompute every character's/NPC's derived stats (reactions, speed, hp, aether) with the current rule, races and ranks; resets current HP/aether to max. Returns `{ success, total, updated }` (admin, audited) |
| `/api/admin/cache/reload` · `/api/admin/cache/reload/:entity` | `routes/admin.js` | clear + re-warm staticDataCache (admin). Entities: `Race`, `Skill`, `SkillBranch`, `SkillType`, `StatDefinition`, `Rank` |
| `/api/protected` | `routes/protected.js` | sample auth-gated routes |
| `/api/health` | `routes/healthRoutes.js` | public liveness/readiness check at `GET /api/health`; every sub-route is admin-only (see [Health](#health)) |
| `/api/maps` | `routes/map.js` | maps + map images |
| `/api/locations` | `routes/location.js` | location CRUD |
| `/api/chat` | `routes/chat.js` | chat REST surface (WS does the live work) |
| `/api/races` | `routes/race.js` | playable races |
| `/api/characters` | `routes/character.js` | PCs and NPCs, images, skills, stats |
| `/api/character-skills` | `routes/characterSkills.js` | per-character skill lookups |
| `/api/skills` | `routes/skill.js` | skill catalog, `use` |
| `/api/skill-branches` | `routes/skillBranch.js` | branches |
| `/api/skill-types` | `routes/skillType.js` | types |
| `/api/sessions` | `routes/session.js` | session CRUD, freeze, close, participants |
| `/api/pvp` | `routes/pvpRoutes.js` | PvP resolution + simulation |
| `/api/combat` | `routes/combat.js` | rounds and actions |
| `/api/events` | `routes/event.js` | event lifecycle (master/admin) |
| `/api/engine-logs` | `routes/engineLogs.js` | skill engine audit |
| `/api/stat-definitions` | `routes/statDefinition.js` | stat catalog (admin tunable) |
| `/api/combat-constants` | `routes/combatConstant.js` | combat tunables (admin) |
| `/api/mastery-tiers` | `routes/masteryTier.js` | skill mastery tiers |
| `/api/skill-validation-rules` | `routes/skillValidationRule.js` | rule engine for skill use |
| `/api/ranks` | `routes/rank.js` | rank tiers |
| `/api/wiki` | `routes/wikiRoutes.js` | wiki sections + entries |
| `/api/presence` | `routes/presenceRoutes.js` | live presence: `GET /events` (SSE), `POST /location`, `POST /heartbeat` |


## Health

`routes/healthRoutes.js` is mounted at `/api/health`, behind the general `/api` rate limit and CSRF check like every other router.

- `GET /api/health` is the only public route: memory, connections, DB pool, cache and compression summary; `503` when overloaded. Extra per-IP limit of 3 requests / 5 s (`rateLimitHealthChecks`, returns the cached body or `503`).
- Everything else requires `authenticateToken` + `isAdmin` (`401` without a token, `403` for non-admins):

| Method | Path | What |
|--------|------|------|
| GET | `/api/health/status` | process, memory, CPU, WS connection counts |
| GET | `/api/health/database` | `dbHealthMonitor` report |
| GET | `/api/health/cache` | staticDataCache stats |
| GET | `/api/health/compression` | compression stats |
| GET | `/api/health/memory/status` | memory stats, cleanup job status, cache + compression stats |
| GET | `/api/health/rate-limits` | active rate-limit keys |
| POST | `/api/health/gc` | force garbage collection / alternative cleanup |
| POST | `/api/health/cleanup` | presence WS cleanup |
| POST | `/api/health/database/cleanup` | release idle DB connections |
| POST | `/api/health/cache/clear` | clear staticDataCache (body `{ entity }` optional) |
| POST | `/api/health/cache/cleanup` | drop expired cache entries |
| POST | `/api/health/compression/reset` | reset compression stats |
| POST | `/api/health/memory/cleanup` | run the memory cleanup job (can close all WS connections under emergency pressure) |
| POST | `/api/health/rate-limits/clear` | clear one rate-limit key (body `{ key }`) |

## Auth Endpoints (`/api/auth`)

- `POST /register` — `{ username, password }`. 8-char min password, 3–50 char username. Rate-limited.
- `POST /login` — `{ username, password }`. Sets `token` (httpOnly) and `csrfToken` cookies. Response body is `{ message, user }`; the JWT is **not** in the body.
- `POST /refresh` — requires `authenticateToken`. Returns 200 with `refreshed: false` if token has >30 min left; otherwise rotates `token` + `csrfToken` cookies and returns `{ message, refreshed: true, user }`. No JWT in body.
- `POST /logout` — clears both `token` and `csrfToken` cookies.

## Sessions (`/api/sessions`)

Examples (see `routes/session.js` for the full list):
- `GET /active`, `GET /closed`, `GET /logs`
- `POST /` create
- `GET /location/:locationId` and `GET /location/:locationId/participants`
- `POST /:sessionId/{freeze,unfreeze,close}`
- `POST /:sessionId/participants`, `DELETE /:sessionId/participants/:characterId`

Every write (create, participants, freeze/unfreeze/close) requires master/admin. Players join a location's session implicitly through `SessionParticipantService.ensureActiveSessionForLocation`, not through these routes.

## Events (`/api/events`)

All write paths gated by `masterOrAdmin`:
- `POST /` create event (converts the location's free-role session into an event session)
- `POST /:eventId/{close,freeze,unfreeze}`
- `GET /active/:locationId`, `GET /location/:locationId`, `GET /:eventId`, `GET /:eventId/statistics`

## Combat (`/api/combat`)

- `POST /rounds` create
- `GET /rounds/active/:locationId`, `GET /rounds/resolved/:locationId`
- `POST /rounds/:roundId/{resolve,cancel}`
- `POST /rounds/:roundId/actions` — submits a character's action (rate-limited via `RateLimitMiddleware.combatActionLimit`)
- `GET /rounds/:roundId/actions`

## Characters (`/api/characters`)

Mix of PC and NPC routes. NPC endpoints live under `/npcs/*`. Images uploaded via `multer` (`uploadMiddleware.js`) and served from `/uploads/*`. Skill acquisition is rate-limited.

## Rate Limits

`middleware/rateLimitMiddleware.js` exports per-domain limiters:
- `generalApiLimit` — applied to all `/api/*`
- `authAttemptLimit` — register / login
- `combatActionLimit` — combat action submit
- `characterOperationLimit` — character create/update/delete
- `skillUsageLimit` — skill acquire / use
- `chatMessageLimit` — chat posts
- `/api/health` has its own limiter (3 requests / 5 s per IP) inside `routes/healthRoutes.js`

## WebSockets

- `ws://<host>/ws/chat` — the only WebSocket endpoint. The JWT cookie is verified during the upgrade (`websockets/upgradeHandler.js`); any other path is dropped. Connection cap is dynamic — see [`architecture.md`](architecture.md#websocket-and-realtime).
- Presence is SSE, not WS: `GET /api/presence/events`.

## Static Files

- `GET /uploads/<filename>` — character/map images.

## Related

- [`backend.md`](backend.md) — service layer behind these routes
- [`database.md`](database.md) — entity shapes
- [`DOCUMENTATION_INDEX.md`](DOCUMENTATION_INDEX.md)
