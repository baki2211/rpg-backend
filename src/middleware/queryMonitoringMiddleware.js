import { queryMonitor } from '../utils/queryMonitor.js';
import { logger } from '../utils/logger.js';

/**
 * Express middleware to enable query monitoring per request
 * Generates unique session IDs and provides performance analysis
 */
export const queryMonitoringMiddleware = (req, res, next) => {
    if (!process.env.ENABLE_QUERY_MONITORING) {
        return next();
    }

    // Generate unique session ID for this request
    const sessionId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.querySessionId = sessionId;

    // Track request start time
    const requestStart = Date.now();

    // Override res.end to analyze queries when request completes
    const originalEnd = res.end;
    res.end = function(...args) {
        const requestDuration = Date.now() - requestStart;
        
        // Analyze session queries for potential issues
        const analysis = queryMonitor.analyzeSession(sessionId);
        
        // Log request performance summary
        if (analysis.hasN1Issues || requestDuration > 1000 || analysis.sessionQueryCount > 10) {
            logger.warn('Request performance warning', {
                method: req.method,
                url: req.originalUrl,
                duration: requestDuration,
                queryCount: analysis.sessionQueryCount,
                uniqueQueryTypes: analysis.uniqueQueryTypes,
                totalQueryDuration: analysis.totalDuration,
                hasN1Issues: analysis.hasN1Issues,
                issues: analysis.issues,
                sessionId
            });
        } else if (process.env.LOG_ALL_QUERY_SESSIONS === 'true') {
            logger.info('Request query summary', {
                method: req.method,
                url: req.originalUrl,
                duration: requestDuration,
                queryCount: analysis.sessionQueryCount,
                totalQueryDuration: analysis.totalDuration,
                sessionId
            });
        }

        // Call original end method
        originalEnd.apply(this, args);
    };

    next();
};

/**
 * Endpoint to get query monitoring statistics
 */
export const queryStatsHandler = (req, res) => {
    try {
        const stats = queryMonitor.getStats();
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to get query stats', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve query statistics'
        });
    }
};

/**
 * Endpoint to reset query monitoring data
 */
export const resetQueryStatsHandler = (req, res) => {
    try {
        queryMonitor.reset();
        res.json({
            success: true,
            message: 'Query monitoring data has been reset'
        });
    } catch (error) {
        logger.error('Failed to reset query stats', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to reset query statistics'
        });
    }
};