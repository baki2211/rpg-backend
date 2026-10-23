// d20 outcome bands. The roll ranges are fixed here; the multipliers are the defaults and the
// runtime values come from the OUTCOME_*_MULT CombatConstant rows through skillRulesFromRows (rules.js).
export const DEFAULT_OUTCOMES = Object.freeze([
    Object.freeze({ quality: 'Poor', minRoll: 1, maxRoll: 3, multiplier: 0.6 }),
    Object.freeze({ quality: 'Standard', minRoll: 4, maxRoll: 17, multiplier: 1.0 }),
    Object.freeze({ quality: 'Critical', minRoll: 18, maxRoll: 20, multiplier: 1.4 }),
]);

/**
 * Outcome of a skill for a d20 roll.
 * @param {number} roll - The d20 result, 1..20
 * @param {Array<{ quality: string, minRoll: number, maxRoll: number, multiplier: number }>} table
 * @returns {{ roll: number, quality: string, multiplier: number }}
 * @throws {RangeError} when no band covers the roll
 */
export function outcomeForRoll(roll, table = DEFAULT_OUTCOMES) {
    const band = table.find(entry => roll >= entry.minRoll && roll <= entry.maxRoll);
    if (!band) {
        throw new RangeError(`No outcome for a d20 roll of ${roll}`);
    }
    return { roll, quality: band.quality, multiplier: band.multiplier };
}

/**
 * Outcome multiplier for a roll quality already decided elsewhere (e.g. a chat skill submitted to combat).
 * @param {string} quality - 'Poor' | 'Standard' | 'Critical'
 * @param {Array<{ quality: string, multiplier: number }>} table
 * @returns {{ quality: string, multiplier: number } | null} null for an unknown quality
 */
export function outcomeForQuality(quality, table = DEFAULT_OUTCOMES) {
    const band = table.find(entry => entry.quality === quality);
    return band ? { quality: band.quality, multiplier: band.multiplier } : null;
}

/**
 * Accept an output already rolled elsewhere (a chat skill submitted to combat) when it is a positive
 * number with a known roll quality. Refused values are recomputed by the caller with a new roll.
 * @param {{ finalOutput: unknown, rollQuality: unknown } | null | undefined} preCalculated
 * @param {Array<{ quality: string, multiplier: number }>} table
 * @returns {{ finalOutput: number, quality: string, multiplier: number } | null} null when refused
 */
export function acceptPreCalculatedOutput(preCalculated, table = DEFAULT_OUTCOMES) {
    const outcome = outcomeForQuality(preCalculated?.rollQuality, table);
    const { finalOutput } = preCalculated ?? {};
    if (!outcome || typeof finalOutput !== 'number' || !(finalOutput > 0)) {
        return null;
    }
    return { finalOutput, quality: outcome.quality, multiplier: outcome.multiplier };
}
