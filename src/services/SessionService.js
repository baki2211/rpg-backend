import { AppDataSource } from '../data-source.js';
import { Session } from '../models/sessionModel.js';
import { SessionParticipant } from '../models/sessionParticipantModel.js';
import { Character } from '../models/characterModel.js';

export class SessionService {
  constructor() {
    this.sessionRepository = AppDataSource.getRepository(Session);
    this.participantRepository = AppDataSource.getRepository(SessionParticipant);
    this.characterRepository = AppDataSource.getRepository(Character);
  }

  async createSession(name, locationId) {
    const session = this.sessionRepository.create({
      name,
      locationId
    });
    return await this.sessionRepository.save(session);
  }

  async getSession(sessionId) {
    return await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['participants', 'participants.character'] 
    });
  }

  async getSessionByLocation(locationId) {
    return await this.sessionRepository.findOne({
      where: { locationId },
      relations: ['participants', 'participants.character']
    });
  }

  async addParticipant(sessionId, characterId) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const character = await this.characterRepository.findOne({
      where: { id: characterId }
    });
    if (!character) {
      throw new Error('Character not found');
    }

    const participant = this.participantRepository.create({
      sessionId,
      characterId
    });

    return await this.participantRepository.save(participant);
  }

  async removeParticipant(sessionId, characterId) {
    const participant = await this.participantRepository.findOne({
      where: {
        sessionId,
        characterId
      }
    });

    if (participant) {
      await this.participantRepository.remove(participant);
    }
  }

  async getParticipants(sessionId) {
    const session = await this.getSession(sessionId);
    return session?.participants || [];
  }

  async getAllSessions() {
    try {
      const sessions = await this.sessionRepository.find({
        relations: ['participants', 'participants.character']
      });
      
      return sessions.map(session => ({
        ...session,
        participantCount: session.participants?.length || 0
      }));
    } catch (error) {
      console.error('Error in getAllSessions:', error);
      throw error;
    }
  }
  async getActiveSessionByLocation(locationId) {
    return await this.sessionRepository.findOne({
      where: { 
        locationId,
        isActive: true 
      },
      relations: ['participants']
    });
  }

  async addParticipantIfNotExists(sessionId, userId) {
    const existingParticipant = await this.participantRepository.findOne({
      where: { 
        sessionId,
        characterId: userId
      }
    });

    if (!existingParticipant) {
      return await this.addParticipant(sessionId, userId);
    }
    return existingParticipant;
  }

  async updateSessionExpiration(sessionId) {
    const expirationTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    await this.sessionRepository.update(
      { id: sessionId },
      { 
        expirationTime,
        updatedAt: new Date()
      }
    );
  }
}