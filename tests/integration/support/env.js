import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Integration tests only ever run against a database whose name ends with this suffix.
// The dev database (`rpg`) can never be migrated or truncated by the harness.
const TEST_DB_SUFFIX = '_test';
const DEFAULT_TEST_DB_NAME = 'rpg_test';

function readDotEnv() {
  const file = path.join(process.cwd(), '.env');
  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
}

/**
 * Environment for the integration run.
 * Connection settings come from the shell (CI), then `.env` (the docker-compose Postgres),
 * then the compose defaults. The database name never comes from DB_NAME: it is TEST_DB_NAME
 * or `rpg_test`, and must end with `_test`.
 * RSS_BUDGET_BYTES is fixed at 8 GiB so the health status doesn't depend on the worker's real RSS
 * (memoryManager reads it once, when its module is first imported inside the test worker).
 */
export function integrationEnv() {
  const dotEnv = readDotEnv();
  const pick = (key, fallback) => process.env[key] ?? dotEnv[key] ?? fallback;
  const dbName = process.env.TEST_DB_NAME ?? DEFAULT_TEST_DB_NAME;

  assertTestDatabaseName(dbName);

  return {
    NODE_ENV: 'test',
    DB_HOST: pick('DB_HOST', 'localhost'),
    DB_PORT: pick('DB_PORT', '5432'),
    DB_USER: pick('DB_USER', 'postgres'),
    DB_PASSWORD: pick('DB_PASSWORD', 'postgres'),
    DB_NAME: dbName,
    DB_SYNC: 'false',
    JWT_SECRET: 'integration-test-jwt-secret',
    RSS_BUDGET_BYTES: '8589934592',
  };
}

export function assertTestDatabaseName(name) {
  if (typeof name !== 'string' || !name.endsWith(TEST_DB_SUFFIX)) {
    throw new Error(
      `Refusing to use database "${name}" for integration tests: the name must end with "${TEST_DB_SUFFIX}".`
    );
  }
}
