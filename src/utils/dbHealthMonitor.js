import { AppDataSource } from '../data-source.js';
import { logger } from './logger.js';

class DatabaseHealthMonitor {
  constructor() {
    this.monitoringInterval = null;
    this.isMonitoring = false;
  }

  /**
   * Get current database connection pool statistics
   * @returns {Object} Pool statistics
   */
  getPoolStats() {
    try {
      const driver = AppDataSource.driver;
      const pool = driver.master; // PostgreSQL connection pool
      
      if (!pool) {
        return {
          available: 'Unknown',
          used: 'Unknown',
          pending: 'Unknown',
          max: 'Unknown',
          status: 'disconnected'
        };
      }

      // For node-postgres (pg) pool
      const stats = {
        totalConnections: pool.totalCount || 0,
        idleConnections: pool.idleCount || 0,
        waitingClients: pool.waitingCount || 0,
        maxConnections: pool.options?.max || 10,
        minConnections: pool.options?.min || 2,
        status: AppDataSource.isInitialized ? 'connected' : 'disconnected'
      };

      // Calculate derived metrics
      stats.usedConnections = stats.totalConnections - stats.idleConnections;
      stats.poolUtilization = stats.maxConnections > 0 
        ? ((stats.usedConnections / stats.maxConnections) * 100).toFixed(1)
        : '0';
      
      return stats;
    } catch (error) {
      logger.error('Error getting pool stats:', { error: error.message });
      return {
        available: 'Error',
        used: 'Error', 
        pending: 'Error',
        max: 'Error',
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Check database health and log warnings if needed
   */
  checkDatabaseHealth() {
    const stats = this.getPoolStats();
    
    if (stats.status === 'error' || stats.status === 'disconnected') {
      logger.error(' Database health check failed', { stats });
      return;
    }

    // Log pool utilization warnings
    const utilization = parseFloat(stats.poolUtilization);
    
    if (utilization >= 90) {
      logger.error('CRITICAL: Database pool utilization at ' + stats.poolUtilization + '%', {
        used: stats.usedConnections,
        max: stats.maxConnections,
        waiting: stats.waitingClients
      });
    } else if (utilization >= 70) {
      logger.warn('WARNING: Database pool utilization at ' + stats.poolUtilization + '%', {
        used: stats.usedConnections,
        max: stats.maxConnections,
        waiting: stats.waitingClients
      });
    }

    // Log waiting clients
    if (stats.waitingClients > 0) {
      logger.warn('Database clients waiting for connections:', {
        waiting: stats.waitingClients,
        available: stats.idleConnections
      });
    }

    // Log detailed stats every 5 minutes in development
    if (process.env.NODE_ENV === 'development') {
      logger.info('Database Pool Stats', stats);
    }
  }

  /**
   * Start monitoring database health
   * @param {number} intervalMs - Monitoring interval in milliseconds (default: 30 seconds)
   */
  startMonitoring(intervalMs = 30000) {
    if (this.isMonitoring) {
      logger.warn('Database health monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Database health monitoring started');

    this.monitoringInterval = setInterval(() => {
      this.checkDatabaseHealth();
    }, intervalMs);
  }

  /**
   * Stop monitoring database health
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Database health monitoring stopped');
  }

  /**
   * Get comprehensive database health report
   * @returns {Object} Health report
   */
  getHealthReport() {
    const poolStats = this.getPoolStats();
    const memoryUsage = process.memoryUsage();
    
    return {
      timestamp: new Date().toISOString(),
      database: {
        status: poolStats.status,
        pool: poolStats,
        isInitialized: AppDataSource.isInitialized
      },
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB'
      },
      uptime: Math.round(process.uptime()) + 's'
    };
  }

  /**
   * Force release idle connections (emergency cleanup)
   */
  async releaseIdleConnections() {
    try {
      const driver = AppDataSource.driver;
      const pool = driver.master;
      
      if (pool && typeof pool.end === 'function') {
        logger.warn('Forcing release of idle database connections');
        
        // This will close idle connections but keep the pool alive
        const beforeStats = this.getPoolStats();
        
        // Create a new connection to trigger pool cleanup
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.release();
        
        const afterStats = this.getPoolStats();
        
        logger.info('Database connection cleanup completed', {
          before: beforeStats,
          after: afterStats
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error during database connection cleanup:', { error: error.message });
      return false;
    }
  }
}

// Create singleton instance
const dbHealthMonitor = new DatabaseHealthMonitor();

export default dbHealthMonitor;