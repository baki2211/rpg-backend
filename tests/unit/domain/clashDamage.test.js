import { describe, it, expect } from 'vitest';
import { applyClashDamage } from '../../../src/domain/combat/clashDamage.js';

const makeStats = (overrides = {}) => ({ hp: 50, aether: 20, str: 5, ...overrides });

describe('applying clash damage', () => {
    it.each([
        ['only the defender is hit', { attacker: 0, defender: 12 }, 50, 28],
        ['only the attacker is hit', { attacker: 15, defender: 0 }, 35, 40],
        ['both sides are hit', { attacker: 7, defender: 9 }, 43, 31],
        ['nobody is hit', { attacker: 0, defender: 0 }, 50, 40],
    ])('when %s, each side loses exactly its own damage', (_name, damage, attackerHp, defenderHp) => {
        const attacker = makeStats({ hp: 50 });
        const defender = makeStats({ hp: 40 });

        const result = applyClashDamage(attacker, defender, damage);

        expect(result.attackerStats.hp).toBe(attackerHp);
        expect(result.defenderStats.hp).toBe(defenderHp);
    });

    it('leaves every stat other than hp unchanged', () => {
        const attacker = makeStats({ hp: 50, aether: 20, str: 5 });
        const defender = makeStats({ hp: 40, aether: 8, str: 3 });

        const result = applyClashDamage(attacker, defender, { attacker: 7, defender: 9 });

        expect(result).toEqual({
            attackerStats: { hp: 43, aether: 20, str: 5 },
            defenderStats: { hp: 31, aether: 8, str: 3 },
        });
    });

    it('does not modify the stats it was given', () => {
        const attacker = makeStats({ hp: 50 });
        const defender = makeStats({ hp: 40 });

        applyClashDamage(attacker, defender, { attacker: 7, defender: 9 });

        expect([attacker.hp, defender.hp]).toEqual([50, 40]);
    });

    it('lets hp go below zero when the damage exceeds it', () => {
        const attacker = makeStats({ hp: 5 });
        const defender = makeStats({ hp: 40 });

        const result = applyClashDamage(attacker, defender, { attacker: 12, defender: 0 });

        expect(result.attackerStats.hp).toBe(-7);
    });
});
