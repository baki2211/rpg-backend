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
