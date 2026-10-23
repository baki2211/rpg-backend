import { describe, it, expect } from 'vitest';
import { skillRulesFromRows } from '../../../src/domain/skills/rules.js';

const makeTier = (tier, usesRequired, multiplier, fields = {}) => ({ tier, usesRequired, multiplier, isActive: true, ...fields });
const makeConstant = (constantKey, value, fields = {}) => ({ constantKey, value, isActive: true, ...fields });

describe('skill rule tables loaded from database rows', () => {
    it('with no rows every table is the code default', () => {
        const result = skillRulesFromRows({ masteryTiers: [], combatConstants: [] });

        expect(result).toEqual({
            skillRanks: [
                { rank: 1, minUses: 0, multiplier: 1.0 },
                { rank: 2, minUses: 20, multiplier: 1.3 },
                { rank: 3, minUses: 35, multiplier: 1.7 },
                { rank: 4, minUses: 60, multiplier: 2.2 },
                { rank: 5, minUses: 100, multiplier: 2.8 },
            ],
            branchRanks: [
                { rank: 1, minUses: 0, multiplier: 1.0 },
                { rank: 2, minUses: 75, multiplier: 1.05 },
                { rank: 3, minUses: 150, multiplier: 1.1 },
                { rank: 4, minUses: 250, multiplier: 1.15 },
                { rank: 5, minUses: 375, multiplier: 1.2 },
                { rank: 6, minUses: 525, multiplier: 1.25 },
                { rank: 7, minUses: 700, multiplier: 1.3 },
                { rank: 8, minUses: 900, multiplier: 1.35 },
                { rank: 9, minUses: 1125, multiplier: 1.4 },
                { rank: 10, minUses: 1375, multiplier: 1.5 },
            ],
            outcomes: [
                { quality: 'Poor', minRoll: 1, maxRoll: 3, multiplier: 0.6 },
                { quality: 'Standard', minRoll: 4, maxRoll: 17, multiplier: 1.0 },
                { quality: 'Critical', minRoll: 18, maxRoll: 20, multiplier: 1.4 },
            ],
        });
    });

    it('active mastery tiers become the skill rank ladder, ordered by uses, with decimal strings read as numbers', () => {
        const masteryTiers = [makeTier(3, 50, '2.00'), makeTier(1, 0, '1.00'), makeTier(2, 10, '1.50'), makeTier(4, 80, '9.00', { isActive: false })];

        const result = skillRulesFromRows({ masteryTiers, combatConstants: [] });

        expect(result.skillRanks).toEqual([
            { rank: 1, minUses: 0, multiplier: 1.0 },
            { rank: 2, minUses: 10, multiplier: 1.5 },
            { rank: 3, minUses: 50, multiplier: 2.0 },
        ]);
    });

    it.each([
        ['the first active tier needs uses', [makeTier(1, 0, '1.00', { isActive: false }), makeTier(2, 20, '1.30')]],
        ['two tiers start at the same uses', [makeTier(1, 0, '1.00'), makeTier(2, 20, '1.30'), makeTier(3, 20, '1.70')]],
        ['a later tier has a lower rank number', [makeTier(2, 0, '1.00'), makeTier(1, 20, '1.30')]],
        ['a multiplier is zero', [makeTier(1, 0, '1.00'), makeTier(2, 20, '0.00')]],
        ['a multiplier is not a number', [makeTier(1, 0, '1.00'), makeTier(2, 20, 'abc')]],
    ])('the default skill rank ladder is used when %s', (_name, masteryTiers) => {
        const result = skillRulesFromRows({ masteryTiers, combatConstants: [] });

        expect(result.skillRanks.map(entry => [entry.minUses, entry.multiplier])).toEqual([[0, 1.0], [20, 1.3], [35, 1.7], [60, 2.2], [100, 2.8]]);
    });

    it('MASTERY_TIER_n constants set the branch rank n multiplier, thresholds stay', () => {
        const combatConstants = [makeConstant('MASTERY_TIER_6', '1.2400'), makeConstant('MASTERY_TIER_10', '1.6500')];

        const result = skillRulesFromRows({ masteryTiers: [], combatConstants });

        expect(result.branchRanks.map(entry => [entry.minUses, entry.multiplier])).toEqual([
            [0, 1.0], [75, 1.05], [150, 1.1], [250, 1.15], [375, 1.2], [525, 1.24], [700, 1.3], [900, 1.35], [1125, 1.4], [1375, 1.65],
        ]);
    });

    it('OUTCOME_*_MULT constants set the outcome multipliers, roll bands stay', () => {
        const combatConstants = [makeConstant('OUTCOME_POOR_MULT', '0.9000'), makeConstant('OUTCOME_CRITICAL_MULT', '1.1500')];

        const result = skillRulesFromRows({ masteryTiers: [], combatConstants });

        expect(result.outcomes).toEqual([
            { quality: 'Poor', minRoll: 1, maxRoll: 3, multiplier: 0.9 },
            { quality: 'Standard', minRoll: 4, maxRoll: 17, multiplier: 1.0 },
            { quality: 'Critical', minRoll: 18, maxRoll: 20, multiplier: 1.15 },
        ]);
    });

    it.each([
        ['not a number', makeConstant('OUTCOME_CRITICAL_MULT', 'abc')],
        ['zero', makeConstant('OUTCOME_CRITICAL_MULT', '0.0000')],
        ['negative', makeConstant('OUTCOME_CRITICAL_MULT', '-1.4000')],
        ['inactive', makeConstant('OUTCOME_CRITICAL_MULT', '2.0000', { isActive: false })],
    ])('a constant that is %s falls back to its default', (_name, constant) => {
        const result = skillRulesFromRows({ masteryTiers: [], combatConstants: [constant] });

        expect(result.outcomes.map(entry => entry.multiplier)).toEqual([0.6, 1.0, 1.4]);
    });
});
