import { describe, it, expect } from 'vitest';
import { applyAetherCost } from '../../../src/domain/skills/aetherCost.js';

const makeStats = (overrides = {}) => ({ hp: 100, aether: 50, foc: 5, ...overrides });

describe('paying the aether cost of a skill', () => {
    it.each([
        ['more aether than the cost leaves the difference', 50, 20, 30],
        ['exactly the cost leaves zero', 20, 20, 0],
        ['a free skill with no aether left still works', 0, 0, 0],
    ])('%s', (_name, aether, cost, remaining) => {
        const stats = makeStats({ aether });

        const result = applyAetherCost(stats, cost);

        expect(result).toEqual({ allowed: true, error: null, stats: { hp: 100, aether: remaining, foc: 5 } });
    });

    it.each([
        ['one aether short', 19, 20, 'Insufficient aether to use this skill. Required: 20, Available: 19'],
        ['no aether left', 0, 5, 'Insufficient aether to use this skill. Required: 5, Available: 0'],
        ['no aether value at all', undefined, 5, 'Insufficient aether to use this skill. Required: 5, Available: 0'],
    ])('the skill is refused with %s', (_name, aether, cost, error) => {
        const stats = makeStats({ aether });

        const result = applyAetherCost(stats, cost);

        expect([result.allowed, result.error]).toEqual([false, error]);
    });

    it('the stats passed in are not changed', () => {
        const stats = makeStats({ aether: 50 });

        applyAetherCost(stats, 20);

        expect(stats).toEqual({ hp: 100, aether: 50, foc: 5 });
    });
});
