import { DEFAULT_SKILL_RANKS, DEFAULT_BRANCH_RANKS, skillRankFor, branchRankFor } from './ranks.js';
import { DEFAULT_OUTCOMES, outcomeForRoll } from './outcome.js';

// Weights of the scaling stats by how many of them count, applied to the highest stat value first.
const SCALING_WEIGHTS = Object.freeze({
    1: Object.freeze([1.0]),
    2: Object.freeze([0.7, 0.3]),
    3: Object.freeze([0.6, 0.25, 0.15]),
});

/**
 * Impact (IMP) of a skill: its base power plus the weighted character stats it scales with.
 * Only scaling stats that are active primary stats count. The highest stat gets the first weight;
 * with more than three, only the top three count. Each contribution is floored on its own.
 * @param {Object} params
 * @param {number} params.basePower - skill.basePower
 * @param {string[]|null} params.scalingStats - skill.scalingStats
 * @param {Object} params.characterStats - character.stats (a missing stat counts as 0)
 * @param {string[]} params.primaryStatNames - internalName of the active primary stat definitions
 * @returns {number}
 */
export function computeImpact({ basePower, scalingStats, characterStats, primaryStatNames }) {
    const values = (scalingStats ?? [])
        .filter(stat => primaryStatNames.includes(stat))
        .map(stat => characterStats[stat] || 0)
        .sort((a, b) => b - a);

    if (values.length === 0) {
        return basePower;
    }

    const weights = SCALING_WEIGHTS[Math.min(values.length, 3)];
    return weights.reduce((impact, weight, index) => impact + Math.floor(values[index] * weight), basePower);
}

/**
 * Final output of one use of a skill:
 * floor(impact × (skill rank multiplier + branch rank multiplier) × outcome multiplier).
 * @param {Object} params
 * @param {number} params.impact - From computeImpact
 * @param {number} params.skillUses - character_skills.uses
 * @param {number} params.branchUses - character_skill_branches.uses
 * @param {number} params.roll - The d20 result, 1..20
 * @param {Object} [rules] - Tables from skillRulesFromRows (rules.js); the code defaults when omitted
 * @returns {{ finalOutput: number, impact: number, roll: number, quality: string, outcomeMultiplier: number,
 *             skillRankMultiplier: number, branchRankMultiplier: number }}
 * @throws {RangeError} when no outcome band covers the roll
 */
export function computeFinalOutput(
    { impact, skillUses, branchUses, roll },
    { skillRanks = DEFAULT_SKILL_RANKS, branchRanks = DEFAULT_BRANCH_RANKS, outcomes = DEFAULT_OUTCOMES } = {}
) {
    const outcome = outcomeForRoll(roll, outcomes);
    const skillRankMultiplier = skillRankFor(skillUses, skillRanks).multiplier;
    const branchRankMultiplier = branchRankFor(branchUses, branchRanks).multiplier;

    return {
        finalOutput: Math.floor(impact * (skillRankMultiplier + branchRankMultiplier) * outcome.multiplier),
        impact,
        roll,
        quality: outcome.quality,
        outcomeMultiplier: outcome.multiplier,
        skillRankMultiplier,
        branchRankMultiplier,
    };
}
