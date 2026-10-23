import { AppDataSource } from '../../../src/data-source.js';
import staticDataCache from '../../../src/utils/staticDataCache.js';
import { assertTestDatabaseName } from './env.js';

/**
 * Empty every entity table and reset the id sequences. Called at the start of each test.
 * Also empties the in-process static data cache, which would otherwise serve rows from the previous test.
 */
export async function resetDatabase() {
  const [{ name }] = await AppDataSource.query('SELECT current_database() AS name');
  assertTestDatabaseName(name);

  const tables = AppDataSource.entityMetadatas.map((metadata) => `"${metadata.tableName}"`).join(', ');
  await AppDataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);

  staticDataCache.clear();
}

/**
 * Read rows with a plain SQL query, outside any transaction the app used.
 * Column names are camelCase in this schema, so quote them: `SELECT "userId" FROM ...`.
 */
export function query(sql, params = []) {
  return AppDataSource.query(sql, params);
}

/**
 * Resolves once some backend of this database waits on a lock (a row lock, or a transaction a
 * conflicting insert waits on). Use it to hold a request at a known point: open a transaction that
 * holds the conflicting row, fire the request, await this, then commit.
 */
export async function untilABackendWaitsOnALock() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const [{ waiting }] = await query(
      `SELECT count(*)::int AS waiting FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock'`
    );
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('No backend ended up waiting on a lock');
}
