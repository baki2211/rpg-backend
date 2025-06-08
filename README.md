# RPG Backend

This is the backend for the RPG application, built using Node.js, Express.js, TypeScript, PostgreSQL, and TypeORM. The app supports user authentication, role-based access, and a PostgreSQL database for data storage.

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
DATABASE_URL=postgres://<username>:<password>@<host>:<port>/<database>
JWT_SECRET=your_secret_key
```

Replace `<username>`, `<password>`, `<host>`, `<port>`, and `<database>` with your PostgreSQL database credentials.

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
This project has a `docker-compose.yml` for a quick start. Run:

`docker compose create`

Go into data-source.js and change `synchronize` to `true`

run the container and let the db sync. 

Set  `synchronize` back to `false`

It will try to populate the db with the `src/seed.js` at first start with some Admin and normal user, a map and a location to avoid fetching error.

If it fails or prefer manual, comment the last line in `Dockerfile` and launch it manual with:

`docker compose exec app node src/jobs/seed.js`

## Database Management

### Update the Schema
If there are changes to the TypeORM entities, generate a new migration:
```bash
npx typeorm migration:generate ./src/migrations/<MigrationName> -d ./dist/data-source.js
```

### Run Migrations
To apply the latest migrations to your database:
```bash
npx typeorm migration:run -d ./dist/data-source.js
```

### Revert Migrations
To undo the last applied migration:
```bash
npx typeorm migration:revert -d ./dist/data-source.js
```

---

## Testing

### Run Unit Tests
This project uses Jest for unit testing. To run the tests:
```bash
npm test
```

### Watch Mode
Run tests in watch mode for continuous testing during development:
```bash
npm run test:watch
```

---

## Deployment

### 1. Build the Project
Before deploying, compile the TypeScript code to JavaScript:
```bash
npm run build
```

### 2. Start the Application in Production Mode
Run the compiled code using Node.js:
```bash
npm start
```

### 3. Environment Variables
Ensure the `.env` file is correctly configured for the production environment.

---

## Available Commands

| Command                             | Description                                            |
|-------------------------------------|--------------------------------------------------------|
| `npm run dev`                       | Start the development server                          |
| `npm run build`                     | Compile TypeScript to JavaScript                      |
| `npm start`                         | Start the server in production mode                   |
| `npx typeorm migration:generate`    | Generate a new migration                              |
| `npx typeorm migration:run`         | Apply migrations to the database                      |
| `npx typeorm migration:revert`      | Revert the last migration                             |
| `npm test`                          | Run unit tests                                        |
| `npm run test:watch`                | Run tests in watch mode                               |

---

## Folder Structure

```
├── src
│   ├── controllers       # Route handlers
│   ├── middleware        # Middleware functions
│   ├── migrations        # Database migrations
│   ├── models            # TypeORM entities
│   ├── routes            # API routes
│   ├── services          # Business logic
│   ├── utils             # Utility functions
│   ├── index.ts          # Entry point
├── tests                 # Unit tests
├── .env                  # Environment variables
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
