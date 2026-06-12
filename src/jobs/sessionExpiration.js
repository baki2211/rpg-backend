import { AppDataSource } from '../data-source.js';
import { Session } from '../models/sessionModel.js';
import { LessThan } from 'typeorm';
import { withAdvisoryLock, JOB_LOCK_KEYS } from '../utils/advisoryLock.js';

export class SessionExpirationJob {
  static async checkExpiredSessions() {
    // Safety check: ensure data source is initialized
    if (!AppDataSource.isInitialized) {
      return;
    }

    // Only one instance should run this when scaled horizontally.
    await withAdvisoryLock(JOB_LOCK_KEYS.SESSION_EXPIRATION, async () => {
      const sessionRepository = AppDataSource.getRepository(Session);

      try {
        const result = await sessionRepository.update(
          {
            isActive: true,
            expirationTime: LessThan(new Date())
          },
          {
            isActive: false,
            updatedAt: new Date()
          }
        );

        if (result.affected > 0) {
          console.log(`Closed ${result.affected} expired sessions`);
        }
      } catch (error) {
        console.error('Error checking expired sessions:', error);
      }
    });
  }

  static startJob() {
    // Run immediately on startup
    this.checkExpiredSessions();
    
    // Then run every minute
    return setInterval(() => {
      this.checkExpiredSessions();
    }, 60000);
  }
}