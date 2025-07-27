import { logger } from '../utils/logger.js';
import { AuditLogger } from '../utils/auditLogger.js';

/**
 * Rate limiting middleware for skill usage and combat actions
 * Prevents spam and abuse of game mechanics
 */
export class RateLimitMiddleware {
    
    // In-memory store for rate limit tracking
    static rateLimitStore = new Map();
    
    // Cleanup interval for expired entries
    static cleanupInterval = null;
    
    static {
        // Start cleanup process every 5 minutes
        this.startCleanup();
    }

    /**
     * Start the cleanup process to remove expired rate limit entries
     */
    static startCleanup() {
        if (this.cleanupInterval) return;
        
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, data] of this.rateLimitStore.entries()) {
                if (now > data.resetTime) {
                    this.rateLimitStore.delete(key);
                }
            }
        }, 5 * 60 * 1000); // 5 minutes
    }

    /**
     * Stop the cleanup process (for testing/shutdown)
     */
    static stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Create rate limiting middleware
     * @param {object} options - Rate limiting options
     * @returns {Function} Express middleware function
     */
    static createRateLimit(options = {}) {
        const defaults = {
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 10,
            keyGenerator: (req) => `${req.user?.id || req.ip}`,
            skipSuccessfulRequests: false,
            skipFailedRequests: false,
            message: 'Too many requests, please try again later'
        };
        
        const config = { ...defaults, ...options };
        
        return (req, res, next) => {
            const key = config.keyGenerator(req);
            const now = Date.now();
            
            // Get or create rate limit data for this key
            let rateLimitData = this.rateLimitStore.get(key);
            
            if (!rateLimitData || now > rateLimitData.resetTime) {
                // Initialize or reset rate limit data
                rateLimitData = {
                    count: 0,
                    resetTime: now + config.windowMs,
                    firstRequest: now
                };
                this.rateLimitStore.set(key, rateLimitData);
            }
            
            // Check if limit is exceeded
            if (rateLimitData.count >= config.maxRequests) {
                const timeUntilReset = Math.ceil((rateLimitData.resetTime - now) / 1000);
                
                logger.warn('Rate limit exceeded', {
                    key,
                    count: rateLimitData.count,
                    limit: config.maxRequests,
                    timeUntilReset,
                    url: req.originalUrl,
                    method: req.method,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                });
                
                // Log security event for rate limit exceeded
                AuditLogger.logSecurity(
                    AuditLogger.EventTypes.RATE_LIMIT_EXCEEDED,
                    req.user?.id || null,
                    req,
                    {
                        rate_limit_key: key,
                        request_count: rateLimitData.count,
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
                    resetTime: rateLimitData.resetTime
                });
            }
            
            // Increment counter and continue
            rateLimitData.count++;
            
            // Add rate limit headers
            res.set({
                'X-RateLimit-Limit': config.maxRequests,
                'X-RateLimit-Remaining': Math.max(0, config.maxRequests - rateLimitData.count),
                'X-RateLimit-Reset': rateLimitData.resetTime
            });
            
            // Store response status for potential cleanup
            const originalJson = res.json;
            res.json = function(data) {
                const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
                
                // If configured to skip successful/failed requests, adjust count
                if ((config.skipSuccessfulRequests && isSuccess) || 
                    (config.skipFailedRequests && !isSuccess)) {
                    rateLimitData.count--;
                }
                
                return originalJson.call(this, data);
            };
            
            next();
        };
    }

    /**
     * Rate limiter specifically for skill usage
     * Allows 20 skill uses per minute per user
     */
    static skillUsageLimit = this.createRateLimit({
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 20,
        keyGenerator: (req) => `skill_${req.user.id}`,
        message: 'Too many skill attempts, please wait before trying again',
        skipFailedRequests: true // Don't count failed skill attempts
    });

    /**
     * Rate limiter specifically for combat actions
     * Allows 15 combat actions per minute per user
     */
    static combatActionLimit = this.createRateLimit({
        windowMs: 60 * 1000, // 1 minute  
        maxRequests: 15,
        keyGenerator: (req) => `combat_${req.user.id}`,
        message: 'Too many combat actions, please wait before submitting more actions',
        skipFailedRequests: true // Don't count failed combat attempts
    });

    /**
     * Rate limiter for character creation/modification
     * Allows 5 character operations per 5 minutes per user
     */
    static characterOperationLimit = this.createRateLimit({
        windowMs: 5 * 60 * 1000, // 5 minutes
        maxRequests: 5,
        keyGenerator: (req) => `char_${req.user.id}`,
        message: 'Too many character operations, please wait before making more changes'
    });

    /**
     * Rate limiter for chat messages
     * Allows 30 messages per minute per user
     */
    static chatMessageLimit = this.createRateLimit({
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30,
        keyGenerator: (req) => `chat_${req.user.id}`,
        message: 'Too many chat messages, please slow down',
        skipFailedRequests: true
    });

    /**
     * General API rate limiter
     * Allows 100 requests per minute per user/IP
     */
    static generalApiLimit = this.createRateLimit({
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100,
        keyGenerator: (req) => req.user?.id ? `api_user_${req.user.id}` : `api_ip_${req.ip}`,
        message: 'API rate limit exceeded, please slow down your requests'
    });

    /**
     * Burst protection for authentication attempts
     * Allows 5 login attempts per 15 minutes per IP
     */
    static authAttemptLimit = this.createRateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
        keyGenerator: (req) => `auth_${req.ip}`,
        message: 'Too many authentication attempts, please try again later',
        skipSuccessfulRequests: true // Only count failed login attempts
    });

    /**
     * Get current rate limit status for a key
     * @param {string} key - Rate limit key
     * @returns {object|null} Rate limit status or null if not found
     */
    static getRateLimitStatus(key) {
        const data = this.rateLimitStore.get(key);
        if (!data) return null;
        
        const now = Date.now();
        if (now > data.resetTime) {
            this.rateLimitStore.delete(key);
            return null;
        }
        
        return {
            count: data.count,
            resetTime: data.resetTime,
            timeUntilReset: Math.ceil((data.resetTime - now) / 1000)
        };
    }

    /**
     * Clear rate limit for a specific key (admin function)
     * @param {string} key - Rate limit key to clear
     */
    static clearRateLimit(key) {
        return this.rateLimitStore.delete(key);
    }

    /**
     * Get all active rate limits (for monitoring)
     * @returns {Array} Array of active rate limit entries
     */
    static getActiveRateLimits() {
        const now = Date.now();
        const active = [];
        
        for (const [key, data] of this.rateLimitStore.entries()) {
            if (now <= data.resetTime) {
                active.push({
                    key,
                    count: data.count,
                    resetTime: data.resetTime,
                    timeUntilReset: Math.ceil((data.resetTime - now) / 1000)
                });
            }
        }
        
        return active;
    }
}