import express from 'express';
import { logger } from '../utils/logger.js';
import memoryManager from '../utils/memoryManager.js';

const router = express.Router();

let presenceWebSocketServer = null;
let chatWebSocketServer = null;

// Set WebSocket server references for monitoring
export const setWebSocketServers = (presence, chat) => {
  presenceWebSocketServer = presence;
  chatWebSocketServer = chat;
};

// Basic health check with detailed memory monitoring
router.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memoryStats = memoryManager.getMemoryStats();
  
  const health = {
    status: memoryStats.status === 'critical' ? 'critical' : 
            memoryStats.status === 'warning' ? 'warning' : 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: {
      used: memoryStats.heap.used,
      total: memoryStats.heap.total,
      external: memoryStats.external,
      rss: memoryStats.rss.mb,
      usage_percent: memoryStats.rss.percent,
      heap_percent: memoryStats.heap.percent,
      limit_mb: memoryStats.limit,
      status: memoryStats.status
    },
    connections: {
      presence: presenceWebSocketServer?.getConnectionCount?.() || 0,
      chat: chatWebSocketServer?.getConnectionCount?.() || 0,
      total: (presenceWebSocketServer?.getConnectionCount?.() || 0) + (chatWebSocketServer?.getConnectionCount?.() || 0)
    },
    gc_available: memoryStats.gcAvailable
  };

  // Set warnings based on memory status
  if (memoryStats.status === 'critical') {
    health.warning = `CRITICAL: Memory usage at ${memoryStats.rss.percent}% (${memoryStats.rss.mb}MB/${memoryStats.limit}MB)`;
  } else if (memoryStats.status === 'warning') {
    health.warning = `WARNING: Memory usage at ${memoryStats.rss.percent}% (${memoryStats.rss.mb}MB/${memoryStats.limit}MB)`;
  }

  // Check if too many connections
  const totalConnections = health.connections.total;
  if (totalConnections > 100) {
    health.status = 'warning';
    health.warning = (health.warning ? health.warning + '; ' : '') + `High connection count: ${totalConnections}`;
  }

  res.json(health);
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

export default router; 