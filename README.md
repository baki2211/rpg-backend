# RPG Backend

This is the backend for the RPG application, built using Node.js, Express.js, TypeScript, PostgreSQL, and TypeORM. The app supports user authentication, role-based access, and a PostgreSQL database for data storage.

> **For agents and new contributors:** start at [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md), then use [`docs/DOCUMENTATION_INDEX.md`](docs/DOCUMENTATION_INDEX.md) to navigate. Parts of this README are out of date — the `docs/` catalog is the current source of truth.

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

- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/)
- [PostgreSQL](https://www.postgresql.org/) (v12 or higher)
- [TypeORM CLI](https://typeorm.io/)

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

On first boot, TypeORM's `synchronize` is **on by default** in non-production (`src/data-source.js:38`), so the schema is created automatically from the entity files. No manual toggling is required.

The container will try to populate the db with `src/jobs/seed.js` at first start (an admin user, a normal user, a map, and a location — enough to avoid empty-state fetch errors).

If seeding fails or you prefer to run it manually, comment out the last line in `Dockerfile` and run:

```bash
docker compose exec app node src/jobs/seed.js
```

## Database Management

This project has **no build step** — TypeORM commands run against the source files in `src/` directly. Use the `npm` scripts wired up in `package.json`; they invoke the TypeORM CLI with the correct data-source path.

### Update the Schema
If there are changes to the TypeORM entities, generate a new migration:
```bash
npx typeorm-ts-node-esm migration:generate ./src/migrations/<MigrationName> -d src/data-source.js
```
> Note: `src/migrations/` does not exist yet. The first generated migration will create it. See [`docs/fix_plan.md`](docs/fix_plan.md) §3.2.

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

There are **no tests yet**. `npm test` is a placeholder that prints `"No tests yet"` and exits 0 — do not treat it as a CI gate. Wiring up a real test runner is tracked in [`docs/fix_plan.md`](docs/fix_plan.md) §5.1.

---

## Deployment

This project runs plain JavaScript (`"type": "module"` ESM) — there is no compile step.

### 1. Start the Application in Production Mode
```bash
NODE_ENV=production npm start
```

### 2. Environment Variables
Ensure the `.env` file is correctly configured for the production environment. See the env-var list under [Project Setup](#3-set-up-environment-variables) above.

> The `docker-compose.yml` in this repo is for **local development only** — its default credentials (`postgres/postgres`, `JWT_SECRET=your_jwt_secret_here`) must not be used in production.

---

## Available Commands

| Command                       | Description                                            |
|-------------------------------|--------------------------------------------------------|
| `npm run dev`                 | Start the development server (nodemon)                 |
| `npm start`                   | Start the server (production entrypoint)               |
| `npm run seed`                | Seed the database with initial data                    |
| `npm run migration:run`       | Apply migrations to the database                       |
| `npm run migration:revert`    | Revert the last migration                              |
| `npm test`                    | Placeholder — no tests are wired up yet                |

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
│   ├── data-source.js    # TypeORM data source
│   ├── index.js          # Entry point (env, app, server, WS, startup, shutdown wiring)
│   ├── app.js            # Express app builder (middleware + /api/* mounts + static + errorHandler)
│   ├── lifecycle.js      # startServer + installShutdownHandlers
├── supabase              # Supabase SQL mirror (hand-maintained)
├── docs                  # Project documentation catalog
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

For detailed API documentation, see the individual controller files in `/src/controllers/`.
