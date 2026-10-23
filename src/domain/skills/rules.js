import { DEFAULT_SKILL_RANKS, DEFAULT_BRANCH_RANKS } from './ranks.js';
import { DEFAULT_OUTCOMES } from './outcome.js';

// Where the admin-editable copies of the skill tables live:
// - skill rank ladder: the active `mastery_tiers` rows (tier = rank, usesRequired = minUses, multiplier)
// - branch rank multipliers: CombatConstant MASTERY_TIER_1..10 (one per branch rank; thresholds stay in code)
// - outcome multipliers: CombatConstant OUTCOME_POOR_MULT / OUTCOME_STANDARD_MULT / OUTCOME_CRITICAL_MULT (roll bands stay in code)
export const BRANCH_RANK_MULTIPLIER_KEYS = Object.freeze(DEFAULT_BRANCH_RANKS.map(entry => `MASTERY_TIER_${entry.rank}`));

export const OUTCOME_MULTIPLIER_KEYS = Object.freeze({
    Poor: 'OUTCOME_POOR_MULT',
    Standard: 'OUTCOME_STANDARD_MULT',
    Critical: 'OUTCOME_CRITICAL_MULT',
});

/**
 * Build the skill rule tables from DB rows, falling back to the code defaults.
 * - The skill rank ladder is taken from the mastery tiers only when the active rows form a valid
 *   ladder (first tier at 0 uses, tiers and uses strictly increasing, positive multipliers);
 *   otherwise the whole default ladder is used.
 * - Each branch rank and outcome multiplier falls back to its own default when its constant is
 *   missing, inactive, or not a positive number.
 * @param {Object} rows
 * @param {Array<{ tier: number, usesRequired: number, multiplier: number|string, isActive?: boolean }>} rows.masteryTiers
 * @param {Array<{ constantKey: string, value: number|string, isActive?: boolean }>} rows.combatConstants
 * @returns {{ skillRanks: Array<{ rank: number, minUses: number, multiplier: number }>,
 *             branchRanks: Array<{ rank: number, minUses: number, multiplier: number }>,
 *             outcomes: Array<{ quality: string, minRoll: number, maxRoll: number, multiplier: number }> }}
 */
export function skillRulesFromRows({ masteryTiers = [], combatConstants = [] }) {
    const multiplierFor = (key, fallback) => {
        const row = combatConstants.find(constant => constant.constantKey === key && constant.isActive !== false);
        const value = Number(row?.value);
        return row && isPositive(value) ? value : fallback;
    };

    return {
        skillRanks: skillRanksFromTiers(masteryTiers),
        branchRanks: DEFAULT_BRANCH_RANKS.map((entry, index) => ({
            ...entry,
            multiplier: multiplierFor(BRANCH_RANK_MULTIPLIER_KEYS[index], entry.multiplier),
        })),
        outcomes: DEFAULT_OUTCOMES.map(entry => ({
            ...entry,
            multiplier: multiplierFor(OUTCOME_MULTIPLIER_KEYS[entry.quality], entry.multiplier),
        })),
    };
}

function skillRanksFromTiers(masteryTiers) {
    const ladder = masteryTiers
        .filter(tier => tier.isActive !== false)
        .map(tier => ({ rank: Number(tier.tier), minUses: Number(tier.usesRequired), multiplier: Number(tier.multiplier) }))
        .sort((a, b) => a.minUses - b.minUses);

    return isValidLadder(ladder) ? ladder : DEFAULT_SKILL_RANKS.map(entry => ({ ...entry }));
}

function isValidLadder(ladder) {
    return ladder.length > 0 &&
        ladder[0].minUses === 0 &&
        ladder.every((entry, index) =>
            Number.isInteger(entry.rank) && entry.rank > 0 &&
            Number.isInteger(entry.minUses) &&
            isPositive(entry.multiplier) &&
            (index === 0 || (entry.minUses > ladder[index - 1].minUses && entry.rank > ladder[index - 1].rank)));
}

function isPositive(value) {
    return Number.isFinite(value) && value > 0;
}
