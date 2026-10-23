/**
 * Apply the damage from a resolved clash to both sides' stats.
 * Pure: returns new stats objects and leaves the inputs untouched.
 * @param {Object} attackerStats - Attacker's `stats` (must contain `hp`)
 * @param {Object} defenderStats - Defender's `stats` (must contain `hp`)
 * @param {{ attacker: number, defender: number }} damage - Damage each side takes
 * @returns {{ attackerStats: Object, defenderStats: Object }} Updated stats for both sides
 */
export function applyClashDamage(attackerStats, defenderStats, damage) {
    return {
        attackerStats: { ...attackerStats, hp: attackerStats.hp - damage.attacker },
        defenderStats: { ...defenderStats, hp: defenderStats.hp - damage.defender },
    };
}
