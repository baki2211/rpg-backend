// Upper bound of a stat whose definition has no maxValue.
export const DEFAULT_STAT_MAX = 100;

/**
 * Check a character's stats against the stat definitions.
 * Errors: a missing primary stat, a value that isn't a number, a value outside [minValue, maxValue].
 * Keys in `stats` that no definition knows are not checked here (a stat update rejects them, see unknownStatKeys).
 * @param {Object} stats - character.stats
 * @param {Array<{ internalName: string, displayName: string, category: string, minValue: number, maxValue: number|null }>} statDefinitions
 *   - the active definitions being checked, in the order errors should be reported
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateCharacterStats(stats, statDefinitions) {
    const errors = [];

    for (const statDef of statDefinitions) {
        const value = stats[statDef.internalName];
        const maxValue = statDef.maxValue ?? DEFAULT_STAT_MAX;

        if (value === undefined || value === null) {
            if (statDef.category === 'primary_stat') {
                errors.push(`Missing required stat: ${statDef.displayName}`);
            }
            continue;
        }

        if (typeof value !== 'number') {
            errors.push(`${statDef.displayName} must be a number`);
            continue;
        }

        if (value < statDef.minValue) {
            errors.push(`${statDef.displayName} cannot be less than ${statDef.minValue}`);
        }

        if (value > maxValue) {
            errors.push(`${statDef.displayName} cannot be greater than ${maxValue}`);
        }
    }

    return { isValid: errors.length === 0, errors };
}

// Keys computeDerivedStats writes into character.stats. reactions and speed have no stat definition.
const DERIVED_STAT_NAMES = ['reactions', 'speed', 'hp', 'aether'];

/**
 * Keys of a stat update that no active stat definition and no derived stat knows, in request order.
 * Derived keys are accepted because they are recomputed on every update anyway.
 * @param {Object} statUpdates - the stats sent by the player
 * @param {Array<{ internalName: string }>} statDefinitions - the active stat definitions, every category
 * @returns {string[]}
 */
export function unknownStatKeys(statUpdates, statDefinitions) {
    const knownKeys = new Set([...statDefinitions.map(def => def.internalName), ...DERIVED_STAT_NAMES]);
    return Object.keys(statUpdates).filter(statName => !knownKeys.has(statName));
}

/**
 * Stats derived from the primary stats, the race and the character rank.
 * Race primary-stat bonuses are read from `race[<internalName>Bonus]`.
 * - reactions = floor((INS + FOC) / 2 + INS × 0.165)
 * - speed = floor((FOR + CON + RES) / 3 + FOR × 0.165 + race.speedBonus)
 * - hp = floor((RES × 2 + CON × 3 + race.healthBonus) × (1 + rank.hpPercent / 100))
 * - aether = floor((race.manaBonus + √(sum of primary stats) × 5) × (1 + rank.aetherPercent / 100))
 * @param {Object} params
 * @param {Object} params.baseStats - character.stats before race bonuses (a missing stat counts as 0)
 * @param {Object|null} params.race - races row
 * @param {{ hpPercent?: number, aetherPercent?: number } | null} params.rank - ranks row for the character's rank; null for none
 * @param {string[]} params.primaryStatNames - internalName of the active primary stat definitions
 * @returns {{ reactions: number, speed: number, hp: number, aether: number }}
 */
export function computeDerivedStats({ baseStats, race, rank, primaryStatNames }) {
    const statValues = {};
    let primarySum = 0;

    for (const statName of primaryStatNames) {
        const finalValue = (baseStats[statName] || 0) + (race?.[`${statName}Bonus`] || 0);
        statValues[statName] = finalValue;
        primarySum += finalValue;
    }

    const FOC = statValues.foc || 0;
    const CON = statValues.con || 0;
    const RES = statValues.res || 0;
    const INS = statValues.ins || 0;
    const FOR = statValues.for || 0;

    const reactions = ((INS + FOC) / 2) + (INS * 0.165);

    const BSP = race?.speedBonus || 0;
    const speed = ((FOR + CON + RES) / 3) + (FOR * 0.165) + BSP;

    const BHP = race?.healthBonus || 0;
    const baseHP = ((RES * 2) + (CON * 3)) + BHP;
    const hp = Math.floor(baseHP * (1 + (rank?.hpPercent || 0) / 100));

    const BAE = race?.manaBonus || 0;
    const baseAE = BAE + Math.sqrt(primarySum) * 5;
    const aether = Math.floor(baseAE * (1 + (rank?.aetherPercent || 0) / 100));

    return { reactions: Math.floor(reactions), speed: Math.floor(speed), hp, aether };
}

/**
 * Apply every rank the character's experience has reached, one level at a time.
 * Each new rank adds its statPoints and skillPoints and, when set, raises current aether and hp
 * by its aetherPercent / hpPercent (floored). Stops at the first missing level.
 * Pure: returns new values and leaves the inputs untouched.
 * @param {{ rank: number, experience: number, statPoints: number, skillPoints: number, stats: Object }} character
 * @param {Array<{ level: number, requiredExperience: number, statPoints: number, skillPoints: number,
 *                 aetherPercent?: number, hpPercent?: number }>} ranks - ranks rows, any order
 * @returns {{ leveledUp: boolean, rank: number, statPoints: number, skillPoints: number, stats: Object }}
 */
export function levelUp(character, ranks) {
    let { rank, statPoints, skillPoints } = character;
    const stats = { ...character.stats };
    let leveledUp = false;

    let nextRank = ranks.find(entry => entry.level === rank + 1);
    while (nextRank && character.experience >= nextRank.requiredExperience) {
        rank = nextRank.level;
        statPoints += nextRank.statPoints;
        skillPoints += nextRank.skillPoints;

        if (nextRank.aetherPercent && stats.aether !== undefined) {
            stats.aether = Math.floor(stats.aether * (1 + nextRank.aetherPercent / 100));
        }
        if (nextRank.hpPercent && stats.hp !== undefined) {
            stats.hp = Math.floor(stats.hp * (1 + nextRank.hpPercent / 100));
        }

        leveledUp = true;
        nextRank = ranks.find(entry => entry.level === rank + 1);
    }

    return { leveledUp, rank, statPoints, skillPoints, stats };
}
