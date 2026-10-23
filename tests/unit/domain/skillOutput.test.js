import { describe, it, expect } from 'vitest';
import { computeImpact, computeFinalOutput } from '../../../src/domain/skills/output.js';

const PRIMARY_STATS = ['foc', 'con', 'res', 'ins', 'pre', 'for'];

function impactOf({ basePower = 10, scalingStats = [], characterStats = {}, primaryStatNames = PRIMARY_STATS } = {}) {
    return computeImpact({ basePower, scalingStats, characterStats, primaryStatNames });
}

function finalOutputOf({ impact = 100, skillUses = 0, branchUses = 0, roll = 11 } = {}, rules = undefined) {
    return computeFinalOutput({ impact, skillUses, branchUses, roll }, rules);
}

describe('impact of a skill', () => {
    it.each([
        ['no scaling stats: just the base power', [], {}, 10],
        ['one scaling stat counts in full', ['for'], { for: 7 }, 17],
        // 10 + floor(9 × 0.7) + floor(5 × 0.3) = 10 + 6 + 1
        ['two scaling stats: 70% of the higher, 30% of the lower, each floored', ['for', 'con'], { for: 5, con: 9 }, 17],
        // 10 + floor(20 × 0.6) + floor(10 × 0.25) + floor(7 × 0.15) = 10 + 12 + 2 + 1
        ['three scaling stats: 60%, 25%, 15% from highest to lowest, each floored', ['for', 'con', 'res'], { for: 10, con: 20, res: 7 }, 25],
        ['the order the scaling stats are listed in does not matter', ['res', 'con', 'for'], { for: 10, con: 20, res: 7 }, 25],
        ['beyond three scaling stats only the top three count', ['for', 'con', 'res', 'foc'], { for: 10, con: 20, res: 7, foc: 3 }, 25],
        // 10 + floor(10 × 0.7) + floor(0 × 0.3)
        ['a scaling stat the character lacks counts as 0', ['for', 'con'], { for: 10 }, 17],
    ])('%s', (_name, scalingStats, characterStats, expected) => {
        const result = impactOf({ scalingStats, characterStats });

        expect(result).toBe(expected);
    });

    it.each([
        // floor(5 × 0.7) + floor(5 × 0.3) = 3 + 1 = 4, where floor(5 × 1.0) would be 5
        ['two equal stats of 5 add 4, not 5', ['for', 'con'], { for: 5, con: 5 }, 14],
        // floor(9 × 0.6) + floor(9 × 0.25) + floor(9 × 0.15) = 5 + 2 + 1 = 8, where floor(9 × 1.0) would be 9
        ['three equal stats of 9 add 8, not 9', ['for', 'con', 'res'], { for: 9, con: 9, res: 9 }, 18],
    ])('each weighted contribution is floored on its own: %s', (_name, scalingStats, characterStats, expected) => {
        const result = impactOf({ scalingStats, characterStats });

        expect(result).toBe(expected);
    });

    it('a scaling stat that is not an active primary stat is ignored', () => {
        const result = impactOf({ scalingStats: ['for', 'luck'], characterStats: { for: 7, luck: 50 }, primaryStatNames: ['for'] });

        expect(result).toBe(17);
    });

    it('an ignored non-primary stat does not change the weights of the others', () => {
        // two primary stats count, so 70/30: 10 + floor(10 × 0.7) + floor(10 × 0.3)
        const result = impactOf({ scalingStats: ['for', 'con', 'hp'], characterStats: { for: 10, con: 10, hp: 100 } });

        expect(result).toBe(20);
    });

    it('a skill without scaling stats set is just its base power', () => {
        const result = impactOf({ basePower: 12, scalingStats: null });

        expect(result).toBe(12);
    });
});

describe('final output of a skill', () => {
    it('a fresh character with a standard roll doubles the impact', () => {
        const result = computeFinalOutput({ impact: 10, skillUses: 0, branchUses: 0, roll: 11 });

        expect(result).toEqual({
            finalOutput: 20, impact: 10, roll: 11, quality: 'Standard',
            outcomeMultiplier: 1.0, skillRankMultiplier: 1.0, branchRankMultiplier: 1.0,
        });
    });

    it('skill rank II, branch rank II and a critical roll multiply the impact, floored', () => {
        const result = computeFinalOutput({ impact: 50, skillUses: 20, branchUses: 75, roll: 19 });

        // 50 × (1.3 + 1.05) × 1.4 = 164.5
        expect(result).toEqual({
            finalOutput: 164, impact: 50, roll: 19, quality: 'Critical',
            outcomeMultiplier: 1.4, skillRankMultiplier: 1.3, branchRankMultiplier: 1.05,
        });
    });

    // Impact 20, branch rank I (1.0), standard roll: final output = 20 × (skill multiplier + 1.0)
    it.each([
        [0, 1.0, 40],
        [19, 1.0, 40],
        [20, 1.3, 46],
        [34, 1.3, 46],
        [35, 1.7, 54],
        [59, 1.7, 54],
        [60, 2.2, 64],
        [99, 2.2, 64],
        [100, 2.8, 76],
        [5000, 2.8, 76],
    ])('a skill used %i times has a skill rank multiplier of %d (impact 20 gives %i)', (skillUses, multiplier, finalOutput) => {
        const result = finalOutputOf({ impact: 20, skillUses });

        expect(result).toMatchObject({ skillRankMultiplier: multiplier, finalOutput });
    });

    // Impact 20, skill rank I (1.0), standard roll: final output = 20 × (1.0 + branch multiplier)
    it.each([
        [0, 1.0, 40],
        [74, 1.0, 40],
        [75, 1.05, 41],
        [149, 1.05, 41],
        [150, 1.1, 42],
        [249, 1.1, 42],
        [250, 1.15, 43],
        [374, 1.15, 43],
        [375, 1.2, 44],
        [524, 1.2, 44],
        [525, 1.25, 45],
        [699, 1.25, 45],
        [700, 1.3, 46],
        [899, 1.3, 46],
        [900, 1.35, 47],
        [1124, 1.35, 47],
        [1125, 1.4, 48],
        [1374, 1.4, 48],
        [1375, 1.5, 50],
        [10000, 1.5, 50],
    ])('a branch used %i times has a branch rank multiplier of %d (impact 20 gives %i)', (branchUses, multiplier, finalOutput) => {
        const result = finalOutputOf({ impact: 20, branchUses });

        expect(result).toMatchObject({ branchRankMultiplier: multiplier, finalOutput });
    });

    // Current behaviour, not the spec arithmetic: the multipliers are summed and multiplied as
    // floating-point numbers before the floor, so 100 × (1.3 + 1.0) is 229.99999999999997 and floors to 229.
    it.each([
        ['an impact of 100 at skill rank II gives 229, one short of 230', 100, 20, 0, 229],
        ['an impact of 100 at branch rank II gives 204, one short of 205', 100, 0, 75, 204],
        ['an impact of 60 at branch rank II gives 122, one short of 123', 60, 0, 75, 122],
    ])('floating-point rounding can cost a point: %s', (_name, impact, skillUses, branchUses, finalOutput) => {
        const result = finalOutputOf({ impact, skillUses, branchUses });

        expect(result.finalOutput).toBe(finalOutput);
    });

    it.each([
        [1, 12, 'Poor', 0.6],
        [3, 12, 'Poor', 0.6],
        [4, 20, 'Standard', 1.0],
        [17, 20, 'Standard', 1.0],
        [18, 28, 'Critical', 1.4],
        [20, 28, 'Critical', 1.4],
    ])('a roll of %i turns an impact of 10 into %i (%s)', (roll, finalOutput, quality, outcomeMultiplier) => {
        const result = finalOutputOf({ impact: 10, roll });

        expect(result).toMatchObject({ finalOutput, quality, outcomeMultiplier, roll });
    });

    it('a poor roll floors the reduced output', () => {
        // 7 × 2 × 0.6 = 8.4
        const result = finalOutputOf({ impact: 7, roll: 2 });

        expect(result.finalOutput).toBe(8);
    });

    it('an impact of 0 gives an output of 0', () => {
        const result = finalOutputOf({ impact: 0, skillUses: 100, branchUses: 1375, roll: 20 });

        expect(result.finalOutput).toBe(0);
    });

    it.each([0, 21])('a roll of %i is outside 1..20 and refused', (roll) => {
        expect(() => finalOutputOf({ roll })).toThrow(`No outcome for a d20 roll of ${roll}`);
    });

    it('rule tables loaded from the database replace the defaults', () => {
        const rules = {
            skillRanks: [{ rank: 1, minUses: 0, multiplier: 1.0 }, { rank: 2, minUses: 10, multiplier: 1.5 }],
            branchRanks: [{ rank: 1, minUses: 0, multiplier: 1.1 }],
            outcomes: [{ quality: 'Standard', minRoll: 1, maxRoll: 20, multiplier: 1.2 }],
        };

        const result = computeFinalOutput({ impact: 10, skillUses: 10, branchUses: 0, roll: 11 }, rules);

        // 10 × (1.5 + 1.1) × 1.2 = 31.2
        expect(result.finalOutput).toBe(31);
    });

    it.each([
        // 100 × (1.0 + 1.0) × 0.5
        ['a database poor multiplier of 0.5 replaces 0.6', 2, 0, 100],
        // 100 × (1.4 + 1.0) × 1.0, the database ladder reaches rank II at 15 uses instead of 20
        ['a database skill ladder moves the rank II threshold to 15 uses', 11, 15, 240],
        ['one use below the database threshold stays at rank I', 11, 14, 200],
    ])('%s', (_name, roll, skillUses, finalOutput) => {
        const rules = {
            skillRanks: [{ rank: 1, minUses: 0, multiplier: 1.0 }, { rank: 2, minUses: 15, multiplier: 1.4 }],
            outcomes: [
                { quality: 'Poor', minRoll: 1, maxRoll: 3, multiplier: 0.5 },
                { quality: 'Standard', minRoll: 4, maxRoll: 17, multiplier: 1.0 },
                { quality: 'Critical', minRoll: 18, maxRoll: 20, multiplier: 1.4 },
            ],
        };

        const result = finalOutputOf({ roll, skillUses }, rules);

        expect(result.finalOutput).toBe(finalOutput);
    });

    it('a table left out of the database rules falls back to the default', () => {
        // only the outcomes are given; the default branch ladder still applies at 75 uses (1.05)
        const rules = { outcomes: [{ quality: 'Standard', minRoll: 1, maxRoll: 20, multiplier: 1.0 }] };

        const result = finalOutputOf({ impact: 20, branchUses: 75 }, rules);

        expect(result).toMatchObject({ branchRankMultiplier: 1.05, finalOutput: 41 });
    });
});
