import { AppDataSource } from '../data-source.js';
import { Session } from '../models/sessionModel.js';
import { SessionParticipant } from '../models/sessionParticipantModel.js';
import { Character } from '../models/characterModel.js';
import { Location } from '../models/locationModel.js';
import { logger } from '../utils/logger.js';

export class SessionService {
  constructor() {
    this.sessionRepository = AppDataSource.getRepository(Session);
    this.participantRepository = AppDataSource.getRepository(SessionParticipant);
    this.characterRepository = AppDataSource.getRepository(Character);
  }

  async createSession(name, locationId) {
    const session = this.sessionRepository.create({
      name,
      locationId,
      isActive: true,  // Explicitly set as active
      status: 'open'   // Explicitly set status
    });
    const savedSession = await this.sessionRepository.save(session);
    logger.session(`Created new session: ${name} at location ${locationId}`, { sessionId: savedSession.id });
    return savedSession;
  }

  /**
   * Ensure there's an active session for a location, creating one if needed
   * This is the main method for auto-creating sessions when users send messages
   * @param {number} locationId - The location ID
   * @param {number} userId - The user ID sending the message
   * @param {string} characterName - The character name for logging
   * @returns {Promise<Object>} The session object
   */
  async ensureActiveSessionForLocation(locationId, userId = null, characterName = null) {
    // Try to find an existing active open session
    let session = await this.sessionRepository.findOne({
      where: { 
        locationId, 
        isActive: true,
        status: 'open'
      },
      relations: ['participants', 'participants.character']
    });

    if (session) {
      // If user provided, ensure they're a participant
      if (userId) {
        await this.ensureUserParticipation(session.id, userId);
      }
      return session;
    }

    // No active open session found, create a new free role session
    const sessionName = characterName ? 
      `Free Role - Started by ${characterName}` : 
      `Free Role - Location ${locationId}`;

    session = await this.createSession(sessionName, locationId);
    
    // Add the user as the first participant if provided
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

  /**
   * Ensure a user is a participant in a session
   * @param {number} sessionId - The session ID
   * @param {number} userId - The user ID
   * @returns {Promise<Object>} The participant object
   */
  async ensureUserParticipation(sessionId, userId) {
    // Get the user's active character
    const character = await this.characterRepository.findOne({
      where: { userId, isActive: true }
    });

    if (!character) {
      throw new Error('No active character found for user');
    }

    // Remove any existing participants for this user in this session
    // This handles the case where a user switched characters
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

    // Check if current character is already a participant
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
        relations: ['participants', 'participants.character', 'event'],
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
        })) || [],
        event: session.event ? {
          id: session.event.id,
          title: session.event.title,
          type: session.event.type,
          status: session.event.status
        } : undefined
      }));
    } catch (error) {
      console.error('Error in getAllSessions:', error);
      throw error;
    }
  }

  async getActiveSessionByLocation(locationId) {
    const session = await this.sessionRepository.findOne({
      where: { 
        locationId,
        isActive: true,
        status: 'open'  // Only find open sessions, not closed or frozen ones
      },
      relations: ['participants']
    });
    
    return session;
  }

  async addParticipantIfNotExists(sessionId, characterId) {
    // Get the character and its user to handle potential duplicates
    const character = await this.characterRepository.findOne({
      where: { id: characterId },
      relations: ['user']
    });
    
    if (!character) {
      throw new Error('Character not found');
    }

    // Remove any existing participants for this user in this session
    // This handles the case where a user switched characters
    const existingUserParticipants = await this.participantRepository.find({
      where: { sessionId },
      relations: ['character']
    });

    for (const participant of existingUserParticipants) {
      if (participant.character?.userId === character.userId && participant.characterId !== characterId) {
        logger.session(`Removing old participant entry for user ${character.userId}, character ${participant.characterId}`);
        await this.participantRepository.remove(participant);
      }
    }

    // Check if current character is already a participant
    const existingParticipant = await this.participantRepository.findOne({
      where: { 
        sessionId,
        characterId: characterId
      }
    });

    if (!existingParticipant) {
      logger.session(`Adding new participant: user ${character.userId}, character ${characterId}`);
      return await this.addParticipant(sessionId, characterId);
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

  /**
   * Update session status with improved freeze/unfreeze logic
   * @param {number} sessionId - The session ID
   * @param {string} status - The new status ('open', 'frozen', 'closed')
   * @returns {Promise<Object>} Updated session
   */
  async updateSessionStatus(sessionId, status) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const oldStatus = session.status;
    
    // Update the session status
    await this.sessionRepository.update(
      { id: sessionId },
      { status, updatedAt: new Date() }
    );

    const updatedSession = await this.getSession(sessionId);
    
    logger.session(`Session ${sessionId} status changed from ${oldStatus} to ${status}`, {
      sessionId,
      locationId: session.locationId,
      oldStatus,
      newStatus: status
    });

    return updatedSession;
  }

  /**
   * Freeze a session - just changes status, chat remains visible
   * @param {number} sessionId - The session ID
   * @returns {Promise<Object>} Updated session
   */
  async freezeSession(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === 'frozen') {
      logger.session(`Session ${sessionId} is already frozen`);
      return session;
    }

    // Simply change status to frozen - chat messages remain visible
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

    return await this.getSession(sessionId);
  }

  /**
   * Unfreeze a session - changes status back to open
   * @param {number} sessionId - The session ID
   * @returns {Promise<Object>} Updated session
   */
  async unfreezeSession(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'frozen') {
      logger.session(`Session ${sessionId} is not frozen (status: ${session.status})`);
      return session;
    }

    // Simply change status back to open
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

    return await this.getSession(sessionId);
  }

  async updateSessionActive(sessionId, isActive) {
    await this.sessionRepository.update(
      { id: sessionId },
      { isActive, updatedAt: new Date() }
    );
    return await this.getSession(sessionId);
  }

  /**
   * Close a session and mark it as closed
   * @param {number} sessionId - The session ID
   * @param {string} reason - Reason for closing
   * @returns {Promise<Object>} Updated session
   */
  async closeSession(sessionId, reason = 'Manual close') {
    const session = await this.getSession(sessionId);
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

  /**
   * Get all sessions (active, frozen, and closed) for logging/admin purposes
   * @param {number} limit - Maximum number of sessions to return
   * @returns {Promise<Array>} Array of all sessions
   */
  async getAllSessionsForLogs(limit = 100) {
    try {
      const sessions = await this.sessionRepository.find({
        relations: ['participants', 'participants.character', 'event'],
        order: { updatedAt: 'DESC' },
        take: limit
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
          userId: participant.character?.userId,
          joinedAt: participant.joinedAt
        })) || [],
        event: session.event ? {
          id: session.event.id,
          title: session.event.title,
          type: session.event.type,
          status: session.event.status
        } : undefined
      }));
    } catch (error) {
      console.error('Error in getAllSessionsForLogs:', error);
      throw error;
    }
  }
}