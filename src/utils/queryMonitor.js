import { logger } from './logger.js';

/**
 * Query monitoring and performance tracking utility
 * Helps identify slow queries and potential N+1 problems
 */
export class QueryMonitor {
    constructor() {
        this.isEnabled = process.env.ENABLE_QUERY_MONITORING === 'true';
        this.slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD) || 100; // ms
        this.queryStats = new Map();
        this.sessionQueries = new Map();
    }

    /**
     * Track a database query execution
     * @param {string} operation - Type of operation (find, save, update, delete)
     * @param {string} entity - Entity name
     * @param {object} options - Query options/conditions
     * @param {number} duration - Query duration in milliseconds
     * @param {string} sessionId - Optional session/request ID for grouping
     */
    trackQuery(operation, entity, options = {}, duration, sessionId = null) {
        if (!this.isEnabled) return;

        const queryKey = `${operation}:${entity}`;
        const isSlowQuery = duration > this.slowQueryThreshold;

        // Update global stats
        if (!this.queryStats.has(queryKey)) {
            this.queryStats.set(queryKey, {
                count: 0,
                totalDuration: 0,
                avgDuration: 0,
                slowQueries: 0,
                maxDuration: 0
            });
        }

        const stats = this.queryStats.get(queryKey);
        stats.count++;
        stats.totalDuration += duration;
        stats.avgDuration = Math.round(stats.totalDuration / stats.count);
        stats.maxDuration = Math.max(stats.maxDuration, duration);
        
        if (isSlowQuery) {
            stats.slowQueries++;
            logger.warn(`Slow query detected: ${queryKey} took ${duration}ms`, {
                operation,
                entity,
                duration,
                conditions: this.sanitizeConditions(options),
                sessionId
            });
        }

        // Track session-specific queries for N+1 detection
        if (sessionId) {
            if (!this.sessionQueries.has(sessionId)) {
                this.sessionQueries.set(sessionId, []);
            }
            this.sessionQueries.get(sessionId).push({
                operation,
                entity,
                duration,
                timestamp: Date.now(),
                queryKey
            });
        }

        // Log detailed info for very slow queries
        if (duration > this.slowQueryThreshold * 5) {
            logger.error(`Very slow query: ${queryKey} took ${duration}ms`, {
                operation,
                entity,
                duration,
                conditions: this.sanitizeConditions(options),
                sessionId,
                stack: new Error().stack
            });
        }
    }

    /**
     * Analyze session queries for potential N+1 problems
     * @param {string} sessionId - Session ID to analyze
     * @returns {object} Analysis results
     */
    analyzeSession(sessionId) {
        if (!this.sessionQueries.has(sessionId)) {
            return { hasN1Issues: false, analysis: 'No queries tracked for this session' };
        }

        const queries = this.sessionQueries.get(sessionId);
        const queryGroups = new Map();

        // Group similar queries
        queries.forEach(query => {
            if (!queryGroups.has(query.queryKey)) {
                queryGroups.set(query.queryKey, []);
            }
            queryGroups.get(query.queryKey).push(query);
        });

        const issues = [];
        let hasN1Issues = false;

        // Detect potential N+1 patterns
        queryGroups.forEach((groupQueries, queryKey) => {
            if (groupQueries.length > 5) {
                const timeSpan = Math.max(...groupQueries.map(q => q.timestamp)) - 
                                Math.min(...groupQueries.map(q => q.timestamp));
                
                // If more than 5 similar queries in less than 1 second, likely N+1
                if (timeSpan < 1000) {
                    hasN1Issues = true;
                    issues.push({
                        type: 'N+1_SUSPECTED',
                        queryKey,
                        count: groupQueries.length,
                        timeSpan,
                        totalDuration: groupQueries.reduce((sum, q) => sum + q.duration, 0)
                    });
                }
            }
        });

        // Clean up old sessions (keep only last 100)
        if (this.sessionQueries.size > 100) {
            const oldestSessions = Array.from(this.sessionQueries.keys()).slice(0, -100);
            oldestSessions.forEach(id => this.sessionQueries.delete(id));
        }

        return {
            hasN1Issues,
            sessionQueryCount: queries.length,
            uniqueQueryTypes: queryGroups.size,
            totalDuration: queries.reduce((sum, q) => sum + q.duration, 0),
            issues,
            analysis: issues.length > 0 ? `Found ${issues.length} potential performance issues` :
                     'No performance issues detected'
        };
    }

    /**
     * Get overall query performance statistics
     * @returns {object} Performance stats
     */
    getStats() {
        const stats = {};
        let totalQueries = 0;
        let totalSlowQueries = 0;

        this.queryStats.forEach((data, queryKey) => {
            stats[queryKey] = { ...data };
            totalQueries += data.count;
            totalSlowQueries += data.slowQueries;
        });

        return {
            totalQueries,
            totalSlowQueries,
            slowQueryPercentage: totalQueries > 0 ? 
                Math.round((totalSlowQueries / totalQueries) * 100) : 0,
            queryBreakdown: stats,
            isMonitoringEnabled: this.isEnabled,
            slowQueryThreshold: this.slowQueryThreshold
        };
    }

    /**
     * Reset all monitoring data
     */
    reset() {
        this.queryStats.clear();
        this.sessionQueries.clear();
    }

    /**
     * Create a monitoring wrapper for repository methods 
     * @param {object} repository - TypeORM repository
     * @param {string} entityName - Entity name for logging
     * @returns {object} Wrapped repository
     */
    wrapRepository(repository, entityName) {
        if (!this.isEnabled) return repository;

        const monitor = this;
        const originalMethods = ['find', 'findOne', 'save', 'update', 'delete', 'remove'];

        const wrapper = Object.create(repository);

        originalMethods.forEach(method => {
            if (typeof repository[method] === 'function') {
                wrapper[method] = async function(...args) {
                    const startTime = Date.now();
                    const sessionId = this._currentSessionId || 'default';
                    
                    try {
                        const result = await repository[method].apply(repository, args);
                        const duration = Date.now() - startTime;
                        
                        monitor.trackQuery(method, entityName, args[0], duration, sessionId);
                        return result;
                    } catch (error) {
                        const duration = Date.now() - startTime;
                        monitor.trackQuery(`${method}_ERROR`, entityName, args[0], duration, sessionId);
                        throw error;
                    }
                };
            }
        });

        return wrapper;
    }

    /**
     * Sanitize query conditions for logging (remove sensitive data)
     * @param {object} conditions - Query conditions
     * @returns {object} Sanitized conditions
     */
    sanitizeConditions(conditions) {
        if (!conditions || typeof conditions !== 'object') return conditions;

        const sanitized = { ...conditions };
        const sensitiveFields = ['password', 'token', 'secret', 'key'];
        
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });

        return sanitized;
    }
}

// Global instance
export const queryMonitor = new QueryMonitor();