import { describe, it, expect } from 'vitest';
import { outcomeForRoll, outcomeForQuality, acceptPreCalculatedOutput } from '../../../src/domain/skills/outcome.js';

describe('outcome of a skill for a d20 roll', () => {
    it.each([
        [1, 'Poor', 0.6],
        [3, 'Poor', 0.6],
        [4, 'Standard', 1.0],
        [17, 'Standard', 1.0],
        [18, 'Critical', 1.4],
        [20, 'Critical', 1.4],
    ])('a roll of %i is a %s success with multiplier %d', (roll, quality, multiplier) => {
        const result = outcomeForRoll(roll);

        expect(result).toEqual({ roll, quality, multiplier });
    });

    it('multipliers loaded from the database replace the defaults, the roll bands stay', () => {
        const table = [
            { quality: 'Poor', minRoll: 1, maxRoll: 3, multiplier: 0.9 },
            { quality: 'Standard', minRoll: 4, maxRoll: 17, multiplier: 1.0 },
            { quality: 'Critical', minRoll: 18, maxRoll: 20, multiplier: 1.15 },
        ];

        const result = outcomeForRoll(18, table);

        expect(result).toEqual({ roll: 18, quality: 'Critical', multiplier: 1.15 });
    });

    it.each([
        [0, 'No outcome for a d20 roll of 0'],
        [21, 'No outcome for a d20 roll of 21'],
    ])('a roll of %i is not a d20 result', (roll, message) => {
        const act = () => outcomeForRoll(roll);

        expect(act).toThrow(message);
    });
});

describe('outcome multiplier for a roll quality decided earlier', () => {
    it.each([
        ['Poor', 0.6],
        ['Standard', 1.0],
        ['Critical', 1.4],
    ])('a %s success has multiplier %d', (quality, multiplier) => {
        const result = outcomeForQuality(quality);

        expect(result).toEqual({ quality, multiplier });
    });

    it('an unknown quality has no outcome', () => {
        const result = outcomeForQuality('Legendary');

        expect(result).toBeNull();
    });
});

describe('accepting an output rolled earlier', () => {
    it('a positive output with a known quality is kept, with that quality\'s multiplier', () => {
        const result = acceptPreCalculatedOutput({ finalOutput: 18, rollQuality: 'Standard' });

        expect(result).toEqual({ finalOutput: 18, quality: 'Standard', multiplier: 1.0 });
    });

    it('the multiplier comes from the table loaded from the database', () => {
        const table = [{ quality: 'Critical', minRoll: 18, maxRoll: 20, multiplier: 1.15 }];

        const result = acceptPreCalculatedOutput({ finalOutput: 30, rollQuality: 'Critical' }, table);

        expect(result).toEqual({ finalOutput: 30, quality: 'Critical', multiplier: 1.15 });
    });

    it.each([
        ['a zero output', { finalOutput: 0, rollQuality: 'Standard' }],
        ['a negative output', { finalOutput: -3, rollQuality: 'Standard' }],
        ['an output sent as text', { finalOutput: '18', rollQuality: 'Standard' }],
        ['an output that is not a number', { finalOutput: NaN, rollQuality: 'Standard' }],
        ['an unknown quality', { finalOutput: 18, rollQuality: 'Legendary' }],
        ['nothing at all', null],
    ])('%s is refused', (_name, preCalculated) => {
        const result = acceptPreCalculatedOutput(preCalculated);

        expect(result).toBeNull();
    });
});
