import { logger } from '../utils/logger.js';

/**
 * Rate-limit store interface (all methods are async):
 *
 *   hit(key, windowMs) -> { count, resetTime }
 *     Atomically increment the counter for `key`. If no window is active, start
 *     a new one of length `windowMs`. Returns the count after the increment and
 *     the absolute reset time (ms epoch).
 *
 *   decrement(key) -> void
 *     Undo a hit (used by skipSuccessfulRequests / skipFailedRequests).
 *
 *   getStatus(key) -> { count, resetTime, timeUntilReset } | null
 *
 *   clear(key) -> boolean       remove this key; returns whether it existed.
 *
 *   getActive() -> Array<{ key, count, resetTime, timeUntilReset }>
 *     Used by the monitoring endpoint. May be expensive on Redis (KEYS scan).
 *
 *   stop() -> void              release timers / connections on shutdown.
 */

const REDIS_KEY_PREFIX = 'rl:';

export class InMemoryRateLimitStore {
  constructor() {
    this.map = new Map();
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.map.entries()) {
        if (now > data.resetTime) this.map.delete(key);
      }
    }, 5 * 60 * 1000);
  }

  async hit(key, windowMs) {
    const now = Date.now();
    let entry = this.map.get(key);
    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      this.map.set(key, entry);
    }
    entry.count++;
    return { count: entry.count, resetTime: entry.resetTime };
  }

  async decrement(key) {
    const entry = this.map.get(key);
    if (entry && entry.count > 0) entry.count--;
  }

  async getStatus(key) {
    const data = this.map.get(key);
    if (!data) return null;
    const now = Date.now();
    if (now > data.resetTime) {
      this.map.delete(key);
      return null;
    }
    return {
      count: data.count,
      resetTime: data.resetTime,
      timeUntilReset: Math.ceil((data.resetTime - now) / 1000)
    };
  }

  async clear(key) {
    return this.map.delete(key);
  }

  async getActive() {
    const now = Date.now();
    const out = [];
    for (const [key, data] of this.map.entries()) {
      if (now <= data.resetTime) {
        out.push({
          key,
          count: data.count,
          resetTime: data.resetTime,
          timeUntilReset: Math.ceil((data.resetTime - now) / 1000)
        });
      }
    }
    return out;
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export class RedisRateLimitStore {
  constructor(redis) {
    this.redis = redis;
  }

  _k(key) {
    return `${REDIS_KEY_PREFIX}${key}`;
  }

  async hit(key, windowMs) {
    const fullKey = this._k(key);
    // INCR is atomic. On the first hit of a window we set PEXPIRE so the
    // key disappears after the window closes. PTTL gives us the remaining
    // time so we can compute resetTime without storing it separately.
    const count = await this.redis.incr(fullKey);
    if (count === 1) {
      await this.redis.pexpire(fullKey, windowMs);
    }
    const ttl = await this.redis.pttl(fullKey);
    const resetTime = Date.now() + (ttl > 0 ? ttl : windowMs);
    return { count, resetTime };
  }

  async decrement(key) {
    const fullKey = this._k(key);
    const count = await this.redis.decr(fullKey);
    // Don't leave a -1 lying around if every hit in the window was skipped.
    if (count <= 0) await this.redis.del(fullKey);
  }

  async getStatus(key) {
    const fullKey = this._k(key);
    const [countStr, ttl] = await Promise.all([
      this.redis.get(fullKey),
      this.redis.pttl(fullKey)
    ]);
    if (countStr === null || ttl < 0) return null;
    const count = Number(countStr);
    const resetTime = Date.now() + ttl;
    return {
      count,
      resetTime,
      timeUntilReset: Math.ceil(ttl / 1000)
    };
  }

  async clear(key) {
    const removed = await this.redis.del(this._k(key));
    return removed > 0;
  }

  async getActive() {
    // KEYS is O(N) over the whole keyspace. Acceptable here because the
    // monitoring endpoint is admin-gated and called rarely. SCAN would be
    // strictly better but adds complexity we don't need today.
    const keys = await this.redis.keys(`${REDIS_KEY_PREFIX}*`);
    if (keys.length === 0) return [];

    const pipeline = this.redis.pipeline();
    for (const k of keys) {
      pipeline.get(k);
      pipeline.pttl(k);
    }
    const results = await pipeline.exec();
    const now = Date.now();
    const out = [];
    for (let i = 0; i < keys.length; i++) {
      const countStr = results[i * 2]?.[1];
      const ttl = results[i * 2 + 1]?.[1];
      if (countStr === null || ttl < 0) continue;
      out.push({
        key: keys[i].slice(REDIS_KEY_PREFIX.length),
        count: Number(countStr),
        resetTime: now + ttl,
        timeUntilReset: Math.ceil(ttl / 1000)
      });
    }
    return out;
  }

  async stop() {
    try {
      await this.redis.quit();
    } catch (error) {
      logger.warn('Redis quit failed', { error: error.message });
    }
  }
}

/**
 * Build the active store based on env. Falls back to in-memory when REDIS_URL
 * is unset or the connection fails (we don't want to hard-crash on a bad
 * Redis URL — rate limiting degrades to per-instance, which is what we had
 * before).
 */
export async function createRateLimitStore() {
  const url = process.env.REDIS_URL;
  if (!url) {
    logger.info('Rate limiter using in-memory store (REDIS_URL not set)');
    return new InMemoryRateLimitStore();
  }

  try {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false
    });
    redis.on('error', (err) => {
      logger.error('Redis rate-limit store error', { error: err.message });
    });
    await redis.connect();
    logger.info('Rate limiter using Redis store', { url: url.replace(/:[^:@/]+@/, ':***@') });
    return new RedisRateLimitStore(redis);
  } catch (error) {
    logger.error('Failed to initialize Redis rate-limit store, falling back to in-memory', {
      error: error.message
    });
    return new InMemoryRateLimitStore();
  }
}
