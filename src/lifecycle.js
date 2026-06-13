import { AppDataSource } from './data-source.js';
import { SessionExpirationJob } from './jobs/sessionExpiration.js';
import { MemoryCleanupJob } from './jobs/memoryCleanup.js';
import { RateLimitMiddleware } from './middleware/rateLimitMiddleware.js';
import { AuditLogger } from './utils/auditLogger.js';
import { logger } from './utils/logger.js';
import memoryManager from './utils/memoryManager.js';
import dbHealthMonitor from './utils/dbHealthMonitor.js';
import staticDataCache from './utils/staticDataCache.js';

export async function startServer({ server, port }) {
  await AppDataSource.initialize();
  logger.startup('App connected to the database');

  memoryManager.startMonitoring();
  dbHealthMonitor.startMonitoring();

  await staticDataCache.preloadCache();
  await RateLimitMiddleware.initStore();

  const sessionExpirationInterval = SessionExpirationJob.startJob();
  MemoryCleanupJob.startJob();

  await new Promise((resolve) => {
    server.listen(port, () => {
      logger.startup(`App Server running on http://localhost:${port}`);
      logger.startup('Memory monitoring active');

      AuditLogger.logSystem(
        AuditLogger.EventTypes.SYSTEM_STARTUP,
        {
          port,
          node_env: process.env.NODE_ENV || 'development',
          node_version: process.version,
          features_enabled: {
            memory_monitoring: true,
            db_health_monitoring: true,
            static_data_cache: true,
            session_expiration: true,
            memory_cleanup: true,
            rate_limiting: true,
            audit_logging: true,
          },
        },
        AuditLogger.RiskLevels.LOW,
      );
      resolve();
    });
  });

  return { sessionExpirationInterval };
}

export function installShutdownHandlers({ server, chatWS, presenceWS, intervals }) {
  const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    AuditLogger.logSystem(
      AuditLogger.EventTypes.SYSTEM_SHUTDOWN,
      {
        signal,
        uptime_seconds: process.uptime(),
        memory_usage: process.memoryUsage(),
        active_connections: {
          presence: presenceWS?.getConnectionCount?.() || 0,
          chat: chatWS?.getConnectionCount?.() || 0,
        },
      },
      AuditLogger.RiskLevels.LOW,
    );

    server.close(() => {
      logger.info('HTTP server closed');

      if (presenceWS?.cleanup) {
        presenceWS.cleanup();
        logger.info('Presence WebSocket connections closed');
      }

      if (chatWS?.cleanup) {
        chatWS.cleanup();
        logger.info('Chat WebSocket connections closed');
      }

      memoryManager.stopMonitoring();
      dbHealthMonitor.stopMonitoring();

      if (intervals?.sessionExpirationInterval) {
        clearInterval(intervals.sessionExpirationInterval);
        logger.info('Session expiration job stopped');
      }

      MemoryCleanupJob.stopJob();

      AppDataSource.destroy()
        .then(() => {
          logger.info('Database connection closed');
          process.exit(0);
        })
        .catch((error) => {
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
}
