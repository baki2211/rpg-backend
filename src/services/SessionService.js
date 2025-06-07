import { AppDataSource } from '../data-source.js';
import { Session } from '../models/sessionModel.js';
import { SessionParticipant } from '../models/sessionParticipantModel.js';
import { Character } from '../models/characterModel.js';
import { Location } from '../models/locationModel.js';

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
        where: [
          { status: 'open' },
          { status: 'frozen' }
        ],
        relations: ['participants', 'participants.character']
      });
      
      // Get all unique location IDs
      const locationIds = [...new Set(sessions.map(session => session.locationId))];
      
      // Fetch location data
      const locationRepository = AppDataSource.getRepository(Location);
      const locations = await locationRepository.findByIds(locationIds);
      const locationMap = new Map(locations.map(loc => [loc.id, loc]));
      
      return sessions.map(session => ({
        ...session,
        location: locationMap.get(session.locationId),
        participantCount: session.participants?.length || 0,
        participants: session.participants?.map(participant => ({
          id: participant.id,
          characterName: participant.character?.name || 'Unknown',
          joinedAt: participant.joinedAt
        })) || []
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

  async getLocationParticipants(locationId) {
    try {
      const session = await this.getSessionByLocation(locationId);
      if (!session) {
        return [];
      }

      // Return participants with character information formatted for chat users
      return session.participants?.map(participant => ({
        userId: participant.character?.userId || participant.characterId,
        username: participant.character?.name || 'Unknown',
        characterName: participant.character?.name
      })) || [];
    } catch (error) {
      console.error('Error in getLocationParticipants:', error);
      return [];
    }
  }

  async updateSessionStatus(sessionId, status) {
    // If freezing the session, save the current chat state
    if (status === 'frozen') {
      await this.freezeSession(sessionId);
    } else if (status === 'open') {
      // If unfreezing, restore the saved chat state
      await this.unfreezeSession(sessionId);
    }
    
    await this.sessionRepository.update(
      { id: sessionId },
      { status, updatedAt: new Date() }
    );
    return await this.getSession(sessionId);
  }

  async freezeSession(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Get current chat messages for this location
    const { ChatMessage } = await import('../models/chatMessageModel.js');
    const chatRepository = AppDataSource.getRepository(ChatMessage);
    
    const currentMessages = await chatRepository.find({
      where: { location: { id: session.locationId } },
      order: { createdAt: 'ASC' }
    });

    // Save the session state
    const sessionState = {
      messages: currentMessages,
      participants: session.participants,
      frozenAt: new Date(),
      locationId: session.locationId
    };

    // Store the frozen state in the session
    await this.sessionRepository.update(
      { id: sessionId },
      { 
        frozenState: JSON.stringify(sessionState),
        updatedAt: new Date()
      }
    );

    // Clear current chat messages (they're now frozen)
    await chatRepository.delete({ location: { id: session.locationId } });
    
    console.log(`📦 Session ${sessionId} frozen with ${currentMessages.length} messages saved`);
  }

  async unfreezeSession(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session || !session.frozenState) {
      console.log(`❄️ Session ${sessionId} has no frozen state to restore`);
      return;
    }

    try {
      const sessionState = JSON.parse(session.frozenState);
      
      // Restore chat messages
      const { ChatMessage } = await import('../models/chatMessageModel.js');
      const chatRepository = AppDataSource.getRepository(ChatMessage);
      
      // Clear any current messages first
      await chatRepository.delete({ location: { id: session.locationId } });
      
      // Restore the frozen messages
      for (const message of sessionState.messages) {
        const restoredMessage = chatRepository.create({
          ...message,
          id: undefined, // Let the database assign new IDs
          location: { id: session.locationId },
          createdAt: message.createdAt,
          updatedAt: new Date()
        });
        await chatRepository.save(restoredMessage);
      }

      // Clear the frozen state
      await this.sessionRepository.update(
        { id: sessionId },
        { 
          frozenState: null,
          updatedAt: new Date()
        }
      );
      
      console.log(`🔥 Session ${sessionId} unfrozen with ${sessionState.messages.length} messages restored`);
    } catch (error) {
      console.error('Error unfreezing session:', error);
      throw new Error('Failed to restore frozen session state');
    }
  }

  async updateSessionActive(sessionId, isActive) {
    await this.sessionRepository.update(
      { id: sessionId },
      { isActive, updatedAt: new Date() }
    );
    return await this.getSession(sessionId);
  }

  async getClosedSessions() {
    try {
      const sessions = await this.sessionRepository.find({
        where: { status: 'closed' },
        relations: ['participants', 'participants.character'],
        order: { updatedAt: 'DESC' }
      });
      
      // Get all unique location IDs
      const locationIds = [...new Set(sessions.map(session => session.locationId))];
      
      // Fetch location data
      const locationRepository = AppDataSource.getRepository(Location);
      const locations = await locationRepository.findByIds(locationIds);
      const locationMap = new Map(locations.map(loc => [loc.id, loc]));
      
      return sessions.map(session => ({
        ...session,
        location: locationMap.get(session.locationId),
        participantCount: session.participants?.length || 0,
        participants: session.participants?.map(participant => ({
          id: participant.id,
          characterName: participant.character?.name || 'Unknown',
          joinedAt: participant.joinedAt
        })) || []
      }));
    } catch (error) {
      console.error('Error in getClosedSessions:', error);
      throw error;
    }
  }
}