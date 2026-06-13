import { AppDataSource } from '../data-source.js';
import { Session } from '../models/sessionModel.js';
import { Location } from '../models/locationModel.js';

export class SessionQueryService {
  constructor() {
    this.sessionRepository = AppDataSource.getRepository(Session);
  }

  async getAllSessions() {
    const sessions = await this.sessionRepository.find({
      where: [
        { status: 'open' },
        { status: 'frozen' }
      ],
      relations: { participants: { character: true }, event: true },
      order: { updatedAt: 'DESC' }
    });

    const locationMap = await this.loadLocations(sessions);

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
  }

  async getClosedSessions() {
    const sessions = await this.sessionRepository.find({
      where: { status: 'closed' },
      relations: { participants: { character: true } },
      order: { updatedAt: 'DESC' }
    });

    const locationMap = await this.loadLocations(sessions);

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
  }

  async getAllSessionsForLogs(limit = 100) {
    const sessions = await this.sessionRepository.find({
      relations: { participants: { character: true }, event: true },
      order: { updatedAt: 'DESC' },
      take: limit
    });

    const locationMap = await this.loadLocations(sessions);

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
  }

  async loadLocations(sessions) {
    const locationIds = [...new Set(sessions.map(session => session.locationId))];
    const locationRepository = AppDataSource.getRepository(Location);
    const locations = await locationRepository.findByIds(locationIds);
    return new Map(locations.map(loc => [loc.id, loc]));
  }
}
