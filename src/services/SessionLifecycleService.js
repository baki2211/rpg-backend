import { AppDataSource } from '../data-source.js';
import { Session } from '../models/sessionModel.js';
import { SessionService } from './SessionService.js';
import { logger } from '../utils/logger.js';

export class SessionLifecycleService {
  constructor() {
    this.sessionRepository = AppDataSource.getRepository(Session);
    this.sessionService = new SessionService();
  }

  async updateSessionStatus(sessionId, status) {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const oldStatus = session.status;

    await this.sessionRepository.update(
      { id: sessionId },
      { status, updatedAt: new Date() }
    );

    const updatedSession = await this.sessionService.getSession(sessionId);

    logger.session(`Session ${sessionId} status changed from ${oldStatus} to ${status}`, {
      sessionId,
      locationId: session.locationId,
      oldStatus,
      newStatus: status
    });

    return updatedSession;
  }

  async freezeSession(sessionId) {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === 'frozen') {
      logger.session(`Session ${sessionId} is already frozen`);
      return session;
    }

    await this.sessionRepository.update(
      { id: sessionId },
      {
        status: 'frozen',
        updatedAt: new Date()
      }
    );

    logger.session(`Session ${sessionId} frozen - chat remains visible`, {
      sessionId,
      locationId: session.locationId,
      participantCount: session.participants?.length || 0
    });

    return await this.sessionService.getSession(sessionId);
  }

  async unfreezeSession(sessionId) {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'frozen') {
      logger.session(`Session ${sessionId} is not frozen (status: ${session.status})`);
      return session;
    }

    await this.sessionRepository.update(
      { id: sessionId },
      {
        status: 'open',
        updatedAt: new Date()
      }
    );

    logger.session(`Session ${sessionId} unfrozen - chat remains as it was`, {
      sessionId,
      locationId: session.locationId,
      participantCount: session.participants?.length || 0
    });

    return await this.sessionService.getSession(sessionId);
  }

  async closeSession(sessionId, reason = 'Manual close') {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    await this.sessionRepository.update(
      { id: sessionId },
      {
        status: 'closed',
        isActive: false,
        updatedAt: new Date()
      }
    );

    logger.session(`Session ${sessionId} closed: ${reason}`, {
      sessionId,
      locationId: session.locationId,
      participantCount: session.participants?.length || 0,
      reason
    });

    return await this.sessionService.getSession(sessionId);
  }
}
