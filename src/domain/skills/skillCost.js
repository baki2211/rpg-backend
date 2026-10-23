import { applyAetherCost } from './aetherCost.js';

/**
 * Pay for one use of a skill: check its required stats and deduct its aether cost.
 * Required stats are checked only for active primary stats (`primaryStatNames`); other keys in
 * `requiredStats` are ignored, the same way scaling stats are. A missing stat counts as 0.
 * Pure: returns new stats and leaves the input untouched.
 * @param {Object} stats - Character `stats`
 * @param {{ aetherCost: number, requiredStats?: Object<string, number>|null }} skill
 * @param {string[]} primaryStatNames - internalName of the active primary stat definitions
 * @returns {{ allowed: boolean, error: string|null, stats: Object }} `stats` is the input unchanged when refused
 */
export function paySkillCost(stats, { aetherCost, requiredStats }, primaryStatNames) {
    const aether = applyAetherCost(stats, aetherCost);
    if (!aether.allowed) {
        return aether;
    }

    const unmet = Object.entries(requiredStats ?? {})
        .find(([stat, required]) => primaryStatNames.includes(stat) && (stats[stat] ?? 0) < required);

    if (unmet) {
        const [stat, required] = unmet;
        return {
            allowed: false,
            error: `Insufficient ${stat} to use this skill. Required: ${required}, Available: ${stats[stat] ?? 0}`,
            stats,
        };
    }

    return aether;
}
