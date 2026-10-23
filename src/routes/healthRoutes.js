import express from 'express';
import { logger } from '../utils/logger.js';
import memoryManager from '../utils/memoryManager.js';
import dbHealthMonitor from '../utils/dbHealthMonitor.js';
import staticDataCache from '../utils/staticDataCache.js';
import { MemoryCleanupJob } from '../jobs/memoryCleanup.js';
import { RateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';
import { assessHealth } from '../utils/healthStatus.js';

// Track compression statistics
let compressionStats = {
  totalRequests: 0,
  compressedRequests: 0,
  totalSavings: 0,
  averageRatio: 0,
  lastReset: new Date()
};

// Export function to update compression stats
export const updateCompressionStats = (originalSize, compressedSize, wasCompressed) => {
  compressionStats.totalRequests++;
  
  if (wasCompressed) {
    compressionStats.compressedRequests++;
    const savings = originalSize - compressedSize;
    compressionStats.totalSavings += savings;
    
    // Calculate running average
    const ratio = (savings / originalSize) * 100;
    compressionStats.averageRatio = 
      (compressionStats.averageRatio * (compressionStats.compressedRequests - 1) + ratio) / 
      compressionStats.compressedRequests;
  }
};

const router = express.Router();

// Everything except the public GET / check exposes internals or triggers cleanups: admins only
// Errors in these handlers reach errorHandler (Express 5 forwards throws and rejections): logged, generic 500.
const adminOnly = [authenticateToken, isAdmin];

let presenceWebSocketServer = null;
let chatWebSocketServer = null;

// Set WebSocket server references for monitoring
export const setWebSocketServers = (presence, chat) => {
  presenceWebSocketServer = presence;
  chatWebSocketServer = chat;
};

// Add rate limiting to prevent health check spam
const healthCheckRequests = new Map();
const HEALTH_CHECK_WINDOW = 5000; // 5 seconds
const MAX_HEALTH_CHECKS = 3; // Max 3 requests per window

// Middleware to rate limit health checks
const rateLimitHealthChecks = (req, res, next) => {
  const clientIp = req.ip;
  const now = Date.now();
  
  // Clean up old entries
  for (const [ip, data] of healthCheckRequests.entries()) {
    if (now - data.timestamp > HEALTH_CHECK_WINDOW) {
      healthCheckRequests.delete(ip);
    }
  }
  
  // Check if client has exceeded rate limit
  const clientData = healthCheckRequests.get(clientIp);
  if (clientData) {
    if (clientData.count >= MAX_HEALTH_CHECKS) {
      // If client has exceeded limit, return cached health data
      if (clientData.cachedResponse) {
        return res.json(clientData.cachedResponse);
      }
      // If no cached data, return 503
      return res.status(503).json({
        status: 'rate_limited',
        message: 'Too many health checks, please wait',
        retryAfter: Math.ceil((HEALTH_CHECK_WINDOW - (now - clientData.timestamp)) / 1000)
      });
    }
    clientData.count++;
  } else {
    healthCheckRequests.set(clientIp, { count: 1, timestamp: now });
  }
  
  next();
};

// Health check endpoint with rate limiting
router.get('/', rateLimitHealthChecks, async (req, res) => {
  try {
    // RSS against the same budget memoryManager uses for its own pressure decisions
    const { rss, heap, limit, status: memoryManagerStatus } = memoryManager.getMemoryStats();
    const memory = {
      usage_percent: rss.percent,
      rss_mb: rss.mb,
      heap_used_mb: heap.used,
      heap_total_mb: heap.total,
      limit_mb: limit,
      manager_status: memoryManagerStatus
    };

    // Get connection counts
    const getConnectionCounts = () => {
      try {
        return {
          presence: presenceWebSocketServer?.getConnectionCount?.() || 0,
          chat: chatWebSocketServer?.getConnectionCount?.() || 0,
          total: (presenceWebSocketServer?.getConnectionCount?.() || 0) + 
                 (chatWebSocketServer?.getConnectionCount?.() || 0)
        };
      } catch (error) {
        logger.warn('Connection count check failed:', error.message);
        return { presence: 0, chat: 0, total: 0 };
      }
    };

    const connections = getConnectionCounts();
    
    // Get database health information
    const dbHealth = dbHealthMonitor.getHealthReport();

    const assessment = assessHealth({
      memoryPercent: memory.usage_percent,
      totalConnections: connections.total,
      databaseStatus: dbHealth.database.status
    });

    const healthData = {
      status: assessment.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        ...memory,
        status: assessment.memoryStatus
      },
      connections,
      database: {
        status: dbHealth.database.status,
        poolUtilization: dbHealth.database.pool.poolUtilization + '%',
        usedConnections: dbHealth.database.pool.usedConnections,
        maxConnections: dbHealth.database.pool.maxConnections,
        waitingClients: dbHealth.database.pool.waitingClients
      },
      cache: staticDataCache.getStats(),
      compression: {
        enabled: true,
        stats: compressionStats
      },
      memoryCleanup: MemoryCleanupJob.getStatus(),
      gc_available: typeof global.gc === 'function'
    };

    // Cache the response for rate-limited clients
    const clientIp = req.ip;
    const clientData = healthCheckRequests.get(clientIp);
    if (clientData) {
      clientData.cachedResponse = healthData;
    }

    // If server is under heavy load, return 503
    if (assessment.overloaded) {
      res.status(503).json({
        ...healthData,
        status: 'overloaded',
        message: 'Server is under heavy load, please try again later'
      });
      return;
    }

    res.json(healthData);
  } catch (error) {
    logger.error('Health check error:', error);
    // Return a degraded status instead of 500
    res.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: { status: 'unknown' },
      connections: { presence: 0, chat: 0, total: 0 },
      gc_available: false,
      error: 'Health check failed'
    });
  }
});

// Detailed status for monitoring
router.get('/status', adminOnly, (req, res) => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  const status = {
    server: {
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    memory: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      usage_percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    websockets: {
      presence: {
        connections: presenceWebSocketServer?.getConnectionCount?.() || 0,
        status: presenceWebSocketServer ? 'active' : 'inactive'
      },
      chat: {
        connections: chatWebSocketServer?.getConnectionCount?.() || 0,
        status: chatWebSocketServer ? 'active' : 'inactive'
      }
    },
    timestamp: new Date().toISOString()
  };

  res.json(status);
});

// Force memory cleanup (works without --expose-gc)
router.post('/gc', adminOnly, (req, res) => {
  const beforeStats = memoryManager.getMemoryStats();
  const success = memoryManager.performGarbageCollection(true);
  
  const afterStats = memoryManager.getMemoryStats();
  const freedMB = beforeStats.rss.mb - afterStats.rss.mb;
  
  res.json({ 
    message: success ? 'Memory cleanup executed' : 'Alternative memory cleanup executed',
    method: global.gc ? 'Native garbage collection' : 'Alternative cleanup strategies',
    before: {
      rss: `${beforeStats.rss.mb}MB`,
      heap: `${beforeStats.heap.used}MB`
    },
    after: {
      rss: `${afterStats.rss.mb}MB`,
      heap: `${afterStats.heap.used}MB`
    },
    memoryChange: `${freedMB}MB`,
    gcAvailable: !!global.gc
  });
});

// Add cleanup endpoint
router.post('/cleanup', adminOnly, (req, res) => {
  if (presenceWebSocketServer?.cleanup) {
    logger.info('Manual cleanup requested via API');
    presenceWebSocketServer.cleanup();
    res.json({ 
      success: true, 
      message: 'WebSocket connections cleaned up',
      presenceConnections: presenceWebSocketServer.getConnectionCount?.() || 0,
      chatConnections: chatWebSocketServer?.getConnectionCount?.() || 0
    });
  } else {
    res.status(503).json({ 
      success: false, 
      message: 'WebSocket servers not available' 
    });
  }
});

// Database health endpoint
router.get('/database', adminOnly, (req, res) => {
  const healthReport = dbHealthMonitor.getHealthReport();
  res.json(healthReport);
});

// Database connection cleanup endpoint
router.post('/database/cleanup', adminOnly, async (req, res) => {
  logger.info('Manual database cleanup requested via API');
  const success = await dbHealthMonitor.releaseIdleConnections();
  const healthReport = dbHealthMonitor.getHealthReport();
  
  res.json({
    success,
    message: success ? 'Database connections cleaned up' : 'Cleanup failed or not needed',
    poolStats: healthReport.database.pool
  });
});

// Cache management endpoints
router.get('/cache', adminOnly, (req, res) => {
  const cacheStats = staticDataCache.getStats();
  res.json({
    status: 'success',
    cache: cacheStats,
    timestamp: new Date().toISOString()
  });
});

router.post('/cache/clear', adminOnly, (req, res) => {
  const entity = req.body.entity;
  
  if (entity) {
    staticDataCache.clearEntity(entity);
    logger.info(`Cache cleared for entity: ${entity}`);
    res.json({
      success: true,
      message: `Cache cleared for entity: ${entity}`,
      stats: staticDataCache.getStats()
    });
  } else {
    staticDataCache.clear();
    logger.info('All cache cleared via API');
    res.json({
      success: true,
      message: 'All cache cleared',
      stats: staticDataCache.getStats()
    });
  }
});

router.post('/cache/cleanup', adminOnly, (req, res) => {
  const removedCount = staticDataCache.cleanup();
  res.json({
    success: true,
    message: `Cleaned up ${removedCount} expired cache entries`,
    stats: staticDataCache.getStats()
  });
});

// Compression statistics endpoint
router.get('/compression', adminOnly, (req, res) => {
  const stats = {
    ...compressionStats,
    compressionRate: compressionStats.totalRequests > 0 
      ? ((compressionStats.compressedRequests / compressionStats.totalRequests) * 100).toFixed(1) + '%'
      : '0%',
    totalSavingsMB: (compressionStats.totalSavings / (1024 * 1024)).toFixed(2) + 'MB',
    averageRatio: compressionStats.averageRatio.toFixed(1) + '%'
  };
  
  res.json({
    status: 'success',
    compression: stats,
    timestamp: new Date().toISOString()
  });
});

// Reset compression statistics
router.post('/compression/reset', adminOnly, (req, res) => {
  compressionStats = {
    totalRequests: 0,
    compressedRequests: 0,
    totalSavings: 0,
    averageRatio: 0,
    lastReset: new Date()
  };
  
  res.json({
    success: true,
    message: 'Compression statistics reset',
    timestamp: new Date().toISOString()
  });
});

// Manual memory cleanup endpoint
router.post('/memory/cleanup', adminOnly, async (req, res) => {
  logger.info('Manual memory cleanup requested via API');
  
  // Run cleanup in background to avoid timeout
  MemoryCleanupJob.runCleanup().catch(error => {
    logger.error('Manual memory cleanup failed:', { error: error.message });
  });
  
  res.json({
    success: true,
    message: 'Memory cleanup initiated',
    status: MemoryCleanupJob.getStatus(),
    timestamp: new Date().toISOString()
  });
});

// Memory optimization status endpoint
router.get('/memory/status', adminOnly, (req, res) => {
  const memoryStats = memoryManager.getMemoryStats();
  
  res.json({
    status: 'success',
    memory: memoryStats,
    cleanup: MemoryCleanupJob.getStatus(),
    cache: staticDataCache.getStats(),
    compression: compressionStats,
    timestamp: new Date().toISOString()
  });
});

// Rate limiting status endpoint
router.get('/rate-limits', adminOnly, async (req, res) => {
  const activeLimits = await RateLimitMiddleware.getActiveRateLimits();

  res.json({
    status: 'success',
    rateLimits: {
      active: activeLimits.length,
      entries: activeLimits,
      stats: {
        totalActiveKeys: activeLimits.length,
        byType: activeLimits.reduce((acc, limit) => {
          const type = limit.key.split('_')[0];
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {})
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Clear specific rate limit
router.post('/rate-limits/clear', adminOnly, async (req, res) => {
  const { key } = req.body;

  if (!key) {
    return res.status(400).json({
      success: false,
      message: 'Rate limit key is required'
    });
  }

  const cleared = await RateLimitMiddleware.clearRateLimit(key);

  res.json({
    success: cleared,
    message: cleared ? `Rate limit cleared for key: ${key}` : 'Rate limit key not found',
    timestamp: new Date().toISOString()
  });
});

export default router; 