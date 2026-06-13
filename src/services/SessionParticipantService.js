import { AppDataSource } from '../data-source.js';
import { Session } from '../models/sessionModel.js';
import { SessionParticipant } from '../models/sessionParticipantModel.js';
import { Character } from '../models/characterModel.js';
import { SessionService } from './SessionService.js';
import { HttpError } from '../utils/HttpError.js';
import { logger } from '../utils/logger.js';

export class SessionParticipantService {
  constructor() {
    this.sessionRepository = AppDataSource.getRepository(Session);
    this.participantRepository = AppDataSource.getRepository(SessionParticipant);
    this.characterRepository = AppDataSource.getRepository(Character);
    this.sessionService = new SessionService();
  }

  async ensureActiveSessionForLocation(locationId, userId = null, characterName = null) {
    let session = await this.sessionRepository.findOne({
      where: {
        locationId,
        isActive: true,
        status: 'open'
      },
      relations: ['participants', 'participants.character']
    });

    if (session) {
      if (userId) {
        await this.ensureUserParticipation(session.id, userId);
      }
      return session;
    }

    const sessionName = characterName
      ? `Free Role - Started by ${characterName}`
      : `Free Role - Location ${locationId}`;

    session = await this.sessionService.createSession(sessionName, locationId);

    if (userId) {
      await this.ensureUserParticipation(session.id, userId);
    }

    logger.session(`Auto-created new session for location ${locationId}`, {
      sessionId: session.id,
      startedBy: characterName || 'Unknown',
      userId
    });

    return session;
  }

  async ensureUserParticipation(sessionId, userId) {
    const character = await this.characterRepository.findOne({
      where: { userId, isActive: true }
    });

    if (!character) {
      throw new HttpError(404, 'No active character found for user');
    }

    const existingUserParticipants = await this.participantRepository.find({
      where: { sessionId },
      relations: ['character']
    });

    for (const participant of existingUserParticipants) {
      if (participant.character?.userId === userId && participant.characterId !== character.id) {
        logger.session(`Removing old participant entry for user ${userId}, character ${participant.characterId}`);
        await this.participantRepository.remove(participant);
      }
    }

    const existingParticipant = await this.participantRepository.findOne({
      where: {
        sessionId,
        characterId: character.id
      }
    });

    if (!existingParticipant) {
      logger.session(`Adding new participant: user ${userId}, character ${character.id} (${character.name})`);
      return await this.addParticipant(sessionId, character.id);
    }

    return existingParticipant;
  }

  async addParticipant(sessionId, characterId) {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new HttpError(404, 'Session not found');
    }

    const character = await this.characterRepository.findOne({
      where: { id: characterId }
    });
    if (!character) {
      throw new HttpError(404, 'Character not found');
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
    const session = await this.sessionService.getSession(sessionId);
    return session?.participants || [];
  }

  async getLocationParticipants(locationId) {
    const session = await this.sessionService.getSessionByLocation(locationId);
    if (!session) {
      return [];
    }

    return session.participants?.map(participant => ({
      userId: participant.character?.userId || participant.characterId,
      username: participant.character?.name || 'Unknown',
      characterName: participant.character?.name
    })) || [];
  }
}
