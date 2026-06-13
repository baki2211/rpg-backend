import { AppDataSource } from '../data-source.js';
import { Session } from '../models/sessionModel.js';
import { Location } from '../models/locationModel.js';

export class SessionQueryService {
  constructor() {
    this.sessionRepository = AppDataSource.getRepository(Session);
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

      const locationIds = [...new Set(sessions.map(session => session.locationId))];
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

  async getClosedSessions() {
    try {
      const sessions = await this.sessionRepository.find({
        where: { status: 'closed' },
        relations: ['participants', 'participants.character'],
        order: { updatedAt: 'DESC' }
      });

      const locationIds = [...new Set(sessions.map(session => session.locationId))];
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

  async getAllSessionsForLogs(limit = 100) {
    try {
      const sessions = await this.sessionRepository.find({
        relations: ['participants', 'participants.character', 'event'],
        order: { updatedAt: 'DESC' },
        take: limit
      });

      const locationIds = [...new Set(sessions.map(session => session.locationId))];
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
