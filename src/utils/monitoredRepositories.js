import { AppDataSource } from '../data-source.js';
import { queryMonitor } from './queryMonitor.js';

/**
 * Factory for creating monitored repository instances
 * Automatically wraps repositories with query performance tracking
 */
class MonitoredRepositoryFactory {
    constructor() {
        this.cachedRepositories = new Map();
    }

    /**
     * Get a monitored repository instance
     * @param {Function} entity - Entity class
     * @param {string} entityName - Optional entity name for logging
     * @returns {object} Monitored repository
     */
    getRepository(entity, entityName = null) {
        const name = entityName || entity.name;
        
        if (this.cachedRepositories.has(name)) {
            return this.cachedRepositories.get(name);
        }

        const baseRepository = AppDataSource.getRepository(entity);
        const monitoredRepository = queryMonitor.wrapRepository(baseRepository, name);
        
        this.cachedRepositories.set(name, monitoredRepository);
        return monitoredRepository;
    }

    /**
     * Set current session ID for query tracking
     * @param {object} repository - Repository instance
     * @param {string} sessionId - Session ID
     */
    setSessionId(repository, sessionId) {
        if (repository && sessionId) {
            repository._currentSessionId = sessionId;
        }
    }

    /**
     * Clear session ID from repository
     * @param {object} repository - Repository instance
     */
    clearSessionId(repository) {
        if (repository) {
            delete repository._currentSessionId;
        }
    }
}

// Global factory instance
export const monitoredRepoFactory = new MonitoredRepositoryFactory();

/**
 * Utility function to get commonly used monitored repositories
 */
export const getMonitoredRepositories = () => {
    // Import entity classes dynamically to avoid circular dependencies
    return {
        async character() {
            const { Character } = await import('../models/characterModel.js');
            return monitoredRepoFactory.getRepository(Character, 'Character');
        },
        
        async skill() {
            const { Skill } = await import('../models/skillModel.js');
            return monitoredRepoFactory.getRepository(Skill, 'Skill');
        },
        
        async chatMessage() {
            const { ChatMessage } = await import('../models/chatMessageModel.js');
            return monitoredRepoFactory.getRepository(ChatMessage, 'ChatMessage');
        },
        
        async combatAction() {
            const { CombatAction } = await import('../models/combatActionModel.js');
            return monitoredRepoFactory.getRepository(CombatAction, 'CombatAction');
        },
        
        async combatRound() {
            const { CombatRound } = await import('../models/combatRoundModel.js');
            return monitoredRepoFactory.getRepository(CombatRound, 'CombatRound');
        },

        async characterSkill() {
            const { CharacterSkill } = await import('../models/characterSkillModel.js');
            return monitoredRepoFactory.getRepository(CharacterSkill, 'CharacterSkill');
        },

        async characterSkillBranch() {
            const { CharacterSkillBranch } = await import('../models/characterSkillBranchModel.js');
            return monitoredRepoFactory.getRepository(CharacterSkillBranch, 'CharacterSkillBranch');
        }
    };
};