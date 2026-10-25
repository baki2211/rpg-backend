import { AppDataSource } from '../data-source.js';
import { logger } from './logger.js';

/**
 * Run `fn` only if we can acquire a Postgres session-level advisory lock for
 * `lockKey`. Used to ensure background jobs run on exactly one instance when
 * scaled horizontally. If the lock is held elsewhere, `fn` is skipped.
 *
 * Each job picks its own stable integer (see JOB_LOCK_KEYS) so they don't
 * collide. We use session-level locks (not xact) because we hold them across
 * the duration of the job and release manually.
 */
export async function withAdvisoryLock(lockKey, fn) {
  if (!AppDataSource.isInitialized) {
    return { acquired: false, result: undefined };
  }

  const acquireResult = await AppDataSource.query(
    'SELECT pg_try_advisory_lock($1) AS acquired',
    [lockKey]
  );
  const acquired = acquireResult?.[0]?.acquired === true;

  if (!acquired) {
    return { acquired: false, result: undefined };
  }

  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    try {
      await AppDataSource.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    } catch (error) {
      logger.error('Failed to release advisory lock', {
        lockKey,
        error: error.message
      });
    }
  }
}

// Pick distinct, stable integers per job. Keep these unique forever — changing
// a value is equivalent to releasing the lock for everyone holding the old one.
export const JOB_LOCK_KEYS = {
  SESSION_EXPIRATION: 7100001,
  MEMORY_CLEANUP: 7100002
};

// Namespaces for transaction-scoped locks keyed on a name. These use Postgres' two-key form
// (namespace, hashtext(name)), whose key space never overlaps the single-key JOB_LOCK_KEYS.
// Keep the values unique and stable for the same reason.
export const XACT_LOCK_NAMESPACES = {
  UPLOADED_FILE: 7200001
};

/**
 * Hold a Postgres advisory lock on `name` (within `namespace`) until the transaction of `manager`
 * commits or rolls back. Waits while another transaction holds the same lock. Two names that hash
 * alike only share a lock, which serializes them a little more than needed and is otherwise harmless.
 * @param {import('typeorm').EntityManager} manager - A transaction's manager
 * @param {number} namespace - One of XACT_LOCK_NAMESPACES
 * @param {string} name
 */
export async function lockNameUntilCommit(manager, namespace, name) {
  await manager.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [namespace, name]);
}
