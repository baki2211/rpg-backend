# Local Setup

> Get the API + Postgres running on your machine.

## Prerequisites

- Node.js **v20+** (Dockerfile pins `node:20`; CI runs Node 22)
- npm
- One of: local PostgreSQL **v12+**, or Docker / Docker Compose

## Option A — Docker Compose (recommended)

```bash
docker compose create   # build images, create containers
```

First-run schema bootstrap. TypeORM `synchronize` is only on when `NODE_ENV=development` (or `DB_SYNC=true`). `docker-compose.yml` sets neither, and `.env` is excluded from the image by `.dockerignore`, so the container does **not** auto-create the schema:

1. `docker compose up` — wait for the app to connect to Postgres.
2. Apply migrations: `docker compose exec app npm run migration:run`
3. Seed: `docker compose exec app npm run seed`. Alternatively, swap the `Dockerfile` `CMD` for the commented-out seed line and rebuild to seed on every start.

`seed.js` creates one admin user, one normal user, a main map, and a starter location — enough to avoid fetch errors on first frontend load.

Service ports (from `docker-compose.yml`):
- API on `:5001`
- Postgres on `:5432` (user `postgres`, pass `postgres`, db `rpg`)

## Option B — Native (no Docker)

```bash
git clone <repository_url>
cd rpg-backend
npm install
```

Create `.env` in the repo root:

```env
NODE_ENV=development
PORT=5001
JWT_SECRET=replace_me_with_a_long_random_string

# DB connection (defaults match the Docker setup)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=rpg
```

`DATABASE_URL` is not read; use the discrete `DB_*` vars. `.env-example` lists everything. The server
refuses to start without `JWT_SECRET`.

Start the dev server:

```bash
npm run dev     # nodemon on src/index.js
```

Seed if you want test users/map/location:

```bash
npm run seed
```

## Optional env vars

Defaults are usually fine; tune for prod or low-memory hosts.

| Var | Default | Purpose |
|-----|---------|---------|
| `DB_POOL_SIZE` | 10 | Max pg connections |
| `DB_POOL_MIN` | 2 | Min pg connections |
| `DB_IDLE_TIMEOUT` | 30000 | ms before idle conn drops |
| `DB_CONNECT_TIMEOUT` | 10000 | ms to acquire a conn |
| `DB_STATEMENT_TIMEOUT` | 30000 | ms per statement |
| `DB_QUERY_TIMEOUT` | 30000 | ms per query |
| `DB_SLOW_QUERY_THRESHOLD` | 1000 | ms — log queries slower than this |
| `REDIS_URL` | _(unset)_ | If set, rate limiter uses Redis instead of in-memory. Required for multi-instance deployments. Falls back to in-memory if connection fails. |
| `WS_MEMORY_BUDGET_MB` | 512 | Memory budget the chat WS upgrade uses to scale its dynamic connection cap. Raise on hosts with more RAM. |
| `RSS_BUDGET_BYTES` | 536870912 | Memory budget for `memoryManager` (warning/critical/emergency at 68/78/88%). |
| `COOKIE_SECURE` | _(unset)_ | `true` forces `Secure` cookies outside production (dev over HTTPS). |
| `DB_SYNC` | _(unset)_ | `true`/`false` overrides the `NODE_ENV=development` synchronize default. |
| `CORS_ALLOWED_ORIGINS` | _(unset → dev default)_ | Comma-separated allowlist of origins permitted to call the API. Default when unset: `http://localhost:3000,http://localhost:3001/ Set explicitly in staging/prod. |

## Verifying It's Up

- API: `curl http://localhost:5001/api/health` (see `routes/healthRoutes.js`). This is the only public health route; the `/api/health/*` sub-routes are admin-only (see [api.md](api.md#health)).
- WS chat: connect to `ws://localhost:5001/ws/chat` with a valid JWT cookie
- Default seeded users come from `src/jobs/seed.js` — read that file for the actual credentials (do not assume from older docs).

## Tests

`npm test` runs the unit suite (no DB). `npm run test:integration` needs `docker compose up -d db` and
uses its own `rpg_test` database. See [`testing.md`](testing.md).

## Related

- [`database.md`](database.md) — schema management
- [`DOCUMENTATION_INDEX.md`](DOCUMENTATION_INDEX.md)
