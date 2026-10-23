import pg from 'pg';
import { integrationEnv, assertTestDatabaseName } from './env.js';

// Runs once, in the main vitest process, before any integration file:
// 1. creates the test database if it is missing,
// 2. applies src/migrations to it (synchronize stays off, so the schema is exactly what migrations build),
// 3. fails if the models and the migrated schema disagree.
export default async function setup() {
  const env = integrationEnv();
  Object.assign(process.env, env);

  await createDatabaseIfMissing(env);

  const { AppDataSource } = await import('../../../src/data-source.js');
  assertTestDatabaseName(AppDataSource.options.database);
  if (AppDataSource.options.synchronize) {
    throw new Error('Integration tests need DB_SYNC=false so the schema comes from migrations only.');
  }

  await AppDataSource.initialize();
  try {
    await AppDataSource.runMigrations({ transaction: 'each' });

    const pending = await AppDataSource.driver.createSchemaBuilder().log();
    if (pending.upQueries.length > 0) {
      const statements = pending.upQueries.map((query) => `  ${query.query}`).join('\n');
      throw new Error(
        `The models in src/models/ don't match the schema built by src/migrations/. ` +
        `Generate a migration (see CLAUDE.md). Missing statements:\n${statements}`
      );
    }
  } finally {
    await AppDataSource.destroy();
  }
}

async function createDatabaseIfMissing(env) {
  const client = new pg.Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: 'postgres',
  });

  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Postgres is not reachable at ${env.DB_HOST}:${env.DB_PORT} (${error.message}). ` +
      'Start it with `docker compose up -d db`.'
    );
  }

  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [env.DB_NAME]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${env.DB_NAME}"`);
    }
  } finally {
    await client.end();
  }
}
