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

// races column holding each primary stat's race bonus. A primary stat not listed here has no race bonus.
const RACE_STAT_BONUS_COLUMNS = {
    foc: 'focusBonus',
    con: 'controlBonus',
    res: 'resilienceBonus',
    ins: 'instinctBonus',
    pre: 'presenceBonus',
    for: 'forceBonus',
};

/**
 * The HP/aether bonus of a character at rank `level`: the hpPercent and aetherPercent of every rank
 * from the first up to `level`, added up (each rank grants its percentage on top of the ones below).
 * @param {Array<{ level: number, hpPercent?: number, aetherPercent?: number }>} ranks - ranks rows, any order
 * @param {number} level - the character's rank
 * @returns {{ hpPercent: number, aetherPercent: number }}
 */
export function cumulativeRankBonus(ranks, level) {
    let hpPercent = 0;
    let aetherPercent = 0;
    for (const rank of ranks) {
        if (rank.level <= level) {
            hpPercent += rank.hpPercent || 0;
            aetherPercent += rank.aetherPercent || 0;
        }
    }
    return { hpPercent, aetherPercent };
}

/**
 * Stats derived from the primary stats, the race and the character rank.
 * Race primary-stat bonuses are read from the races columns in RACE_STAT_BONUS_COLUMNS (foc → focusBonus, ...).
 * - reactions = floor((INS + FOC) / 2 + INS × 0.165)
 * - speed = floor((FOR + CON + RES) / 3 + FOR × 0.165 + race.speedBonus)
 * - hp = floor((RES × 2 + CON × 3 + race.healthBonus) × (1 + rankBonus.hpPercent / 100))
 * - aether = floor((race.manaBonus + √(sum of primary stats) × 5) × (1 + rankBonus.aetherPercent / 100))
 * This is the only place the rank percentages are applied (levelUp leaves hp and aether alone).
 * @param {Object} params
 * @param {Object} params.baseStats - character.stats before race bonuses (a missing stat counts as 0)
 * @param {Object|null} params.race - races row
 * @param {{ hpPercent?: number, aetherPercent?: number } | null} params.rankBonus - cumulativeRankBonus for the character's rank; null for none
 * @param {string[]} params.primaryStatNames - internalName of the active primary stat definitions
 * @returns {{ reactions: number, speed: number, hp: number, aether: number }}
 */
export function computeDerivedStats({ baseStats, race, rankBonus, primaryStatNames }) {
    const statValues = {};
    let primarySum = 0;

    for (const statName of primaryStatNames) {
        const finalValue = (baseStats[statName] || 0) + (race?.[RACE_STAT_BONUS_COLUMNS[statName]] || 0);
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
    const hp = Math.floor(baseHP * (1 + (rankBonus?.hpPercent || 0) / 100));

    const BAE = race?.manaBonus || 0;
    const baseAE = BAE + Math.sqrt(primarySum) * 5;
    const aether = Math.floor(baseAE * (1 + (rankBonus?.aetherPercent || 0) / 100));

    return { reactions: Math.floor(reactions), speed: Math.floor(speed), hp, aether };
}

/**
 * Apply every rank the character's experience has reached, one level at a time.
 * Each new rank adds its statPoints and skillPoints. Stops at the first missing level.
 * The rank's hp/aether percentages are not applied here: recompute the derived stats with the new rank
 * (computeDerivedStats + cumulativeRankBonus).
 * Pure: returns new values and leaves the inputs untouched.
 * @param {{ rank: number, experience: number, statPoints: number, skillPoints: number }} character
 * @param {Array<{ level: number, requiredExperience: number, statPoints: number, skillPoints: number }>} ranks - ranks rows, any order
 * @returns {{ leveledUp: boolean, rank: number, statPoints: number, skillPoints: number }}
 */
export function levelUp(character, ranks) {
    let { rank, statPoints, skillPoints } = character;
    let leveledUp = false;

    let nextRank = ranks.find(entry => entry.level === rank + 1);
    while (nextRank && character.experience >= nextRank.requiredExperience) {
        rank = nextRank.level;
        statPoints += nextRank.statPoints;
        skillPoints += nextRank.skillPoints;

        leveledUp = true;
        nextRank = ranks.find(entry => entry.level === rank + 1);
    }

    return { leveledUp, rank, statPoints, skillPoints };
}
