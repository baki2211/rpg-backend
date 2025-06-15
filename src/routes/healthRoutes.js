import express from 'express';
import { logger } from '../utils/logger.js';

const router = express.Router();

let presenceWebSocketServer = null;
let chatWebSocketServer = null;

// Set WebSocket server references for monitoring
export const setWebSocketServers = (presence, chat) => {
  presenceWebSocketServer = presence;
  chatWebSocketServer = chat;
};

// Basic health check
router.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024)
    },
    connections: {
      presence: presenceWebSocketServer?.getConnectionCount?.() || 0,
      chat: chatWebSocketServer?.getConnectionCount?.() || 0
    }
  };

  // Check if memory usage is high
  if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9) {
    health.status = 'warning';
    health.warning = 'High memory usage';
  }

  // Check if too many connections
  const totalConnections = health.connections.presence + health.connections.chat;
  if (totalConnections > 100) {
    health.status = 'warning';
    health.warning = 'High connection count';
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

// Force garbage collection (for debugging)
router.post('/gc', (req, res) => {
  if (global.gc) {
    global.gc();
    logger.info('Garbage collection forced');
    res.json({ message: 'Garbage collection executed' });
  } else {
    res.status(400).json({ error: 'Garbage collection not available. Start with --expose-gc flag.' });
  }
});

export default router; 