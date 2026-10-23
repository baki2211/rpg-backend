import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { logger } from '../utils/logger.js';

// Which Character column a target identifier refers to. Callers must say which one they send.
const LOOKUP_FIELDS = { characterId: 'id', userId: 'userId', name: 'name' };

function lookupField(lookupBy) {
    const field = LOOKUP_FIELDS[lookupBy];
    if (!field) {
        throw new Error(`Unknown target lookup kind: ${lookupBy}`);
    }
    return field;
}

/**
 * Centralized service for resolving character targets across the application
 * Standardizes ID vs name vs userId resolution with proper validation
 */
export class TargetResolutionService {
    constructor() {
        this.characterRepository = AppDataSource.getRepository(Character);
    }

    /**
     * Find a character by one explicit lookup kind
     * @param {string|number} targetIdentifier - Target identifier (character ID, user ID or name, per lookupBy)
     * @param {Object} options - Lookup options
     * @param {'characterId'|'userId'|'name'} options.lookupBy - Which column targetIdentifier refers to
     * @param {boolean} options.includeRelations - Include character relations
     * @param {boolean} options.activeOnly - Only return active characters
     * @returns {Promise<Character|null>} Found character or null
     */
    async findCharacter(targetIdentifier, options = {}) {
        if (!targetIdentifier) return null;

        const { lookupBy, includeRelations = false, activeOnly = true } = options;

        const where = { [lookupField(lookupBy)]: targetIdentifier };

        // Add active filter if requested
        if (activeOnly) {
            where.isActive = true;
        }

        const queryOptions = { where };

        // Add relations if requested
        if (includeRelations) {
            queryOptions.relations = { race: true, characterSkills: { skill: true } };
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
     * @param {Object} options - Resolution options (see findCharacter; options.lookupBy is required when a target is given)
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
            const targetsCaster = () => caster[lookupField(options.lookupBy)] === targetIdentifier;

            switch (skill.target) {
                case 'self':
                    result.target = caster;
                    result.targetId = caster.id;
                    result.isValid = true;
                    break;

                case 'other':
                    if (!targetIdentifier || targetsCaster()) {
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
                    } else if (targetsCaster()) {
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
                select: { id: true, name: true, surname: true, isActive: true, userId: true },
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