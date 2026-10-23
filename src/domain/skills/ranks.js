// Rank ladders: a rank is reached once uses >= minUses. Ordered by minUses, the first entry starts at 0.
// These are the defaults; the runtime ladders come from the DB through skillRulesFromRows (rules.js).

// Per-skill ladder (character_skills.uses). The skill rank multiplier in the final output formula.
export const DEFAULT_SKILL_RANKS = Object.freeze([
    Object.freeze({ rank: 1, minUses: 0, multiplier: 1.0 }),
    Object.freeze({ rank: 2, minUses: 20, multiplier: 1.3 }),
    Object.freeze({ rank: 3, minUses: 35, multiplier: 1.7 }),
    Object.freeze({ rank: 4, minUses: 60, multiplier: 2.2 }),
    Object.freeze({ rank: 5, minUses: 100, multiplier: 2.8 }),
]);

// Per-branch ladder (character_skill_branches.uses). The branch rank multiplier in the final output formula.
export const DEFAULT_BRANCH_RANKS = Object.freeze([
    Object.freeze({ rank: 1, minUses: 0, multiplier: 1.0 }),
    Object.freeze({ rank: 2, minUses: 75, multiplier: 1.05 }),
    Object.freeze({ rank: 3, minUses: 150, multiplier: 1.1 }),
    Object.freeze({ rank: 4, minUses: 250, multiplier: 1.15 }),
    Object.freeze({ rank: 5, minUses: 375, multiplier: 1.2 }),
    Object.freeze({ rank: 6, minUses: 525, multiplier: 1.25 }),
    Object.freeze({ rank: 7, minUses: 700, multiplier: 1.3 }),
    Object.freeze({ rank: 8, minUses: 900, multiplier: 1.35 }),
    Object.freeze({ rank: 9, minUses: 1125, multiplier: 1.4 }),
    Object.freeze({ rank: 10, minUses: 1375, multiplier: 1.5 }),
]);

/**
 * Skill rank reached after a number of uses of that skill.
 * @param {number} uses - character_skills.uses
 * @param {Array<{ rank: number, minUses: number, multiplier: number }>} table - Ladder ordered by minUses
 * @returns {{ rank: number, multiplier: number }}
 */
export function skillRankFor(uses, table = DEFAULT_SKILL_RANKS) {
    return rankFor(uses, table);
}

/**
 * Branch rank reached after a number of uses of skills in that branch.
 * @param {number} uses - character_skill_branches.uses
 * @param {Array<{ rank: number, minUses: number, multiplier: number }>} table - Ladder ordered by minUses
 * @returns {{ rank: number, multiplier: number }}
 */
export function branchRankFor(uses, table = DEFAULT_BRANCH_RANKS) {
    return rankFor(uses, table);
}

function rankFor(uses, table) {
    const reached = table.findLast(entry => uses >= entry.minUses) ?? table[0];
    return { rank: reached.rank, multiplier: reached.multiplier };
}
