# RPG Backend

This is the backend for the RPG application, built using Node.js (plain JavaScript ESM, no build step), Express 5, PostgreSQL, and TypeORM 1.0. The app supports user authentication, role-based access, and a PostgreSQL database for data storage.

> **For agents and new contributors:** start at [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md), then use [`docs/DOCUMENTATION_INDEX.md`](docs/DOCUMENTATION_INDEX.md) to navigate. The `docs/` catalog is gitignored (local only) and goes into more depth than this README.

## Session-Event Lifecycle

The system now features a unified Session-Event lifecycle that seamlessly integrates event management with session management:

### Event Creation
When an event is created:
- **Existing Free Role Session** → **Event Role Session** (`isEvent = true`)
- The session name changes from "Free Role - Location X" to "Event: [Event Title]"
- The session becomes linked to the event via `eventId`

### Event Closure
When an event is closed:
- **Event Role Session** → **Free Role Session** (`isEvent = false`)
- The session name changes back to "Free Role - Location X"
- The `eventId` link is removed

### Role-Based Session Management
Session actions are now role-based:
- **Master/Admin Users**: Can freeze/unfreeze, close/open, and go to sessions
- **Regular Users**: Can only "Go Here" to visit sessions

### Event Management Actions
Events now have the same management capabilities as sessions:
- **Freeze Event**: Freezes the underlying session and saves chat state
- **Unfreeze Event**: Unfreezes the session and restores chat state
- **Close Event**: Closes the event and reverts session to free roleplay

### Visual Indicators
- **Event Sessions**: Green left border with event badge showing event title
- **Free Role Sessions**: Blue left border with free role badge
- **Role Notice**: Users see their permission level clearly indicated

This unified approach ensures that events and sessions work together seamlessly, providing masters with comprehensive control while maintaining clear boundaries for regular users.

## Features

- User authentication and authorization
- Character creation and management
- Dynamic chat system with skill integration
- Session management with role-based permissions
- Event management with automatic session transformation
- Skill system with usage tracking and rank progression
- Combat rounds with action resolution
- Master panel with comprehensive oversight tools

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- [Node.js](https://nodejs.org/) (v20 or higher — Docker uses `node:20`, CI uses Node 22)
- [npm](https://www.npmjs.com/)
- [PostgreSQL](https://www.postgresql.org/) (v12 or higher — Docker uses `postgres:12`)

---

## Project Setup

### 1. Clone the repository
```bash
git clone <repository_url>
cd rpg-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env` file in the root directory and configure the following variables:
```env
NODE_ENV=development
PORT=5001

# Database (read by src/data-source.js as discrete vars, not a single URL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=rpg

JWT_SECRET=your_secret_key
```

Replace the `DB_*` values with your PostgreSQL credentials. The app does **not** read `DATABASE_URL` — `src/data-source.js` reads the five discrete `DB_*` variables above.

Optional tuning vars (all have defaults in `src/data-source.js`): `DB_POOL_SIZE`, `DB_POOL_MIN`, `DB_CONNECT_TIMEOUT`, `DB_ACQUIRE_TIMEOUT`, `DB_TIMEOUT`, `DB_IDLE_TIMEOUT`, `DB_STATEMENT_TIMEOUT`, `DB_QUERY_TIMEOUT`, `DB_SLOW_QUERY_THRESHOLD`.

Other optional vars:
- `DB_SYNC=true|false` — force TypeORM `synchronize` on/off (default: on only when `NODE_ENV=development`).
- `REDIS_URL` — use Redis for the rate-limit store; in-memory when unset.
- `CORS_ALLOWED_ORIGINS` — comma-separated origin allowlist (default: `localhost:3000`, `localhost:3001`, `https://arcanerealms.org`).
- `COOKIE_SECURE=true` — force `Secure` auth cookies outside production (e.g. dev over HTTPS).
- `RSS_BUDGET_BYTES`, `WS_MEMORY_BUDGET_MB` — memory budgets for cleanup and WebSocket connection caps (default 512MB).

See `.env-example` for the annotated template.

---

## Running the Application (2 options):

### 1 - Start the Development Server
To start the app in development mode:
```bash
npm run dev
```
The server will run on `http://localhost:<PORT>` (default is `5001`).

---
## 2 - Docker
This project has a `docker-compose.yml` for a quick start (local dev only — see the warning under Deployment).

```bash
docker compose up
```

TypeORM `synchronize` is only on when `NODE_ENV=development` (or `DB_SYNC=true`), and `docker-compose.yml` sets neither, so the schema is **not** created automatically in the container. On first boot, apply the migrations and then seed:

```bash
docker compose exec app npm run migration:run
docker compose exec app npm run seed
```

The seed creates an admin user, a normal user, a map, and a location — enough to avoid empty-state fetch errors. Read `src/jobs/seed.js` for the credentials. To seed on every container start instead, swap the `CMD` line at the bottom of the `Dockerfile` for the commented-out one.

## Database Management

This project has **no build step** — TypeORM commands run against the source files in `src/` directly. Use the `npm` scripts wired up in `package.json`; they invoke the TypeORM CLI with the correct data-source path.

### Update the Schema
`synchronize` is enabled only when `NODE_ENV=development` (override with `DB_SYNC=true|false`); every other environment changes schema only through `src/migrations/`. After editing an entity in `src/models/`, generate the migration against an **empty** `rpg_baseline` database (diffing against your dev DB comes back empty, because synchronize already applied the change):

```bash
DB_SYNC=false DB_NAME=rpg_baseline npm run migration:run
DB_SYNC=false DB_NAME=rpg_baseline npm run migration:generate -- src/migrations/<DescriptiveName>
```

Re-running generate afterwards should report "No changes in database schema were found". The full workflow, including VPS sync and rollback, is in `docs/migrations.md`.

### Run Migrations
To apply the latest migrations to your database:
```bash
npm run migration:run
```

### Revert Migrations
To undo the last applied migration:
```bash
npm run migration:revert
```

---

## Testing

Tests use [Vitest](https://vitest.dev/). Unit tests (`tests/unit/`, `vitest.config.js`) cover the pure game rules in `src/domain/` and need no database. Integration tests (`tests/integration/`, `vitest.integration.config.js`) use supertest against real Postgres, on a dedicated `rpg_test` database created and migrated automatically. CI (`.github/workflows/node.js.yml`) runs the unit suite on Node 20 and 22 and the integration suite against Postgres on every push and PR to `main`.

```bash
npm test                                   # unit tests
npm run test:integration                   # integration (docker compose up -d db first)
npm run test:all                           # both
npx vitest run tests/unit/domain/clashTable.test.js
npm run test:watch
npm run test:coverage
```

Rules for writing tests and production code are in `docs/dev_rulebook.md`.

---

## Deployment

This project runs plain JavaScript (`"type": "module"` ESM) — there is no compile step.

### 1. Start the Application in Production Mode
```bash
NODE_ENV=production npm start
```

### 2. Environment Variables
Ensure the `.env` file is correctly configured for the production environment. See the env-var list under [Project Setup](#3-set-up-environment-variables) above.

> The `docker-compose.yml` in this repo is for **local development only**. DB creds fall back to `postgres/postgres` if unset; `JWT_SECRET` must be provided via `.env` (compose refuses to start otherwise) but a dev value there is not a production-safe secret. Don't deploy this file.

---

## Available Commands

| Command                       | Description                                            |
|-------------------------------|--------------------------------------------------------|
| `npm run dev`                 | Start the development server (nodemon)                 |
| `npm start`                   | Start the server (production entrypoint)               |
| `npm run seed`                | Seed the database with initial data                    |
| `npm run migration:run`       | Apply migrations to the database                       |
| `npm run migration:revert`    | Revert the last migration                              |
| `npm run migration:generate -- <path>` | Generate a migration (see Database Management) |
| `npm test`                    | Run unit tests                                         |
| `npm run test:unit`           | Run unit tests only                                    |
| `npm run test:integration`    | Run integration tests against `rpg_test`               |
| `npm run test:all`            | Unit, then integration                                 |
| `npm run test:watch`          | Vitest in watch mode                                   |
| `npm run test:coverage`       | Run tests with v8 coverage                             |

---

## Folder Structure

```
├── src
│   ├── controllers       # Route handlers
│   ├── middleware        # Middleware functions
│   ├── models            # TypeORM entities
│   ├── routes            # API routes
│   ├── services          # Business logic
│   ├── websockets        # WebSocket handlers (chat, etc.)
│   ├── jobs              # Background jobs and seed script
│   ├── utils             # Utility functions
│   ├── migrations        # TypeORM migrations
│   ├── data-source.js    # TypeORM data source
│   ├── index.js          # Entry point (env, app, server, WS, startup, shutdown wiring)
│   ├── app.js            # Express app builder (middleware + /api/* mounts + static + errorHandler)
│   ├── lifecycle.js      # startServer + installShutdownHandlers
├── docs                  # Project documentation catalog (gitignored, local only)
├── tests                 # Vitest suites
├── uploads               # User uploads (runtime)
├── docker-compose.yml    # Local dev stack
├── package.json          # NPM configuration
```

---

## License
This project is licensed under the MIT License.

## API Documentation

The API provides endpoints for:
- User management and authentication
- Character CRUD operations
- Session and event management
- Chat and skill systems
- Combat and master tools
- Health: `GET /api/health` is the public liveness/readiness check; every `/api/health/*` sub-route (status, database, cache, memory, compression, rate limits and the cleanup/GC actions) is admin-only

For detailed API documentation, see the individual controller files in `/src/controllers/`.
