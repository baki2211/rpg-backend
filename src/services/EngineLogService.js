import { AppDataSource } from '../data-source.js';
import { EngineLog } from '../models/engineLogModel.js';
import { SessionService } from './SessionService.js';

export class EngineLogService {
    constructor() {
        this.engineLogRepository = AppDataSource.getRepository(EngineLog);
        this.sessionService = new SessionService();
    }

    /**
     * Create a new engine log entry
     * @param {number} locationId - Location where the action occurred
     * @param {string} type - Type of log ('skill_use', 'clash', 'damage', 'effect')
     * @param {string} actor - Character name who performed the action
     * @param {string} target - Target character name (optional)
     * @param {string} skill - Skill name used (optional)
     * @param {number} damage - Damage dealt (optional)
     * @param {Array} effects - Array of effects (optional)
     * @param {string} details - Detailed description
     * @param {Object} engineData - Additional engine calculation data (optional)
     * @returns {Promise<Object>} The created engine log
     */
    async createEngineLog(locationId, type, actor, target = null, skill = null, damage = null, effects = null, details, engineData = null) {
        try {
            // Get the active session for this location
            let activeSession = await this.sessionService.getActiveSessionByLocation(locationId);
            
            if (!activeSession) {
                // Create a session if none exists
                activeSession = await this.sessionService.createSession(
                    `Auto-created for Location ${locationId}`,
                    locationId
                );
            }

            const engineLog = this.engineLogRepository.create({
                sessionId: activeSession.id,
                locationId,
                type,
                actor,
                target,
                skill,
                damage,
                effects,
                details,
                engineData
            });

            const savedLog = await this.engineLogRepository.save(engineLog);
            return savedLog;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get engine logs for a specific session
     * @param {number} sessionId - The session ID
     * @param {number} limit - Maximum number of logs to return (default: 50)
     * @returns {Promise<Array>} Array of engine logs
     */
    async getLogsBySession(sessionId, limit = 50) {
        return await this.engineLogRepository.find({
            where: { sessionId },
            order: { createdAt: 'DESC' },
            take: limit
        });
    }

    /**
     * Get engine logs for a specific location (current active session)
     * @param {number} locationId - The location ID
     * @param {number} limit - Maximum number of logs to return (default: 50)
     * @returns {Promise<Array>} Array of engine logs
     */
    async getLogsByLocation(locationId, limit = 50) {
        try {
            const activeSession = await this.sessionService.getActiveSessionByLocation(locationId);
            
            if (!activeSession) {
                return [];
            }

            return await this.getLogsBySession(activeSession.id, limit);
        } catch (error) {
            console.error('Error fetching engine logs by location:', error);
            return [];
        }
    }

    /**
     * Get engine logs by type for a session
     * @param {number} sessionId - The session ID
     * @param {string} type - The log type to filter by
     * @param {number} limit - Maximum number of logs to return (default: 50)
     * @returns {Promise<Array>} Array of engine logs
     */
    async getLogsBySessionAndType(sessionId, type, limit = 50) {
        return await this.engineLogRepository.find({
            where: { sessionId, type },
            order: { createdAt: 'DESC' },
            take: limit
        });
    }

    /**
     * Get engine logs for all sessions of a specific event
     * @param {number} eventId - The event ID
     * @returns {Promise<Array>} Array of engine logs
     */
    async getLogsByEvent(eventId) {
        const query = `
            SELECT el.* 
            FROM engine_logs el
            JOIN sessions s ON el.sessionId = s.id
            WHERE s.eventId = ?
            ORDER BY el.createdAt DESC
        `;
        
        return await AppDataSource.query(query, [eventId]);
    }

    /**
     * Clear old engine logs (for cleanup)
     * @param {number} daysOld - Delete logs older than this many days
     * @returns {Promise<number>} Number of deleted logs
     */
    async clearOldLogs(daysOld = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const result = await this.engineLogRepository
            .createQueryBuilder()
            .delete()
            .where('createdAt < :cutoffDate', { cutoffDate })
            .execute();

        return result.affected || 0;
    }

    /**
     * Create a skill usage log
     * @param {number} locationId - Location ID
     * @param {string} characterName - Character who used the skill
     * @param {string} skillName - Name of the skill used
     * @param {string} target - Target of the skill (optional)
     * @param {number} finalOutput - Final output value from skill engine
     * @param {Object} engineData - Additional engine calculation data
     * @returns {Promise<Object>} The created log
     */
    async logSkillUsage(locationId, characterName, skillName, target, finalOutput, engineData) {
        const details = target && target !== characterName
            ? `${characterName} used ${skillName} on ${target} (Output: ${finalOutput})`
            : `${characterName} used ${skillName} (Output: ${finalOutput})`;

        return await this.createEngineLog(
            locationId,
            'skill_use',
            characterName,
            target,
            skillName,
            null,
            [`Final Output: ${finalOutput}`, `Base Power: ${engineData.basePower}`, `Roll Quality: ${engineData.rollQuality}`],
            details,
            engineData
        );
    }

    /**
     * Create a clash resolution log
     * @param {number} locationId - Location ID
     * @param {Object} clashResult - Result from clash resolution
     * @returns {Promise<Object>} The created log
     */
    async logClashResolution(locationId, clashResult) {
        const details = `Clash resolved: ${clashResult.winner} wins with ${clashResult.damage} damage`;

        return await this.createEngineLog(
            locationId,
            'clash',
            clashResult.participants[0].character,
            clashResult.participants[1].character,
            null,
            clashResult.damage,
            clashResult.effects,
            details,
            clashResult
        );
    }
} 