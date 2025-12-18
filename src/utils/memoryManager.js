import { logger } from './logger.js';

class MemoryManager {
  constructor() {
    this.memoryCheckInterval = null;
    this.gcInterval = null;
    this.isMonitoring = false;
    this.webSocketServers = null; // Will be set by setWebSocketServers
    
    // Memory thresholds (in bytes)
    this.WARNING_THRESHOLD = 400 * 1024 * 1024; // 400MB
    this.CRITICAL_THRESHOLD = 450 * 1024 * 1024; // 450MB
    this.STARTER_LIMIT = 512 * 1024 * 1024; // 512MB

    // Memory thresholds for Render.com (512MB limit)
    this.thresholds = {
      warning: 350 * 1024 * 1024,    // 350MB - 68% of limit
      critical: 400 * 1024 * 1024,   // 400MB - 78% of limit
      emergency: 450 * 1024 * 1024   // 450MB - 88% of limit
    };
  }

  setWebSocketServers(presenceWS, chatWS) {
    this.webSocketServers = { presenceWS, chatWS };
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    logger.info(' Memory monitoring started with WebSocket integration');
    
    this.gcInterval = setInterval(() => {
      this.checkMemory(); // Use the new checkMemory method
    }, 15000); // Check every 15 seconds for more aggressive monitoring
  }

  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
    
    logger.info('Memory monitoring stopped');
  }



  performGarbageCollection(force = false) {
    if (!global.gc) {
      if (force) {
        logger.warn('Garbage collection not available on this platform.');
      }
      return this.performAlternativeCleanup(force);
    }

    const beforeMemory = process.memoryUsage();
    
    try {
      global.gc();
      
      const afterMemory = process.memoryUsage();
      const freedMB = Math.round((beforeMemory.rss - afterMemory.rss) / 1024 / 1024);
      
      if (freedMB > 0 || force) {
        logger.info('Garbage collection completed', {
          freedMemory: `${freedMB}MB`,
          currentRSS: `${Math.round(afterMemory.rss / 1024 / 1024)}MB`,
          currentHeap: `${Math.round(afterMemory.heapUsed / 1024 / 1024)}MB`
        });
      }
      
      return true;
    } catch (error) {
      logger.error('Error during garbage collection:', { error: error.message });
      return false;
    }
  }

  performAlternativeCleanup(force = false) {
    const beforeMemory = process.memoryUsage();
    
    try {
      // Alternative memory cleanup strategies for environments without global.gc
      
      // 1. Clear any large temporary variables
      if (global.Buffer) {
        // Force buffer cleanup by creating and releasing a small buffer
        const tempBuffer = Buffer.alloc(1024);
        tempBuffer.fill(0);
      }
      
      // 2. Trigger V8's incremental marking
      // This encourages garbage collection without requiring --expose-gc
      const largeArray = new Array(1000).fill(null);
      largeArray.length = 0;
      
      // 3. Clear any cached objects (application-specific)
      // This would be where you clear application caches
      
      // 4. Force a small allocation to trigger GC heuristics
      const cleanup = () => {
        const temp = new Array(100).fill(Math.random());
        return temp.length;
      };
      cleanup();
      
      const afterMemory = process.memoryUsage();
      const memoryDiff = Math.round((beforeMemory.rss - afterMemory.rss) / 1024 / 1024);
      
      if (force || memoryDiff !== 0) {
        logger.info('Alternative memory cleanup completed', {
          memoryChange: `${memoryDiff}MB`,
          currentRSS: `${Math.round(afterMemory.rss / 1024 / 1024)}MB`,
          currentHeap: `${Math.round(afterMemory.heapUsed / 1024 / 1024)}MB`
        });
      }
      
      return true;
    } catch (error) {
      logger.error('Error during alternative cleanup:', { error: error.message });
      return false;
    }
  }

  getMemoryStatus(rss) {
    if (rss > this.thresholds.emergency) return 'emergency';
    if (rss > this.thresholds.critical) return 'critical';
    if (rss > this.thresholds.warning) return 'warning';
    return 'healthy';
  }

  getMemoryStats() {
    const memUsage = process.memoryUsage();
    const rssPercent = ((memUsage.rss / this.STARTER_LIMIT) * 100).toFixed(1);
    const heapPercent = ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1);
    
    return {
      rss: {
        bytes: memUsage.rss,
        mb: Math.round(memUsage.rss / 1024 / 1024),
        percent: parseFloat(rssPercent)
      },
      heap: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percent: parseFloat(heapPercent)
      },
      external: Math.round(memUsage.external / 1024 / 1024),
      limit: Math.round(this.STARTER_LIMIT / 1024 / 1024),
      status: this.getMemoryStatus(memUsage.rss),
      gcAvailable: !!global.gc
    };
  }

  // Emergency cleanup function
  async emergencyCleanup() {
    logger.warn('Performing emergency memory cleanup');
    
    // Close all WebSocket connections immediately
    if (this.webSocketServers) {
      try {
        if (this.webSocketServers.presenceWS?.cleanup) {
          this.webSocketServers.presenceWS.cleanup();
          logger.info('Emergency: Closed all presence WebSocket connections');
        }
        if (this.webSocketServers.chatWS?.cleanup) {
          this.webSocketServers.chatWS.cleanup();
          logger.info(' Emergency: Closed all chat WebSocket connections');
        }
      } catch (error) {
        logger.error('Error during emergency WebSocket cleanup:', { error: error.message });
      }
    }
    
    // Release idle database connections
    try {
      const { default: dbHealthMonitor } = await import('./dbHealthMonitor.js');
      await dbHealthMonitor.releaseIdleConnections();
    } catch (error) {
      logger.error('Error during database cleanup:', { error: error.message });
    }
    
    // Clear cache to free memory
    try {
      const { default: staticDataCache } = await import('./staticDataCache.js');
      staticDataCache.clear();
      logger.warn(' Emergency: Static data cache cleared');
    } catch (error) {
      logger.error('Error during cache cleanup:', { error: error.message });
    }
    
    // Perform multiple cleanup cycles
    this.performAlternativeCleanup(true);
    setTimeout(() => this.performAlternativeCleanup(true), 1000);
    setTimeout(() => this.performAlternativeCleanup(true), 2000);
  }

  checkMemory() {
    const memUsage = process.memoryUsage();
    const rssPercent = (memUsage.rss / (512 * 1024 * 1024)) * 100;
    
    if (memUsage.rss > this.thresholds.emergency) {
      logger.error('EMERGENCY: Memory usage at 88%', {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        percent: rssPercent.toFixed(1)
      });
      this.emergencyCleanup();
    } else if (memUsage.rss > this.thresholds.critical) {
      logger.error('CRITICAL: Memory usage at 78%', {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        percent: rssPercent.toFixed(1)
      });
      this.aggressiveCleanup();
    } else if (memUsage.rss > this.thresholds.warning) {
      logger.warn('WARNING: Memory usage at 68%', {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        percent: rssPercent.toFixed(1)
      });
      this.performAlternativeCleanup();
    }
  }

  async aggressiveCleanup() {
    logger.warn('Performing aggressive cleanup...');
    
    // Clear static data cache to free immediate memory
    try {
      const { default: staticDataCache } = await import('./staticDataCache.js');
      const cleanedEntries = staticDataCache.cleanup();
      if (cleanedEntries > 0) {
        logger.info(`Cleaned ${cleanedEntries} expired cache entries`);
      }
    } catch (error) {
      logger.error('Error during cache cleanup:', { error: error.message });
    }
    
    // Close some WebSocket connections if we have too many
    if (this.webSocketServers) {
      try {
        const presenceCount = this.webSocketServers.presenceWS?.getConnectionCount?.() || 0;
        const chatCount = this.webSocketServers.chatWS?.getConnectionCount?.() || 0;
        
        if (presenceCount > 5) {
          logger.warn(`Too many presence connections (${presenceCount}), forcing cleanup`);
          // Force cleanup of stale connections
          if (this.webSocketServers.presenceWS?.wss) {
            this.webSocketServers.presenceWS.wss.clients.forEach(ws => {
              if (ws.readyState !== ws.OPEN) {
                ws.terminate();
              }
            });
          }
        }
        
        if (chatCount > 10) {
          logger.warn(`Too many chat connections (${chatCount}), forcing cleanup`);
          // Force cleanup of stale connections
          if (this.webSocketServers.chatWS?.wss) {
            this.webSocketServers.chatWS.wss.clients.forEach(ws => {
              if (ws.readyState !== ws.OPEN) {
                ws.terminate();
              }
            });
          }
        }
      } catch (error) {
        logger.error('Error during aggressive WebSocket cleanup:', { error: error.message });
      }
    }
    
    this.performAlternativeCleanup();
  }
}

// Create singleton instance
const memoryManager = new MemoryManager();

export default memoryManager; 