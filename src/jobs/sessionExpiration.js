import { AppDataSource } from '../data-source.js';
import { Session } from '../models/sessionModel.js';
import { LessThan } from 'typeorm';

export class SessionExpirationJob {
  static async checkExpiredSessions() {
    // Safety check: ensure data source is initialized
    if (!AppDataSource.isInitialized) {
      return;
    }

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