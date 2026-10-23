import { describe, it, expect } from 'vitest';
import { primaryStatPointsUsed, exceedsPrimaryStatPool } from '../../../src/domain/character/statPoints.js';

function makeDefinition(internalName, defaultValue = 5) {
    return { internalName, defaultValue };
}

const SIX_PRIMARY_STATS = ['foc', 'con', 'res', 'ins', 'pre', 'for'].map(name => makeDefinition(name));

describe('primary stat points spent', () => {
    it('sums the primary stats, counting a missing or zero stat at its default', () => {
        const definitions = [makeDefinition('for', 5), makeDefinition('con', 5), makeDefinition('res', 4)];

        const result = primaryStatPointsUsed({ for: 10, con: 0, luck: 9 }, definitions);

        expect(result).toBe(19);
    });

    it('a fresh character with every stat at its default of 5 has spent 30', () => {
        const result = primaryStatPointsUsed({}, SIX_PRIMARY_STATS);

        expect(result).toBe(30);
    });

    it('resources and derived stats are not counted', () => {
        const stats = { foc: 10, con: 10, res: 10, ins: 5, pre: 5, for: 5, hp: 100, aether: 50, speed: 9, reactions: 8 };

        const result = primaryStatPointsUsed(stats, SIX_PRIMARY_STATS);

        expect(result).toBe(45);
    });
});

describe('primary stat point pool of 45', () => {
    it.each([
        ['44 points spent is within the pool', 44, false],
        ['exactly 45 points spent uses the whole pool', 45, false],
        ['46 points spent goes over the pool', 46, true],
    ])('%s', (_name, pointsUsed, expected) => {
        const result = exceedsPrimaryStatPool(pointsUsed);

        expect(result).toBe(expected);
    });
});
