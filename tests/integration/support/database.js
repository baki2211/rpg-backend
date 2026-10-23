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
