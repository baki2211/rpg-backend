import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { createGzip, createDeflate } from 'zlib';
import authRoutes from './routes/auth.js';
import cookieParser from 'cookie-parser';
import http from 'http'; 
import { AppDataSource } from './data-source.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import protectedRoutes from './routes/protected.js';
import mapRoutes from './routes/map.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/errorHandler.js';
import { compressionMiddleware, compressionStatsMiddleware } from './middleware/compressionMiddleware.js';
import locationRoutes from './routes/location.js';
import chatRoutes from './routes/chat.js';
import { setupWebSocketServer } from './websockets/ChatWebSocket.js';
import { setupPresenceWebSocketServer } from './websockets/PresenceWebSocket.js';
import raceRoutes from './routes/race.js';
import characterRoutes from './routes/character.js';
import skillRoutes from './routes/skill.js';
import skillBranchRoutes from './routes/skillBranch.js';
import skillTypeRoutes from './routes/skillType.js';
import sessionRoutes from './routes/session.js';
import characterSkillsRoutes from './routes/characterSkills.js';
import pvpRoutes from './routes/pvpRoutes.js';
import combatRoutes from './routes/combat.js';
import eventRoutes from './routes/event.js';
import engineLogRoutes from './routes/engineLogs.js';
import statDefinitionRoutes from './routes/statDefinition.js';
import { SessionExpirationJob } from './jobs/sessionExpiration.js';
import { MemoryCleanupJob } from './jobs/memoryCleanup.js';
import { logger } from './utils/logger.js';
import memoryManager from './utils/memoryManager.js';
import dbHealthMonitor from './utils/dbHealthMonitor.js';
import staticDataCache from './utils/staticDataCache.js';
import rankRoutes from './routes/rank.js';
import wikiRoutes from './routes/wikiRoutes.js';
import healthRoutes, { setWebSocketServers } from './routes/healthRoutes.js';
import presenceRoutes from './routes/presenceRoutes.js';
import fs from 'fs';

dotenv.config();

// Initialize Express and other constants
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chatWS = setupWebSocketServer();
const presenceWS = setupPresenceWebSocketServer();
let sessionExpirationInterval; // Declare but don't start yet
let memoryCleanupInterval; // Memory cleanup job interval

// Connect chat and presence WebSockets for real-time updates
chatWS.setPresenceBroadcaster(presenceWS.broadcastOnlineUsers);

// Set WebSocket servers for health monitoring
setWebSocketServers(presenceWS, chatWS);

// Set WebSocket servers for memory manager emergency cleanup
memoryManager.setWebSocketServers(presenceWS, chatWS);

// Middleware for WebSocket connections
server.on('upgrade', (req, socket, head) => {
  try {
    const pathname = req.url?.split('?')[0];

    if (pathname === '/ws/chat') {
      // Check chat connection count before upgrade with dynamic limits
      const chatConnections = chatWS.getConnectionCount();
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent = (memoryUsage.rss / (512 * 1024 * 1024)) * 100;
      
      // Dynamic connection limits based on memory usage
      let maxConnections = 15; // Base limit (increased from 5)
      if (memoryUsagePercent > 85) {
        maxConnections = 8; // Reduce when memory is high
      } else if (memoryUsagePercent > 70) {
        maxConnections = 12; // Moderate reduction
      }
      
      if (chatConnections >= maxConnections) {
        logger.warn(`Chat WebSocket upgrade rejected - connection limit reached: ${chatConnections}/${maxConnections} (memory: ${memoryUsagePercent.toFixed(1)}%)`);
        socket.write('HTTP/1.1 503 Service Unavailable\r\n' +
                     'Connection: close\r\n' +
                     'Content-Type: text/plain\r\n' +
                     'Content-Length: 38\r\n' +
                     '\r\n' +
                     'Server overloaded - too many connections');
        socket.destroy();
        return;
      }
      chatWS.handleUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  } catch (error) {
    logger.error('WebSocket upgrade error:', { error: error.message });
    socket.write('HTTP/1.1 500 Internal Server Error\r\n' +
                 'Connection: close\r\n' +
                 'Content-Type: text/plain\r\n' +
                 'Content-Length: 21\r\n' +
                 '\r\n' +
                 'Internal Server Error');
    socket.destroy();
  }
});

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://arcanerealms.org'],
  credentials: true,
}));

// Compression middleware - apply early for maximum benefit
app.use(compressionMiddleware);
app.use(compressionStatsMiddleware);

app.use(cookieParser());
app.use(bodyParser.json({ limit: '10mb' })); // Increased limit for compressed payloads
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/races', raceRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/character-skills', characterSkillsRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/skill-branches', skillBranchRoutes);
app.use('/api/skill-types', skillTypeRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/pvp', pvpRoutes);
app.use('/api/combat', combatRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/engine-logs', engineLogRoutes);
app.use('/api/stat-definitions', statDefinitionRoutes);
app.use('/api/ranks', rankRoutes);
app.use('/api/wiki', wikiRoutes);
app.use('/api/presence', presenceRoutes);

// Static files
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(errorHandler);

// Database connection and server startup
AppDataSource.initialize()
  .then(async () => {
    logger.startup('App connected to the database');
    
    // Start memory monitoring
    memoryManager.startMonitoring();
    
    // Start database health monitoring
    dbHealthMonitor.startMonitoring();
    
    // Preload static data cache
    await staticDataCache.preloadCache();
    
    // Start session expiration job after database is ready
    sessionExpirationInterval = SessionExpirationJob.startJob();
    
    // Start memory cleanup job
    memoryCleanupInterval = MemoryCleanupJob.startJob();
    
    server.listen(PORT, () => {
      logger.startup(`App Server running on http://localhost:${PORT}`);
      logger.startup('Memory monitoring active');
    });
  })
  .catch(error => {
    logger.critical('Database connection failed:', { error: error.message });
    process.exit(1);
  });

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Clean up WebSocket connections
    if (presenceWS?.cleanup) {
      presenceWS.cleanup();
      logger.info('Presence WebSocket connections closed');
    }
    
    if (chatWS?.cleanup) {
      chatWS.cleanup();
      logger.info('Chat WebSocket connections closed');
    }
    
    // Stop memory monitoring
    memoryManager.stopMonitoring();
    
    // Stop database health monitoring
    dbHealthMonitor.stopMonitoring();
    
    // Stop background jobs
    if (sessionExpirationInterval) {
      clearInterval(sessionExpirationInterval);
      logger.info('Session expiration job stopped');
    }
    
    // Stop memory cleanup job
    MemoryCleanupJob.stopJob();
    
    // Close database connection
    AppDataSource.destroy().then(() => {
      logger.info('Database connection closed');
      process.exit(0);
    }).catch((error) => {
      logger.error('Error closing database connection:', { error: error.message });
      process.exit(1);
    });
  });
  
  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));