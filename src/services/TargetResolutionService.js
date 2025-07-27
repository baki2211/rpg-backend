import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { logger } from '../utils/logger.js';

/**
 * Centralized service for resolving character targets across the application
 * Standardizes ID vs name vs userId resolution with proper validation
 */
export class TargetResolutionService {
    constructor() {
        this.characterRepository = AppDataSource.getRepository(Character);
    }

    /**
     * Find character by multiple lookup strategies in a single optimized query
     * @param {string|number} targetIdentifier - Target identifier (ID, userID, or name)
     * @param {Object} options - Lookup options
     * @param {boolean} options.includeRelations - Include character relations
     * @param {boolean} options.activeOnly - Only return active characters
     * @returns {Promise<Character|null>} Found character or null
     */
    async findCharacter(targetIdentifier, options = {}) {
        if (!targetIdentifier) return null;

        const { includeRelations = false, activeOnly = true } = options;
        
        // Build where conditions for multiple lookup strategies
        const whereConditions = [
            { id: targetIdentifier },                    // Character ID lookup
            { userId: targetIdentifier },                // User ID lookup  
            { name: targetIdentifier }                   // Name lookup
        ];

        // Add active filter if requested
        if (activeOnly) {
            whereConditions.forEach(condition => {
                condition.isActive = true;
            });
        }

        const queryOptions = {
            where: whereConditions
        };

        // Add relations if requested
        if (includeRelations) {
            queryOptions.relations = ['race', 'skills'];
        }

        const character = await this.characterRepository.findOne(queryOptions);
        
        if (character) {
            logger.debug(`Character found: ${character.name} (ID: ${character.id})`);
        }

        return character;
    }

    /**
     * Validate and resolve skill target based on skill requirements
     * @param {Object} skill - The skill being used
     * @param {Character} caster - Character using the skill
     * @param {string|number} targetIdentifier - Target identifier (optional)
     * @param {Object} options - Resolution options
     * @returns {Promise<Object>} Resolved target data
     */
    async resolveSkillTarget(skill, caster, targetIdentifier = null, options = {}) {
        const result = {
            target: null,
            targetId: null,
            isValid: false,
            error: null
        };

        try {
            switch (skill.target) {
                case 'self':
                    result.target = caster;
                    result.targetId = caster.id;
                    result.isValid = true;
                    break;

                case 'other':
                    if (!targetIdentifier || targetIdentifier === caster.id) {
                        result.error = 'This skill requires a target other than yourself';
                        return result;
                    }
                    
                    result.target = await this.findCharacter(targetIdentifier, options);
                    if (!result.target) {
                        result.error = await this.generateTargetNotFoundError(targetIdentifier);
                        return result;
                    }
                    
                    result.targetId = result.target.id;
                    result.isValid = true;
                    break;

                case 'any':
                    if (!targetIdentifier) {
                        // Default to self if no target specified
                        result.target = caster;
                        result.targetId = caster.id;
                    } else if (targetIdentifier === caster.id) {
                        // Self-targeting
                        result.target = caster;
                        result.targetId = caster.id;
                    } else {
                        // Other-targeting
                        result.target = await this.findCharacter(targetIdentifier, options);
                        if (!result.target) {
                            result.error = await this.generateTargetNotFoundError(targetIdentifier);
                            return result;
                        }
                        result.targetId = result.target.id;
                    }
                    result.isValid = true;
                    break;

                case 'none':
                    // Area/no-target skills don't need a target
                    result.target = null;
                    result.targetId = null;
                    result.isValid = true;
                    break;

                default:
                    // Handle unknown target types - default to self
                    logger.warn(`Unknown skill target type: ${skill.target}, defaulting to self`);
                    result.target = caster;
                    result.targetId = caster.id;
                    result.isValid = true;
                    break;
            }
        } catch (error) {
            logger.error('Error resolving skill target:', { error: error.message, skillId: skill.id });
            result.error = `Failed to resolve target: ${error.message}`;
        }

        return result;
    }

    /**
     * Generate a helpful error message when target character is not found
     * @param {string|number} targetIdentifier - The target that wasn't found
     * @returns {Promise<string>} Error message with available characters
     */
    async generateTargetNotFoundError(targetIdentifier) {
        try {
            const availableCharacters = await this.characterRepository.find({
                select: ['id', 'name', 'surname', 'isActive', 'userId'],
                where: { isActive: true },
                take: 10 // Limit to prevent huge error messages
            });

            const characterList = availableCharacters
                .map(c => `${c.name} ${c.surname || ''} (CharID: ${c.id}, UserID: ${c.userId})`)
                .join(', ');

            return `Target character not found. Searched for: ${targetIdentifier}. Available characters: ${characterList}`;
        } catch (error) {
            logger.error('Failed to generate target error message:', { error: error.message });
            return `Target character not found: ${targetIdentifier}`;
        }
    }

    /**
     * Batch resolve multiple targets for efficiency
     * @param {Array} targetRequests - Array of {skill, caster, targetIdentifier} objects
     * @param {Object} options - Resolution options
     * @returns {Promise<Array>} Array of resolved target results
     */
    async batchResolveTargets(targetRequests, options = {}) {
        const results = await Promise.all(
            targetRequests.map(request => 
                this.resolveSkillTarget(request.skill, request.caster, request.targetIdentifier, options)
            )
        );

        return results;
    }

    /**
     * Get all active characters with optional filtering
     * @param {Object} filters - Optional filters
     * @param {number} filters.locationId - Filter by location
     * @param {number} filters.excludeUserId - Exclude specific user
     * @returns {Promise<Array>} Array of active characters
     */
    async getAvailableTargets(filters = {}) {
        const whereCondition = { isActive: true };
        
        if (filters.locationId) {
            whereCondition.locationId = filters.locationId;
        }

        if (filters.excludeUserId) {
            whereCondition.userId = { $ne: filters.excludeUserId };
        }

        return await this.characterRepository.find({
            where: whereCondition,
            select: ['id', 'name', 'surname', 'userId', 'locationId'],
            order: { name: 'ASC' }
        });
    }

    /**
     * Validate if a character can target another character
     * @param {Character} caster - Character using the skill
     * @param {Character} target - Target character
     * @param {Object} skill - Skill being used
     * @param {Object} context - Additional context (location, event, etc.)
     * @returns {Object} Validation result
     */
    validateTargeting(caster, target, skill, context = {}) {
        const result = {
            isValid: false,
            error: null,
            warnings: []
        };

        // Basic validation
        if (!caster || !skill) {
            result.error = 'Missing caster or skill';
            return result;
        }

        // Self-targeting validation
        if (skill.target === 'self' && target && target.id !== caster.id) {
            result.error = 'This skill can only target yourself';
            return result;
        }

        // Other-targeting validation
        if (skill.target === 'other' && (!target || target.id === caster.id)) {
            result.error = 'This skill requires a target other than yourself';
            return result;
        }

        // Location-based validation (if context provided)
        if (context.requireSameLocation && target && caster.locationId !== target.locationId) {
            result.error = 'Target must be in the same location';
            return result;
        }

        // Range validation (if skill has range restrictions)
        if (skill.range && target) {
            // Add range validation logic here if needed
        }

        result.isValid = true;
        return result;
    }
}