import { AppDataSource } from '../data-source.js';
import { Event } from '../models/eventModel.js';
import { CombatRound } from '../models/combatRoundModel.js';
import { Session } from '../models/sessionModel.js';
import { SessionService } from './SessionService.js';

export class EventService {
    constructor() {
        this.eventRepository = AppDataSource.getRepository(Event);
        this.roundRepository = AppDataSource.getRepository(CombatRound);
        this.sessionRepository = AppDataSource.getRepository(Session);
        this.sessionService = new SessionService();
    }

    /**
     * Create a new event and transform existing session
     * @param {string} title - The event title
     * @param {string} type - The event type (lore, duel, quest)
     * @param {number} locationId - The location where the event takes place
     * @param {number} createdBy - User ID of the master creating the event
     * @param {string} description - Optional event description
     * @returns {Promise<Object>} The created event with session info
     */
    async createEvent(title, type, locationId, createdBy, description = null) {
        // Validate event type
        const validTypes = ['lore', 'duel', 'quest'];
        if (!validTypes.includes(type.toLowerCase())) {
            throw new Error('Invalid event type. Must be one of: lore, duel, quest');
        }

        // Check if there's already an active event for this location
        const existingEvent = await this.eventRepository.findOne({
            where: { locationId, status: 'active' }
        });

        if (existingEvent) {
            throw new Error('There is already an active event in this location. Close it first.');
        }

        return await AppDataSource.transaction(async (manager) => {
            const eventRepo = manager.getRepository(Event);
            const sessionRepo = manager.getRepository(Session);

            // Get or create session for this location
            let session = await sessionRepo.findOne({
                where: { locationId, isActive: true }
            });

            if (!session) {
                // Create new session if none exists
                session = sessionRepo.create({
                    name: `Free Role - Location ${locationId}`,
                    locationId,
                    isEvent: false,
                    isActive: true,
                    status: 'open'
                });
                session = await sessionRepo.save(session);
            }

            // Create the event
            const event = eventRepo.create({
                title,
                type: type.toLowerCase(),
                description,
                locationId,
                sessionId: session.id,
                createdBy,
                status: 'active'
            });

            const savedEvent = await eventRepo.save(event);

            // Transform session to event role
            await sessionRepo.update(session.id, { 
                name: `Event: ${title}`,
                isEvent: true,
                eventId: savedEvent.id
            });

            // Get updated session
            const updatedSession = await sessionRepo.findOne({ where: { id: session.id } });

            return {
                event: savedEvent,
                session: updatedSession,
                transformation: 'free_role_to_event'
            };
        });
    }

    /**
     * Close an active event and revert session to free role
     * @param {number} eventId - The event ID to close
     * @param {number} closedBy - User ID of the master closing the event
     * @returns {Promise<Object>} The closed event with session info
     */
    async closeEvent(eventId, closedBy) {
        return await AppDataSource.transaction(async (manager) => {
            const eventRepo = manager.getRepository(Event);
            const roundRepo = manager.getRepository(CombatRound);
            const sessionRepo = manager.getRepository(Session);

            // Get the event
            const event = await eventRepo.findOne({
                where: { id: eventId, status: 'active' },
                relations: ['rounds']
            });

            if (!event) {
                throw new Error('Event not found or already closed');
            }

            // Get all rounds for this event
            const rounds = await roundRepo.find({
                where: { eventId },
                relations: ['actions']
            });

            // Create event summary
            const eventSummary = {
                totalRounds: rounds.length,
                resolvedRounds: rounds.filter(r => r.status === 'resolved').length,
                cancelledRounds: rounds.filter(r => r.status === 'cancelled').length,
                totalActions: rounds.reduce((sum, round) => sum + (round.actions?.length || 0), 0),
                roundDetails: rounds.map(round => ({
                    roundNumber: round.roundNumber,
                    status: round.status,
                    actionCount: round.actions?.length || 0,
                    createdAt: round.createdAt,
                    resolvedAt: round.resolvedAt
                }))
            };

            // Revert session back to free role
            if (event.sessionId) {
                await sessionRepo.update(event.sessionId, { 
                    name: `Free Role - Location ${event.locationId}`,
                    isEvent: false,
                    eventId: null
                });
            }

            // Close the event
            await eventRepo.update(
                { id: eventId },
                {
                    status: 'closed',
                    closedBy,
                    closedAt: new Date(),
                    eventData: eventSummary
                }
            );

            const closedEvent = await eventRepo.findOne({ where: { id: eventId } });
            const revertedSession = await sessionRepo.findOne({ where: { id: event.sessionId } });

            return {
                event: closedEvent,
                session: revertedSession,
                transformation: 'event_to_free_role'
            };
        });
    }

    /**
     * Freeze an event (and its session)
     * @param {number} eventId - The event ID
     * @param {number} frozenBy - User ID performing the action
     * @returns {Promise<Object>} Updated event and session
     */
    async freezeEvent(eventId, frozenBy) {
        const event = await this.eventRepository.findOne({
            where: { id: eventId, status: 'active' }
        });

        if (!event) {
            throw new Error('Event not found or not active');
        }

        if (event.sessionId) {
            await this.sessionService.updateSessionStatus(event.sessionId, 'frozen');
        }

        return {
            event,
            session: await this.sessionService.getSession(event.sessionId),
            action: 'frozen'
        };
    }

    /**
     * Unfreeze an event (and its session)
     * @param {number} eventId - The event ID
     * @param {number} unfrozenBy - User ID performing the action
     * @returns {Promise<Object>} Updated event and session
     */
    async unfreezeEvent(eventId, unfrozenBy) {
        const event = await this.eventRepository.findOne({
            where: { id: eventId, status: 'active' }
        });

        if (!event) {
            throw new Error('Event not found or not active');
        }

        if (event.sessionId) {
            await this.sessionService.updateSessionStatus(event.sessionId, 'open');
        }

        return {
            event,
            session: await this.sessionService.getSession(event.sessionId),
            action: 'unfrozen'
        };
    }

    /**
     * Get active event for a location
     * @param {number} locationId - The location ID
     * @returns {Promise<Object|null>} The active event or null
     */
    async getActiveEvent(locationId) {
        return await this.eventRepository.findOne({
            where: { locationId, status: 'active' },
            relations: ['rounds', 'rounds.actions', 'session']
        });
    }

    /**
     * Get all events for a location
     * @param {number} locationId - The location ID
     * @param {number} limit - Maximum number of events to return
     * @param {string} status - Optional status filter ('active', 'closed', or null for all)
     * @returns {Promise<Array>} Array of events
     */
    async getEventsByLocation(locationId, limit = 10, status = null) {
        const whereCondition = { locationId };
        if (status) {
            whereCondition.status = status;
        }

        return await this.eventRepository.find({
            where: whereCondition,
            relations: ['rounds', 'session'],
            order: { createdAt: 'DESC' },
            take: limit
        });
    }

    /**
     * Get event by ID with full details
     * @param {number} eventId - The event ID
     * @returns {Promise<Object|null>} The event with rounds and actions
     */
    async getEventById(eventId) {
        return await this.eventRepository.findOne({
            where: { id: eventId },
            relations: ['rounds', 'rounds.actions', 'rounds.actions.character', 'rounds.actions.skill', 'session']
        });
    }

    /**
     * Get event statistics
     * @param {number} eventId - The event ID
     * @returns {Promise<Object>} Event statistics
     */
    async getEventStatistics(eventId) {
        const event = await this.getEventById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        const rounds = event.rounds || [];
        const allActions = rounds.flatMap(round => round.actions || []);

        // Character participation statistics
        const characterStats = {};
        allActions.forEach(action => {
            const charName = action.characterData?.name || 'Unknown';
            if (!characterStats[charName]) {
                characterStats[charName] = {
                    totalActions: 0,
                    skillsUsed: new Set(),
                    totalOutput: 0,
                    avgOutput: 0
                };
            }
            characterStats[charName].totalActions++;
            characterStats[charName].skillsUsed.add(action.skillData?.name || 'Unknown');
            characterStats[charName].totalOutput += action.finalOutput || 0;
        });

        // Calculate averages
        Object.values(characterStats).forEach(stats => {
            stats.avgOutput = stats.totalActions > 0 ? Math.round(stats.totalOutput / stats.totalActions) : 0;
            stats.skillsUsed = Array.from(stats.skillsUsed);
        });

        return {
            event: {
                id: event.id,
                title: event.title,
                type: event.type,
                status: event.status,
                duration: event.closedAt ? 
                    Math.round((new Date(event.closedAt) - new Date(event.createdAt)) / (1000 * 60)) : 
                    Math.round((new Date() - new Date(event.createdAt)) / (1000 * 60))
            },
            rounds: {
                total: rounds.length,
                resolved: rounds.filter(r => r.status === 'resolved').length,
                cancelled: rounds.filter(r => r.status === 'cancelled').length,
                active: rounds.filter(r => r.status === 'active').length
            },
            actions: {
                total: allActions.length,
                averagePerRound: rounds.length > 0 ? Math.round(allActions.length / rounds.length * 10) / 10 : 0
            },
            participants: characterStats
        };
    }
} 