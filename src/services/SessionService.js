import { AppDataSource } from '../data-source.js';
import { Session } from '../models/sessionModel.js';
import { logger } from '../utils/logger.js';

export class SessionService {
  constructor() {
    this.sessionRepository = AppDataSource.getRepository(Session);
  }

  async createSession(name, locationId) {
    const session = this.sessionRepository.create({
      name,
      locationId,
      isActive: true,
      status: 'open'
    });
    const savedSession = await this.sessionRepository.save(session);
    logger.session(`Created new session: ${name} at location ${locationId}`, { sessionId: savedSession.id });
    return savedSession;
  }

  async getSession(sessionId) {
    return await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: { participants: { character: true } }
    });
  }

  async getSessionByLocation(locationId) {
    return await this.sessionRepository.findOne({
      where: { locationId },
      relations: { participants: { character: true } }
    });
  }

  async getActiveSessionByLocation(locationId) {
    return await this.sessionRepository.findOne({
      where: {
        locationId,
        isActive: true,
        status: 'open'
      },
      relations: { participants: true }
    });
  }

  async updateSessionActive(sessionId, isActive) {
    await this.sessionRepository.update(
      { id: sessionId },
      { isActive, updatedAt: new Date() }
    );
    return await this.getSession(sessionId);
  }
}
