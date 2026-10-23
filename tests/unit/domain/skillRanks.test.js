import { describe, it, expect } from 'vitest';
import { skillRankFor, branchRankFor } from '../../../src/domain/skills/ranks.js';

describe('skill rank reached after a number of uses of the skill', () => {
    it.each([
        [0, 1, 1.0],
        [19, 1, 1.0],
        [20, 2, 1.3],
        [34, 2, 1.3],
        [35, 3, 1.7],
        [59, 3, 1.7],
        [60, 4, 2.2],
        [99, 4, 2.2],
        [100, 5, 2.8],
        [500, 5, 2.8],
    ])('%i uses is rank %i with multiplier %d', (uses, rank, multiplier) => {
        const result = skillRankFor(uses);

        expect(result).toEqual({ rank, multiplier });
    });

    it.each([
        [9, 1, 1.0],
        [10, 2, 1.5],
    ])('a ladder loaded from the database decides the rank: %i uses is rank %i', (uses, rank, multiplier) => {
        const table = [{ rank: 1, minUses: 0, multiplier: 1.0 }, { rank: 2, minUses: 10, multiplier: 1.5 }];

        const result = skillRankFor(uses, table);

        expect(result).toEqual({ rank, multiplier });
    });
});

describe('branch rank reached after a number of uses of skills in the branch', () => {
    it.each([
        [0, 1, 1.0],
        [74, 1, 1.0],
        [75, 2, 1.05],
        [149, 2, 1.05],
        [150, 3, 1.1],
        [249, 3, 1.1],
        [250, 4, 1.15],
        [374, 4, 1.15],
        [375, 5, 1.2],
        [524, 5, 1.2],
        [525, 6, 1.25],
        [699, 6, 1.25],
        [700, 7, 1.3],
        [899, 7, 1.3],
        [900, 8, 1.35],
        [1124, 8, 1.35],
        [1125, 9, 1.4],
        [1374, 9, 1.4],
        [1375, 10, 1.5],
        [9999, 10, 1.5],
    ])('%i branch uses is rank %i with multiplier %d', (uses, rank, multiplier) => {
        const result = branchRankFor(uses);

        expect(result).toEqual({ rank, multiplier });
    });
});
