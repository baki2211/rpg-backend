/**
 * Pay a skill's aether cost.
 * Refused when the character has no aether value or less aether than the cost.
 * Pure: returns new stats and leaves the input untouched.
 * @param {Object} stats - Character `stats` (reads `aether`)
 * @param {number} cost - The skill's `aetherCost`
 * @returns {{ allowed: boolean, error: string|null, stats: Object }} `stats` is the input unchanged when refused
 */
export function applyAetherCost(stats, cost) {
    const available = stats?.aether;

    if (typeof available !== 'number' || available < cost) {
        return {
            allowed: false,
            error: `Insufficient aether to use this skill. Required: ${cost}, Available: ${available || 0}`,
            stats,
        };
    }

    return { allowed: true, error: null, stats: { ...stats, aether: available - cost } };
}
