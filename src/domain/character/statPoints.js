// Total points a character may spend across all primary stats.
export const PRIMARY_STAT_POINT_POOL = 45;

/**
 * Primary stat points a character has spent: the sum of its primary stats.
 * A stat that is missing (or 0) counts at its definition's defaultValue.
 * @param {Object} stats - character.stats
 * @param {Array<{ internalName: string, defaultValue: number }>} primaryStatDefinitions - active primary stat definitions
 * @returns {number}
 */
export function primaryStatPointsUsed(stats, primaryStatDefinitions) {
    return primaryStatDefinitions.reduce((total, statDef) => total + (stats[statDef.internalName] || statDef.defaultValue), 0);
}

/**
 * Whether the primary stat points spent go over the pool. Spending exactly the whole pool is allowed.
 * @param {number} pointsUsed - From primaryStatPointsUsed
 * @returns {boolean}
 */
export function exceedsPrimaryStatPool(pointsUsed) {
    return pointsUsed > PRIMARY_STAT_POINT_POOL;
}
