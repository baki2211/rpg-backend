import { AppDataSource } from '../data-source.js';
import { CombatRound } from '../models/combatRoundModel.js';
import { CombatAction } from '../models/combatActionModel.js';
import { HttpError } from '../utils/HttpError.js';

export class CombatService {
    constructor() {
        this.roundRepository = AppDataSource.getRepository(CombatRound);
        this.actionRepository = AppDataSource.getRepository(CombatAction);
    }

    /**
     * Create a new combat round
     * @param {number} locationId - The location where combat is taking place
     * @param {number} createdBy - User ID of the master creating the round
     * @param {number} sessionId - Optional session ID
     * @param {number} eventId - Optional event ID
     * @returns {Promise<Object>} The created combat round
     */
    async createRound(locationId, createdBy, sessionId = null, eventId = null) {
        if (!sessionId) {
            const { SessionService } = await import('./SessionService.js');
            const sessionService = new SessionService();

            let activeSession = await sessionService.getActiveSessionByLocation(locationId);

            if (!activeSession) {
                activeSession = await sessionService.createSession(
                    `Auto-created for Location ${locationId}`,
                    locationId
                );
            }

            sessionId = activeSession.id;
        }

        let roundNumber = 1;

        if (eventId) {
            const lastEventRound = await this.roundRepository.findOne({
                where: { eventId },
                order: { roundNumber: 'DESC' }
            });
            roundNumber = lastEventRound ? lastEventRound.roundNumber + 1 : 1;
        } else {
            const lastLocationRound = await this.roundRepository.findOne({
                where: { locationId, eventId: null },
                order: { roundNumber: 'DESC' }
            });
            roundNumber = lastLocationRound ? lastLocationRound.roundNumber + 1 : 1;
        }

        const round = this.roundRepository.create({
            roundNumber,
            locationId,
            sessionId,
            eventId,
            createdBy,
            status: 'active'
        });

        return await this.roundRepository.save(round);
    }

    /**
     * Get all actions for a specific round
     * @param {number} roundId - The combat round ID
     * @returns {Promise<Array>} Array of combat actions
     */
    async getRoundActions(roundId) {
        return await this.actionRepository.find({
            where: { roundId },
            relations: ['character', 'skill', 'target'],
            order: { submittedAt: 'ASC' }
        });
    }

    /**
     * Get active round for a location
     * @param {number} locationId - The location ID
     * @param {number} eventId - Optional event ID to filter by
     * @returns {Promise<Object|null>} The active round or null
     */
    async getActiveRound(locationId, eventId = null) {
        const whereCondition = { locationId, status: 'active' };

        if (eventId !== null) {
            whereCondition.eventId = eventId;
        }

        return await this.roundRepository.findOne({
            where: whereCondition,
            relations: ['actions', 'actions.character', 'actions.skill', 'actions.target']
        });
    }

    /**
     * Get resolved rounds for a location
     * @param {number} locationId - The location ID
     * @param {number} limit - Maximum number of rounds to return
     * @param {number} eventId - Optional event ID to filter by
     * @returns {Promise<Array>} Array of resolved rounds
     */
    async getResolvedRounds(locationId, limit = 10, eventId = null) {
        const whereCondition = { locationId, status: 'resolved' };

        if (eventId !== null) {
            whereCondition.eventId = eventId;
        }

        return await this.roundRepository.find({
            where: whereCondition,
            order: { resolvedAt: 'DESC' },
            take: limit
        });
    }

    /**
     * Cancel an active round
     * @param {number} roundId - The combat round ID
     * @param {number} cancelledBy - User ID cancelling the round
     * @returns {Promise<Object>} Updated round
     */
    async cancelRound(roundId, cancelledBy) {
        const result = await this.roundRepository.update(
            { id: roundId, status: 'active' },
            {
                status: 'cancelled',
                resolvedBy: cancelledBy,
                resolvedAt: new Date()
            }
        );

        if (result.affected === 0) {
            throw new HttpError(404, 'Combat round not found or not active');
        }

        return await this.roundRepository.findOne({ where: { id: roundId } });
    }
}
