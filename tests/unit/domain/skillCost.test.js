import { describe, it, expect } from 'vitest';
import { paySkillCost } from '../../../src/domain/skills/skillCost.js';

const PRIMARY_STATS = ['foc', 'for', 'res'];
const makeStats = (overrides = {}) => ({ hp: 100, aether: 50, foc: 5, ...overrides });
const makeSkill = (fields = {}) => ({ aetherCost: 10, requiredStats: null, ...fields });

describe('paying for one use of a skill', () => {
    it.each([
        ['no required stats', null],
        ['a primary stat exactly at the requirement', { foc: 5 }],
        ['a required stat that is not an active primary stat', { hp: 500 }],
    ])('the aether cost is deducted with %s', (_name, requiredStats) => {
        const stats = makeStats();

        const result = paySkillCost(stats, makeSkill({ requiredStats }), PRIMARY_STATS);

        expect(result).toEqual({ allowed: true, error: null, stats: { hp: 100, aether: 40, foc: 5 } });
    });

    it.each([
        ['one point short on a primary stat', { foc: 6 }, 'Insufficient foc to use this skill. Required: 6, Available: 5'],
        ['a primary stat the character does not have', { res: 1 }, 'Insufficient res to use this skill. Required: 1, Available: 0'],
    ])('the skill is refused with %s', (_name, requiredStats, error) => {
        const stats = makeStats();

        const result = paySkillCost(stats, makeSkill({ requiredStats }), PRIMARY_STATS);

        expect(result).toEqual({ allowed: false, error, stats: { hp: 100, aether: 50, foc: 5 } });
    });

    it('missing aether is reported before missing stats', () => {
        const stats = makeStats({ aether: 5 });

        const result = paySkillCost(stats, makeSkill({ requiredStats: { foc: 99 } }), PRIMARY_STATS);

        expect(result.error).toBe('Insufficient aether to use this skill. Required: 10, Available: 5');
    });
});
