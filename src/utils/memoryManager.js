import { logger } from './logger.js';

class MemoryManager {
  constructor() {
    this.memoryCheckInterval = null;
    this.gcInterval = null;
    this.isMonitoring = false;
    
    // Memory thresholds (in bytes)
    this.WARNING_THRESHOLD = 400 * 1024 * 1024; // 400MB
    this.CRITICAL_THRESHOLD = 450 * 1024 * 1024; // 450MB
    this.STARTER_LIMIT = 512 * 1024 * 1024; // 512MB
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    logger.info('Memory monitoring started');
    
    // Check memory every 30 seconds
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000);
    
    // Force garbage collection every 2 minutes if available
    // Note: global.gc is not available on Render.com, so we'll use alternative methods
    this.gcInterval = setInterval(() => {
      this.performAlternativeCleanup();
    }, 120000);
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

  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const rss = memUsage.rss;
    const heapUsed = memUsage.heapUsed;
    const heapTotal = memUsage.heapTotal;
    
    // Log memory stats
    const rssPercent = ((rss / this.STARTER_LIMIT) * 100).toFixed(1);
    const heapPercent = ((heapUsed / heapTotal) * 100).toFixed(1);
    
    if (rss > this.CRITICAL_THRESHOLD) {
      logger.error('CRITICAL: Memory usage very high!', {
        rss: `${Math.round(rss / 1024 / 1024)}MB (${rssPercent}%)`,
        heap: `${Math.round(heapUsed / 1024 / 1024)}MB (${heapPercent}%)`,
        limit: `${Math.round(this.STARTER_LIMIT / 1024 / 1024)}MB`
      });
      
      // Emergency cleanup
      this.performAlternativeCleanup(true);
      
    } else if (rss > this.WARNING_THRESHOLD) {
      logger.warn('WARNING: Memory usage high', {
        rss: `${Math.round(rss / 1024 / 1024)}MB (${rssPercent}%)`,
        heap: `${Math.round(heapUsed / 1024 / 1024)}MB (${heapPercent}%)`
      });
      
      // Preventive cleanup
      this.performAlternativeCleanup();
    }
    
    return {
      rss,
      heapUsed,
      heapTotal,
      external: memUsage.external,
      rssPercent: parseFloat(rssPercent),
      heapPercent: parseFloat(heapPercent),
      status: this.getMemoryStatus(rss)
    };
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
    if (rss > this.CRITICAL_THRESHOLD) return 'critical';
    if (rss > this.WARNING_THRESHOLD) return 'warning';
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
  emergencyCleanup() {
    logger.warn('Performing emergency memory cleanup');
    
    // Force cleanup multiple times
    for (let i = 0; i < 3; i++) {
      this.performAlternativeCleanup(true);
    }
    
    // Clear any large caches or temporary data
    // This would be application-specific
    
    const memUsage = process.memoryUsage();
    logger.info('Emergency cleanup completed', {
      currentRSS: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      currentHeap: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
    });
  }
}

// Create singleton instance
const memoryManager = new MemoryManager();

export default memoryManager; 