import { SkillEngine } from './SkillEngine.js';
import { logger } from '../utils/logger.js';
import staticDataCache from '../utils/staticDataCache.js';
import { acceptPreCalculatedOutput } from '../domain/skills/outcome.js';

/**
 * Skill output calculation shared by chat and combat
 */
export class SkillExecutionService {
    /**
     * Calculate skill output, or reuse an output already rolled elsewhere when it is valid
     * (rule in src/domain/skills/outcome.js#acceptPreCalculatedOutput)
     * @param {Character} caster - Character using the skill
     * @param {Object} skill - Skill being used
     * @param {Object} options - Calculation options
     * @param {number} options.roll - The d20 for a fresh calculation (rollD20() in src/utils/dice.js)
     * @param {Object} options.preCalculated - Pre-calculated `{ finalOutput, rollQuality }` to use instead
     * @returns {Promise<Object>} Calculation result
     */
    async calculateSkillOutput(caster, skill, { roll, preCalculated = null } = {}) {
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
            const accepted = preCalculated
                ? acceptPreCalculatedOutput(preCalculated, (await staticDataCache.getSkillRules()).outcomes)
                : null;

            if (accepted) {
                logger.debug('Using pre-calculated skill values');
                return {
                    ...result,
                    success: true,
                    finalOutput: accepted.finalOutput,
                    rollQuality: accepted.quality,
                    outcomeMultiplier: accepted.multiplier
                };
            }

            const output = await new SkillEngine(caster, skill).computeFinalOutput(roll);

            return {
                ...result,
                success: true,
                finalOutput: output.finalOutput,
                outcomeMultiplier: output.outcomeMultiplier,
                rollQuality: output.quality,
                impact: output.impact,
                skillUses: output.skillUses,
                branchUses: output.branchUses
            };
        } catch (error) {
            logger.error('Skill calculation failed:', { error: error.message });
            return { ...result, error: error.message };
        }
    }
}
