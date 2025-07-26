import { logger } from '../utils/logger.js';
import memoryManager from '../utils/memoryManager.js';
import staticDataCache from '../utils/staticDataCache.js';
import { AppDataSource } from '../data-source.js';
import { ChatMessage } from '../models/chatMessageModel.js';
import { EngineLog } from '../models/engineLogModel.js';
import { LessThan } from 'typeorm';

/**
 * Periodic memory cleanup job
 * Runs every 30 minutes to prevent memory accumulation
 */
class MemoryCleanupJob {
  constructor() {
    this.isRunning = false;
    this.interval = null;
  }

  /**
   * Start the periodic cleanup job
   */
  startJob(intervalMs = 30 * 60 * 1000) { // 30 minutes
    if (this.interval) {
      logger.warn('Memory cleanup job already running');
      return this.interval;
    }

    logger.info('Starting memory cleanup job');
    
    // Run initial cleanup after 5 minutes
    setTimeout(() => this.runCleanup(), 5 * 60 * 1000);
    
    // Then run every 30 minutes
    this.interval = setInterval(() => {
      this.runCleanup();
    }, intervalMs);

    return this.interval;
  }

  /**
   * Stop the cleanup job
   */
  stopJob() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Memory cleanup job stopped');
    }
  }

  /**
   * Run the cleanup routine
   */
  async runCleanup() {
    if (this.isRunning) {
      logger.debug('Memory cleanup already in progress, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      logger.info('🧹 Starting periodic memory cleanup');

      const memoryBefore = process.memoryUsage();
      const tasks = [];

      // 1. Clean expired cache entries
      tasks.push(this.cleanExpiredCache());

      // 2. Clean old chat messages (older than 5 hours to match display policy)
      tasks.push(this.cleanOldChatMessages());

      // 3. Clean old engine logs (older than 7 days)
      tasks.push(this.cleanOldEngineLogs());

      // 4. Force garbage collection if available
      tasks.push(this.forceGarbageCollection());

      // Run all cleanup tasks in parallel
      const results = await Promise.allSettled(tasks);
      
      // Log results
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error(`Cleanup task ${index + 1} failed:`, { error: result.reason });
        }
      });

      const memoryAfter = process.memoryUsage();
      const memoryFreed = Math.round((memoryBefore.rss - memoryAfter.rss) / 1024 / 1024);
      const duration = Date.now() - startTime;

      logger.info('🧹 Memory cleanup completed', {
        duration: `${duration}ms`,
        memoryFreed: `${memoryFreed}MB`,
        rssAfter: `${Math.round(memoryAfter.rss / 1024 / 1024)}MB`,
        heapAfter: `${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`
      });

    } catch (error) {
      logger.error('Memory cleanup job failed:', { error: error.message });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredCache() {
    try {
      const cleanedCount = staticDataCache.cleanup();
      if (cleanedCount > 0) {
        logger.info(`Cleaned ${cleanedCount} expired cache entries`);
      }
      return cleanedCount;
    } catch (error) {
      logger.error('Cache cleanup failed:', { error: error.message });
      throw error;
    }
  }

  /**
   * Clean old chat messages (older than 5 hours)
   */
  async cleanOldChatMessages() {
    try {
      const chatRepository = AppDataSource.getRepository(ChatMessage);
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
      
      const result = await chatRepository.delete({
        createdAt: LessThan(fiveHoursAgo)
      });

      if (result.affected > 0) {
        logger.info(`Cleaned ${result.affected} old chat messages (>5 hours)`);
      }
      
      return result.affected;
    } catch (error) {
      logger.error('Chat message cleanup failed:', { error: error.message });
      throw error;
    }
  }

  /**
   * Clean old engine logs
   */
  async cleanOldEngineLogs() {
    try {
      const engineLogRepository = AppDataSource.getRepository(EngineLog);
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const result = await engineLogRepository.delete({
        createdAt: LessThan(oneWeekAgo)
      });

      if (result.affected > 0) {
        logger.info(`Cleaned ${result.affected} old engine logs`);
      }
      
      return result.affected;
    } catch (error) {
      logger.error('Engine log cleanup failed:', { error: error.message });
      throw error;
    }
  }

  /**
   * Force garbage collection if available
   */
  async forceGarbageCollection() {
    try {
      const freed = memoryManager.performGarbageCollection(false);
      return freed;
    } catch (error) {
      logger.error('Garbage collection failed:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get cleanup job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: !!this.interval,
      nextRunEstimate: this.interval ? 
        new Date(Date.now() + 30 * 60 * 1000).toISOString() : 
        null
    };
  }
}

// Create singleton instance
const memoryCleanupJob = new MemoryCleanupJob();

export { memoryCleanupJob as MemoryCleanupJob };