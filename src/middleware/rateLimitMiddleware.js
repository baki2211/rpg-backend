import { logger } from '../utils/logger.js';
import { AuditLogger } from '../utils/auditLogger.js';
import { InMemoryRateLimitStore, createRateLimitStore } from './rateLimitStores.js';

/**
 * Rate limiting middleware for skill usage and combat actions.
 *
 * The store backend is pluggable: in-memory by default, Redis when REDIS_URL
 * is set. The store is initialized synchronously to an in-memory instance so
 * the static middleware factories below work at import time; if Redis is
 * configured, `initRateLimitStore()` swaps it in after the connection opens.
 * That call happens during app startup in src/index.js.
 */
export class RateLimitMiddleware {

    static store = new InMemoryRateLimitStore();

    /**
     * Swap the active store. Called once during startup so REDIS_URL takes
     * effect; if Redis init fails, the in-memory store stays.
     */
    static async initStore() {
        const newStore = await createRateLimitStore();
        if (newStore !== this.store) {
            await this.store.stop?.();
            this.store = newStore;
        }
    }

    static async stopCleanup() {
        await this.store.stop?.();
    }

    /**
     * Create rate limiting middleware
     * @param {object} options - Rate limiting options
     * @returns {Function} Express middleware function
     */
    static createRateLimit(options = {}) {
        const defaults = {
            windowMs: 60 * 1000,
            maxRequests: 10,
            keyGenerator: (req) => `${req.user?.id || req.ip}`,
            skipSuccessfulRequests: false,
            skipFailedRequests: false,
            message: 'Too many requests, please try again later'
        };

        const config = { ...defaults, ...options };

        return async (req, res, next) => {
            try {
                const key = config.keyGenerator(req);
                const { count, resetTime } = await this.store.hit(key, config.windowMs);
                const now = Date.now();

                if (count > config.maxRequests) {
                    const timeUntilReset = Math.ceil((resetTime - now) / 1000);

                    logger.warn('Rate limit exceeded', {
                        key,
                        count,
                        limit: config.maxRequests,
                        timeUntilReset,
                        url: req.originalUrl,
                        method: req.method,
                        userAgent: req.get('User-Agent'),
                        ip: req.ip
                    });

                    AuditLogger.logSecurity(
                        AuditLogger.EventTypes.RATE_LIMIT_EXCEEDED,
                        req.user?.id || null,
                        req,
                        {
                            rate_limit_key: key,
                            request_count: count,
                            limit: config.maxRequests,
                            window_ms: config.windowMs,
                            endpoint: req.originalUrl,
                            method: req.method
                        },
                        AuditLogger.RiskLevels.MEDIUM
                    );

                    return res.status(429).json({
                        error: config.message,
                        retryAfter: timeUntilReset,
                        limit: config.maxRequests,
                        remaining: 0,
                        resetTime
                    });
                }

                res.set({
                    'X-RateLimit-Limit': config.maxRequests,
                    'X-RateLimit-Remaining': Math.max(0, config.maxRequests - count),
                    'X-RateLimit-Reset': resetTime
                });

                // Optionally undo the hit based on response status.
                if (config.skipSuccessfulRequests || config.skipFailedRequests) {
                    const store = this.store;
                    const originalJson = res.json;
                    res.json = function (data) {
                        const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
                        if ((config.skipSuccessfulRequests && isSuccess) ||
                            (config.skipFailedRequests && !isSuccess)) {
                            // Fire-and-forget — we don't want to delay the response.
                            store.decrement(key).catch((err) => {
                                logger.warn('Rate limiter decrement failed', { error: err.message });
                            });
                        }
                        return originalJson.call(this, data);
                    };
                }

                next();
            } catch (error) {
                // Fail open: if the store is unreachable, let the request through
                // rather than 500ing every API call.
                logger.error('Rate limiter error, allowing request', { error: error.message });
                next();
            }
        };
    }

    static skillUsageLimit = this.createRateLimit({
        windowMs: 60 * 1000,
        maxRequests: 20,
        keyGenerator: (req) => `skill_${req.user.id}`,
        message: 'Too many skill attempts, please wait before trying again',
        skipFailedRequests: true
    });

    static combatActionLimit = this.createRateLimit({
        windowMs: 60 * 1000,
        maxRequests: 15,
        keyGenerator: (req) => `combat_${req.user.id}`,
        message: 'Too many combat actions, please wait before submitting more actions',
        skipFailedRequests: true
    });

    static characterOperationLimit = this.createRateLimit({
        windowMs: 5 * 60 * 1000,
        maxRequests: 5,
        keyGenerator: (req) => `char_${req.user.id}`,
        message: 'Too many character operations, please wait before making more changes'
    });

    static chatMessageLimit = this.createRateLimit({
        windowMs: 60 * 1000,
        maxRequests: 30,
        keyGenerator: (req) => `chat_${req.user.id}`,
        message: 'Too many chat messages, please slow down',
        skipFailedRequests: true
    });

    static generalApiLimit = this.createRateLimit({
        windowMs: 60 * 1000,
        maxRequests: 100,
        keyGenerator: (req) => req.user?.id ? `api_user_${req.user.id}` : `api_ip_${req.ip}`,
        message: 'API rate limit exceeded, please slow down your requests'
    });

    static authAttemptLimit = this.createRateLimit({
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
        keyGenerator: (req) => `auth_${req.ip}`,
        message: 'Too many authentication attempts, please try again later',
        skipSuccessfulRequests: true
    });

    static async getRateLimitStatus(key) {
        return this.store.getStatus(key);
    }

    static async clearRateLimit(key) {
        return this.store.clear(key);
    }

    static async getActiveRateLimits() {
        return this.store.getActive();
    }
}
