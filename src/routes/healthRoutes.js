import express from 'express';
import { logger } from '../utils/logger.js';
import memoryManager from '../utils/memoryManager.js';
import dbHealthMonitor from '../utils/dbHealthMonitor.js';

const router = express.Router();

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
    // Get memory usage with timeout
    const memoryPromise = memoryManager.getMemoryUsage();
    const memoryTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Memory check timeout')), 2000)
    );
    
    const memory = await Promise.race([memoryPromise, memoryTimeout])
      .catch(error => {
        logger.warn('Memory check failed:', error.message);
        return { usage_percent: 0, status: 'unknown' };
      });

    // Get connection counts with timeout
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

    // Determine overall health status
    const isHealthy = memory.usage_percent < 90 && 
                     connections.total < 20 && 
                     dbHealth.database.status === 'connected';

    const healthData = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        ...memory,
        limit_mb: process.env.MEMORY_LIMIT_MB || 512,
        status: memory.usage_percent < 90 ? 'healthy' : 'warning'
      },
      connections,
      database: {
        status: dbHealth.database.status,
        poolUtilization: dbHealth.database.pool.poolUtilization + '%',
        usedConnections: dbHealth.database.pool.usedConnections,
        maxConnections: dbHealth.database.pool.maxConnections,
        waitingClients: dbHealth.database.pool.waitingClients
      },
      gc_available: typeof global.gc === 'function'
    };

    // Cache the response for rate-limited clients
    const clientIp = req.ip;
    const clientData = healthCheckRequests.get(clientIp);
    if (clientData) {
      clientData.cachedResponse = healthData;
    }

    // If server is under heavy load, return 503
    if (memory.usage_percent > 95 || connections.total >= 20) {
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
router.get('/status', (req, res) => {
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
router.post('/gc', (req, res) => {
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
router.post('/cleanup', (req, res) => {
  try {
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
  } catch (error) {
    logger.error('Error during manual cleanup:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error during cleanup',
      error: error.message 
    });
  }
});

// Database health endpoint
router.get('/database', (req, res) => {
  try {
    const healthReport = dbHealthMonitor.getHealthReport();
    res.json(healthReport);
  } catch (error) {
    logger.error('Database health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Database connection cleanup endpoint
router.post('/database/cleanup', async (req, res) => {
  try {
    logger.info('Manual database cleanup requested via API');
    const success = await dbHealthMonitor.releaseIdleConnections();
    const healthReport = dbHealthMonitor.getHealthReport();
    
    res.json({
      success,
      message: success ? 'Database connections cleaned up' : 'Cleanup failed or not needed',
      poolStats: healthReport.database.pool
    });
  } catch (error) {
    logger.error('Error during database cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Error during database cleanup',
      error: error.message
    });
  }
});

export default router; 