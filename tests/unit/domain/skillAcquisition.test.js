import { describe, it, expect } from 'vitest';
import { planSkillAcquisition } from '../../../src/domain/skills/acquisition.js';

const makeRequest = (overrides = {}) => ({
    skillPoints: 5,
    skillPointCost: 3,
    alreadyKnown: false,
    ...overrides,
});

describe('learning a new skill with skill points', () => {
    it.each([
        ['more points than the cost leaves the difference', 5, 3, 2],
        ['exactly the cost spends every point', 3, 3, 0],
        ['a skill that costs nothing keeps every point', 4, 0, 4],
    ])('%s', (_name, skillPoints, skillPointCost, remaining) => {
        const request = makeRequest({ skillPoints, skillPointCost });

        const plan = planSkillAcquisition(request);

        expect(plan).toEqual({ allowed: true, reason: null, error: null, remainingSkillPoints: remaining });
    });

    it.each([
        ['one point short of the cost', 2, 3],
        ['no points left', 0, 1],
    ])('%s is refused and keeps the points', (_name, skillPoints, skillPointCost) => {
        const request = makeRequest({ skillPoints, skillPointCost });

        const plan = planSkillAcquisition(request);

        expect(plan).toEqual({
            allowed: false, reason: 'not_enough_points', error: 'Not enough skill points', remainingSkillPoints: skillPoints,
        });
    });

    it.each([
        ['enough points', 5],
        ['not enough points', 0],
    ])('a skill the character already knows is refused with %s', (_name, skillPoints) => {
        const request = makeRequest({ skillPoints, skillPointCost: 3, alreadyKnown: true });

        const plan = planSkillAcquisition(request);

        expect(plan).toEqual({
            allowed: false, reason: 'already_known', error: 'Character already has this skill', remainingSkillPoints: skillPoints,
        });
    });
});
