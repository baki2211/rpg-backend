import { SkillEngine } from './SkillEngine.js';
import { TargetResolutionService } from './TargetResolutionService.js';
import { SkillUsageService } from './SkillUsageService.js';
import { logger } from '../utils/logger.js';

/**
 * Standardized service for skill execution across all contexts
 * Handles calculations, target resolution, validation, and usage tracking
 */
export class SkillExecutionService {
    constructor() {
        this.targetResolutionService = new TargetResolutionService();
    }

    /**
     * Execute a skill with full validation and calculation
     * @param {Object} params - Execution parameters
     * @param {Character} params.caster - Character using the skill
     * @param {Object} params.skill - Skill being used
     * @param {string|number} params.targetIdentifier - Target identifier (optional)
     * @param {Object} params.context - Execution context (location, event, etc.)
     * @param {Object} params.options - Execution options
     * @returns {Promise<Object>} Execution result
     */
    async executeSkill(params) {
        const { caster, skill, targetIdentifier, context = {}, options = {} } = params;

        const result = {
            success: false,
            skillOutput: null,
            targetData: null,
            rollData: null,
            error: null,
            warnings: []
        };

        try {
            // Step 1: Resolve and validate target
            const targetResolution = await this.targetResolutionService.resolveSkillTarget(
                skill, 
                caster, 
                targetIdentifier,
                { includeRelations: true, activeOnly: true }
            );

            if (!targetResolution.isValid) {
                result.error = targetResolution.error;
                return result;
            }

            result.targetData = {
                target: targetResolution.target,
                targetId: targetResolution.targetId
            };

            // Step 2: Validate skill prerequisites
            const prerequisiteCheck = await this.validateSkillPrerequisites(caster, skill, context);
            if (!prerequisiteCheck.isValid) {
                result.error = prerequisiteCheck.error;
                result.warnings = prerequisiteCheck.warnings;
                return result;
            }

            // Step 3: Calculate skill output
            const calculationResult = await this.calculateSkillOutput(caster, skill, options);
            if (!calculationResult.success) {
                result.error = calculationResult.error;
                return result;
            }

            result.skillOutput = calculationResult.finalOutput;
            result.rollData = {
                outcomeMultiplier: calculationResult.outcomeMultiplier,
                rollQuality: calculationResult.rollQuality,
                impact: calculationResult.impact,
                skillUses: calculationResult.skillUses,
                branchUses: calculationResult.branchUses
            };

            // Step 4: Apply skill costs
            const costResult = await this.applySkillCosts(caster, skill);
            if (!costResult.success) {
                result.error = costResult.error;
                return result;
            }

            // Step 5: Track skill usage
            await SkillUsageService.incrementSkillUsage(caster.id, skill.id, skill.branchId);

            result.success = true;
            
            logger.skill(`Skill executed: ${skill.name} by ${caster.name}, output: ${result.skillOutput}`);

        } catch (error) {
            logger.error('Skill execution failed:', { 
                error: error.message, 
                casterId: caster.id, 
                skillId: skill.id 
            });
            result.error = `Skill execution failed: ${error.message}`;
        }

        return result;
    }

    /**
     * Calculate skill output using standardized approach
     * @param {Character} caster - Character using the skill
     * @param {Object} skill - Skill being used
     * @param {Object} options - Calculation options
     * @param {Object} options.preCalculated - Pre-calculated values to use
     * @param {boolean} options.useCache - Whether to use cached calculations
     * @returns {Promise<Object>} Calculation result
     */
    async calculateSkillOutput(caster, skill, options = {}) {
        const result = {
            success: false,
            finalOutput: 0,
            outcomeMultiplier: 1.0,
            rollQuality: 'Standard',
            impact: 0,
            skillUses: 0,
            branchUses: 0,
            error: null
        };

        try {
            // Use pre-calculated values if provided and valid
            if (options.preCalculated && this.validatePreCalculatedValues(options.preCalculated)) {
                result.finalOutput = options.preCalculated.finalOutput;
                result.rollQuality = options.preCalculated.rollQuality;
                result.outcomeMultiplier = this.rollQualityToMultiplier(options.preCalculated.rollQuality);
                result.success = true;
                
                logger.debug('Using pre-calculated skill values');
                return result;
            }

            // Calculate using SkillEngine
            const skillEngine = new SkillEngine(caster, skill);
            
            // Get all required data in batched operations
            const [
                finalOutput,
                { skillUses, branchUses },
                impact
            ] = await Promise.all([
                skillEngine.computeFinalOutput(),
                skillEngine.getUsageData(),
                skillEngine.calculateImpact()
            ]);

            const outcomeMultiplier = skillEngine.rollOutcome();

            result.finalOutput = finalOutput;
            result.outcomeMultiplier = outcomeMultiplier;
            result.rollQuality = this.multiplierToRollQuality(outcomeMultiplier);
            result.impact = impact;
            result.skillUses = skillUses;
            result.branchUses = branchUses;
            result.success = true;

        } catch (error) {
            logger.error('Skill calculation failed:', { error: error.message });
            result.error = error.message;
        }

        return result;
    }

    /**
     * Validate skill prerequisites before execution
     * @param {Character} caster - Character using the skill
     * @param {Object} skill - Skill being used
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Validation result
     */
    async validateSkillPrerequisites(caster, skill, context = {}) {
        const result = {
            isValid: false,
            error: null,
            warnings: []
        };

        try {
            // Check aether cost
            if (!caster.stats.aether || caster.stats.aether < skill.aetherCost) {
                result.error = `Insufficient aether. Required: ${skill.aetherCost}, Available: ${caster.stats.aether || 0}`;
                return result;
            }

            // Check required stats
            if (skill.requiredStats) {
                for (const [stat, value] of Object.entries(skill.requiredStats)) {
                    if (!caster.stats[stat] || caster.stats[stat] < value) {
                        result.error = `Insufficient ${stat}. Required: ${value}, Available: ${caster.stats[stat] || 0}`;
                        return result;
                    }
                }
            }

            // Check cooldowns (if implemented)
            if (context.checkCooldowns) {
                const cooldownCheck = await this.checkSkillCooldown(caster.id, skill.id);
                if (!cooldownCheck.isReady) {
                    result.error = `Skill is on cooldown. Time remaining: ${cooldownCheck.timeRemaining}s`;
                    return result;
                }
            }

            // Context-specific validations
            if (context.requiresCombat && !context.inCombat) {
                result.error = 'This skill can only be used in combat';
                return result;
            }

            if (context.requiresEvent && !context.inEvent) {
                result.error = 'This skill can only be used during events';
                return result;
            }

            result.isValid = true;

        } catch (error) {
            logger.error('Skill prerequisite validation failed:', { error: error.message });
            result.error = `Validation failed: ${error.message}`;
        }

        return result;
    }

    /**
     * Apply skill costs to character
     * @param {Character} caster - Character using the skill
     * @param {Object} skill - Skill being used
     * @returns {Promise<Object>} Cost application result
     */
    async applySkillCosts(caster, skill) {
        const result = {
            success: false,
            error: null
        };

        try {
            const skillEngine = new SkillEngine(caster, skill);
            await skillEngine.applyCost(skill);
            result.success = true;
        } catch (error) {
            logger.error('Failed to apply skill costs:', { error: error.message });
            result.error = error.message;
        }

        return result;
    }

    /**
     * Check if skill is on cooldown
     * @param {number} characterId - Character ID
     * @param {number} skillId - Skill ID
     * @returns {Promise<Object>} Cooldown status
     */
    async checkSkillCooldown(characterId, skillId) {
        // TODO: Implement cooldown system
        return {
            isReady: true,
            timeRemaining: 0
        };
    }

    /**
     * Convert roll quality string to multiplier
     * @param {string} rollQuality - Roll quality ('Critical', 'Standard', 'Poor')
     * @returns {number} Outcome multiplier
     */
    rollQualityToMultiplier(rollQuality) {
        switch (rollQuality) {
            case 'Critical': return 1.4;
            case 'Poor': return 0.6;
            case 'Standard':
            default: return 1.0;
        }
    }

    /**
     * Convert multiplier to roll quality string
     * @param {number} multiplier - Outcome multiplier
     * @returns {string} Roll quality
     */
    multiplierToRollQuality(multiplier) {
        if (multiplier >= 1.4) return 'Critical';
        if (multiplier <= 0.6) return 'Poor';
        return 'Standard';
    }

    /**
     * Validate pre-calculated values
     * @param {Object} preCalculated - Pre-calculated values
     * @returns {boolean} Whether values are valid
     */
    validatePreCalculatedValues(preCalculated) {
        return preCalculated && 
               typeof preCalculated.finalOutput === 'number' && 
               preCalculated.finalOutput > 0 &&
               preCalculated.rollQuality &&
               ['Critical', 'Standard', 'Poor'].includes(preCalculated.rollQuality);
    }

    /**
     * Create skill execution context for different scenarios
     * @param {string} scenario - Execution scenario ('chat', 'combat', 'event')
     * @param {Object} additionalContext - Additional context data
     * @returns {Object} Execution context
     */
    createExecutionContext(scenario, additionalContext = {}) {
        const baseContext = {
            scenario,
            checkCooldowns: false,
            requiresCombat: false,
            requiresEvent: false,
            inCombat: false,
            inEvent: false,
            ...additionalContext
        };

        switch (scenario) {
            case 'combat':
                baseContext.inCombat = true;
                baseContext.checkCooldowns = true;
                break;
            case 'event':
                baseContext.inEvent = true;
                baseContext.checkCooldowns = true;
                break;
            case 'chat':
                // Chat usage is generally unrestricted
                break;
        }

        return baseContext;
    }
}