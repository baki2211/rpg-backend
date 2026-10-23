import { CharacterSkill } from '../models/characterSkillModel.js';
import { CharacterSkillBranch } from '../models/characterSkillBranchModel.js';
import { AppDataSource } from '../data-source.js';
import { HttpError } from '../utils/HttpError.js';
import staticDataCache from '../utils/staticDataCache.js';
import { paySkillCost } from '../domain/skills/skillCost.js';
import { computeImpact, computeFinalOutput } from '../domain/skills/output.js';

/**
 * Loads what the skill formulas need for one character and skill (usage counts, active primary
 * stats, the rule tables) and hands it to src/domain/skills. The d20 comes from the caller.
 */
export class SkillEngine {
    constructor(character, skill) {
        this.character = character;
        this.skill = skill;
    }

    /**
     * Get both skill and branch uses in a single batch operation (N+1 optimization)
     * @returns {Promise<{skillUses: number, branchUses: number}>} Usage data
     */
    async getUsageData() {
        const [skillResult, branchResult] = await Promise.all([
            AppDataSource.getRepository(CharacterSkill).findOne({
                where: {
                    characterId: this.character.id,
                    skillId: this.skill.id
                }
            }),
            AppDataSource.getRepository(CharacterSkillBranch).findOne({
                where: {
                    characterId: this.character.id,
                    branchId: this.skill.branchId
                }
            })
        ]);

        return {
            skillUses: skillResult?.uses || 0,
            branchUses: branchResult?.uses || 0
        };
    }

    /**
     * Compute the final output of the skill for a d20 roll.
     * @param {number} roll - The d20 result (rollD20() in src/utils/dice.js), 1..20
     * @returns {Promise<{ finalOutput: number, impact: number, roll: number, quality: string,
     *   outcomeMultiplier: number, skillRankMultiplier: number, branchRankMultiplier: number,
     *   skillUses: number, branchUses: number }>}
     */
    async computeFinalOutput(roll) {
        // Rank and outcome tables: DB rows with code defaults (src/domain/skills/rules.js)
        const [rules, primaryStatNames, { skillUses, branchUses }] = await Promise.all([
            staticDataCache.getSkillRules(),
            activePrimaryStatNames(),
            this.getUsageData()
        ]);

        const impact = computeImpact({
            basePower: this.skill.basePower,
            scalingStats: this.skill.scalingStats,
            characterStats: this.character.stats,
            primaryStatNames
        });

        return { ...computeFinalOutput({ impact, skillUses, branchUses, roll }, rules), skillUses, branchUses };
    }

    /**
     * The character's stats after paying for one use of the skill (aether and required stats,
     * rule in src/domain/skills/skillCost.js). Doesn't change `this.character`; the caller saves the result.
     * @returns {Promise<Object>} New `stats`
     * @throws {HttpError} 400 when the cost can't be paid
     */
    async statsAfterCost() {
        const cost = paySkillCost(this.character.stats, this.skill, await activePrimaryStatNames());
        if (!cost.allowed) {
            throw new HttpError(400, cost.error);
        }
        return cost.stats;
    }
}

async function activePrimaryStatNames() {
    const primaryStats = await staticDataCache.getStatDefinitions('primary_stat', true);
    return primaryStats.map(stat => stat.internalName);
}
