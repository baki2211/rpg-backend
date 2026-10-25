import { describe, it, expect } from 'vitest';
import { validateCharacterStats, unknownStatKeys, computeDerivedStats, cumulativeRankBonus, levelUp } from '../../../src/domain/character/stats.js';

const FORTITUDE = { internalName: 'for', displayName: 'Fortitude', category: 'primary_stat', minValue: 1, maxValue: 15, defaultValue: 5 };
const FOCUS = { internalName: 'foc', displayName: 'Focus', category: 'primary_stat', minValue: 0, maxValue: 15, defaultValue: 5 };
const HEALTH = { internalName: 'hp', displayName: 'Health', category: 'resource', minValue: 0, maxValue: null, defaultValue: 50 };

describe('stat validation', () => {
    it.each([
        ['at a minimum of 1', FORTITUDE, 1],
        ['at the maximum of 15', FORTITUDE, 15],
        ['at a minimum of 0', FOCUS, 0],
        ['at 100 when the definition has no maximum', HEALTH, 100],
    ])('a stat %s is valid', (_name, definition, value) => {
        const result = validateCharacterStats({ [definition.internalName]: value }, [definition]);

        expect(result).toEqual({ isValid: true, errors: [] });
    });

    it.each([
        ['one below a minimum of 1', FORTITUDE, 0, 'Fortitude cannot be less than 1'],
        ['one above the maximum of 15', FORTITUDE, 16, 'Fortitude cannot be greater than 15'],
        ['one below a minimum of 0', FOCUS, -1, 'Focus cannot be less than 0'],
        ['above 100 when the definition has no maximum', HEALTH, 101, 'Health cannot be greater than 100'],
        ['that is not a number', FORTITUDE, '10', 'Fortitude must be a number'],
        ['that is a missing primary stat', FORTITUDE, undefined, 'Missing required stat: Fortitude'],
        ['that is a null primary stat', FORTITUDE, null, 'Missing required stat: Fortitude'],
    ])('a stat %s is an error', (_name, definition, value, error) => {
        const result = validateCharacterStats({ [definition.internalName]: value }, [definition]);

        expect(result).toEqual({ isValid: false, errors: [error] });
    });

    it('every broken stat is reported, in the order of the definitions', () => {
        const result = validateCharacterStats({ foc: 16, for: 0, hp: -1 }, [FOCUS, FORTITUDE, HEALTH]);

        expect(result).toEqual({
            isValid: false,
            errors: ['Focus cannot be greater than 15', 'Fortitude cannot be less than 1', 'Health cannot be less than 0'],
        });
    });

    it('a missing resource is not an error', () => {
        const result = validateCharacterStats({ for: 5 }, [FORTITUDE, HEALTH]);

        expect(result).toEqual({ isValid: true, errors: [] });
    });

    it('a stat no definition knows is not an error', () => {
        const result = validateCharacterStats({ for: 5, luck: 3 }, [FORTITUDE]);

        expect(result).toEqual({ isValid: true, errors: [] });
    });
});

describe('unknown keys in a stat update', () => {
    it.each([
        ['a primary stat', { for: 6 }],
        ['a resource stat', { hp: 40 }],
        ['every derived stat, even without a definition', { reactions: 5, speed: 5, hp: 25, aether: 27 }],
        ['an empty update', {}],
    ])('%s is known', (_name, statUpdates) => {
        const result = unknownStatKeys(statUpdates, [FORTITUDE, FOCUS, HEALTH]);

        expect(result).toEqual([]);
    });

    it.each([
        ['a stat no definition knows', { for: 6, luck: 3 }, ['luck']],
        ['several unknown stats, in request order', { zeal: 1, for: 4, luck: 3 }, ['zeal', 'luck']],
        ['a stat whose definition is not passed in', { foc: 4 }, ['foc']],
    ])('%s is reported', (_name, statUpdates, expected) => {
        const result = unknownStatKeys(statUpdates, [FORTITUDE, HEALTH]);

        expect(result).toEqual(expected);
    });
});

const SIX_PRIMARY_STATS = ['foc', 'con', 'res', 'ins', 'pre', 'for'];

function makeBaseStats(overrides = {}) {
    return { foc: 5, con: 5, res: 5, ins: 5, pre: 5, for: 5, ...overrides };
}

function derivedStatsOf({ baseStats = makeBaseStats(), race = null, rankBonus = null, primaryStatNames = SIX_PRIMARY_STATS } = {}) {
    return computeDerivedStats({ baseStats, race, rankBonus, primaryStatNames });
}

describe('derived stats', () => {
    // All six stats at 5, no race, no rank: primary sum 30
    // reactions (5 + 5) / 2 + 5 × 0.165 = 5.825; speed 15 / 3 + 0.825 = 5.825
    // hp 5 × 2 + 5 × 3 = 25; aether √30 × 5 = 27.39
    it('a character with every stat at 5 and no race or rank', () => {
        const result = derivedStatsOf();

        expect(result).toEqual({ reactions: 5, speed: 5, hp: 25, aether: 27 });
    });

    it.each([
        // reactions (10 + 5) / 2 + 0.825 = 8.325; aether √35 × 5 = 29.58
        ['focus raises reactions and aether', { foc: 10 }, { reactions: 8, speed: 5, hp: 25, aether: 29 }],
        // speed 20 / 3 + 0.825 = 7.49; hp 10 + 30 = 40
        ['control raises speed, hp (×3) and aether', { con: 10 }, { reactions: 5, speed: 7, hp: 40, aether: 29 }],
        // speed 7.49; hp 20 + 15 = 35
        ['resilience raises speed, hp (×2) and aether', { res: 10 }, { reactions: 5, speed: 7, hp: 35, aether: 29 }],
        // reactions 15 / 2 + 10 × 0.165 = 9.15
        ['instinct raises reactions and aether', { ins: 10 }, { reactions: 9, speed: 5, hp: 25, aether: 29 }],
        ['presence raises only aether', { pre: 10 }, { reactions: 5, speed: 5, hp: 25, aether: 29 }],
        // speed 20 / 3 + 10 × 0.165 = 8.32
        ['force raises speed and aether', { for: 10 }, { reactions: 5, speed: 8, hp: 25, aether: 29 }],
    ])('raising one stat from 5 to 10: %s', (_name, overrides, expected) => {
        const result = derivedStatsOf({ baseStats: makeBaseStats(overrides) });

        expect(result).toEqual(expected);
    });

    it('a character without any primary stat set has nothing derived', () => {
        const result = derivedStatsOf({ baseStats: {} });

        expect(result).toEqual({ reactions: 0, speed: 0, hp: 0, aether: 0 });
    });

    it.each([
        ['a race with no bonuses changes nothing', { healthBonus: 0, manaBonus: 0, speedBonus: 0 }, { reactions: 5, speed: 5, hp: 25, aether: 27 }],
        ['a race health bonus is added to hp', { healthBonus: 20, manaBonus: 0, speedBonus: 0 }, { reactions: 5, speed: 5, hp: 45, aether: 27 }],
        // aether 10 + 27.39 = 37.39
        ['a race mana bonus is added to aether', { healthBonus: 0, manaBonus: 10, speedBonus: 0 }, { reactions: 5, speed: 5, hp: 25, aether: 37 }],
        // speed 5.825 + 3 = 8.825
        ['a race speed bonus is added to speed', { healthBonus: 0, manaBonus: 0, speedBonus: 3 }, { reactions: 5, speed: 8, hp: 25, aether: 27 }],
        // INS 9: reactions 14 / 2 + 9 × 0.165 = 8.485; aether √34 × 5 = 29.15
        ['a race instinct bonus raises instinct', { instinctBonus: 4 }, { reactions: 8, speed: 5, hp: 25, aether: 29 }],
        // FOC 9: reactions 14 / 2 + 0.825 = 7.825; aether √34 × 5 = 29.15
        ['a race focus bonus raises focus', { focusBonus: 4 }, { reactions: 7, speed: 5, hp: 25, aether: 29 }],
        // CON 9: speed 19 / 3 + 0.825 = 7.16; hp 10 + 27 = 37
        ['a race control bonus raises control', { controlBonus: 4 }, { reactions: 5, speed: 7, hp: 37, aether: 29 }],
        // RES 9: speed 7.16; hp 18 + 15 = 33
        ['a race resilience bonus raises resilience', { resilienceBonus: 4 }, { reactions: 5, speed: 7, hp: 33, aether: 29 }],
        ['a race presence bonus raises presence', { presenceBonus: 4 }, { reactions: 5, speed: 5, hp: 25, aether: 29 }],
        // FOR 9: speed 19 / 3 + 9 × 0.165 = 7.82
        ['a race force bonus raises force', { forceBonus: 4 }, { reactions: 5, speed: 7, hp: 25, aether: 29 }],
        // G4 regression: the formula used to read focBonus, insBonus, ..., which no races column is named
        ['a bonus keyed by the stat internal name (insBonus) is not a races column and is ignored', { insBonus: 4 }, { reactions: 5, speed: 5, hp: 25, aether: 27 }],
    ])('%s', (_name, race, expected) => {
        const result = derivedStatsOf({ race });

        expect(result).toEqual(expected);
    });

    it.each([
        ['a rank with no percentages changes nothing', { hpPercent: 0, aetherPercent: 0 }, { reactions: 5, speed: 5, hp: 25, aether: 27 }],
        // hp 25 × 1.04 = 26; aether 27.39 × 1.03 = 28.21
        ['a rank adds its hp and aether percentages', { hpPercent: 4, aetherPercent: 3 }, { reactions: 5, speed: 5, hp: 26, aether: 28 }],
        // hp 25 × 1.1 = 27.5
        ['the rank-raised hp is floored', { hpPercent: 10, aetherPercent: 0 }, { reactions: 5, speed: 5, hp: 27, aether: 27 }],
        // hp 25 × 2 = 50; aether 27.39 × 1.5 = 41.08
        ['a rank can double hp and add half to aether', { hpPercent: 100, aetherPercent: 50 }, { reactions: 5, speed: 5, hp: 50, aether: 41 }],
    ])('%s', (_name, rankBonus, expected) => {
        const result = derivedStatsOf({ rankBonus });

        expect(result).toEqual(expected);
    });

    it('race bonuses and rank percentages combine', () => {
        const result = computeDerivedStats({
            baseStats: { for: 10, con: 8, res: 6, foc: 4, ins: 2 },
            race: { forceBonus: 2, speedBonus: 1, healthBonus: 5, manaBonus: 3 },
            rankBonus: { hpPercent: 10, aetherPercent: 20 },
            primaryStatNames: ['for', 'con', 'res', 'foc', 'ins'],
        });

        // FOR 12 (10 + race 2), CON 8, RES 6, FOC 4, INS 2, sum 32
        // reactions (2 + 4) / 2 + 2 × 0.165 = 3.33; speed 26 / 3 + 12 × 0.165 + 1 = 11.65
        // hp (6 × 2 + 8 × 3 + 5) × 1.1 = 45.1; aether (3 + √32 × 5) × 1.2 = 37.54
        expect(result).toEqual({ reactions: 3, speed: 11, hp: 45, aether: 37 });
    });
});

describe('cumulative rank bonus', () => {
    // Ranks 1-4 as seeded: rank 1 grants nothing, every rank above it +4% hp and +3% aether
    function makeSeededRanks() {
        return [
            { level: 3, hpPercent: 4, aetherPercent: 3 },
            { level: 1, hpPercent: 0, aetherPercent: 0 },
            { level: 4, hpPercent: 4, aetherPercent: 3 },
            { level: 2, hpPercent: 4, aetherPercent: 3 },
        ];
    }

    it.each([
        ['rank 1 has no bonus', 1, { hpPercent: 0, aetherPercent: 0 }],
        ['rank 2 has its own percentages', 2, { hpPercent: 4, aetherPercent: 3 }],
        ['rank 3 adds rank 2 and rank 3', 3, { hpPercent: 8, aetherPercent: 6 }],
        ['rank 4 adds every rank up to it', 4, { hpPercent: 12, aetherPercent: 9 }],
        ['a rank above the last defined one stops at the last', 9, { hpPercent: 12, aetherPercent: 9 }],
    ])('%s', (_name, level, expected) => {
        const result = cumulativeRankBonus(makeSeededRanks(), level);

        expect(result).toEqual(expected);
    });

    it('with no ranks defined there is no bonus', () => {
        const result = cumulativeRankBonus([], 3);

        expect(result).toEqual({ hpPercent: 0, aetherPercent: 0 });
    });

    it('a rank row without percentages adds nothing', () => {
        const result = cumulativeRankBonus([{ level: 1 }, { level: 2, hpPercent: 4, aetherPercent: 3 }], 2);

        expect(result).toEqual({ hpPercent: 4, aetherPercent: 3 });
    });
});

// Ranks 2-4 from the spec table (docs/game_design.md §1.5), listed out of order on purpose
function makeRanks() {
    return [
        { level: 4, requiredExperience: 1200, statPoints: 16, skillPoints: 3, aetherPercent: 3, hpPercent: 4 },
        { level: 2, requiredExperience: 500, statPoints: 16, skillPoints: 3, aetherPercent: 3, hpPercent: 4 },
        { level: 3, requiredExperience: 750, statPoints: 16, skillPoints: 3, aetherPercent: 3, hpPercent: 4 },
    ];
}

function makeCharacter(overrides = {}) {
    return { rank: 1, experience: 0, statPoints: 0, skillPoints: 5, ...overrides };
}

describe('level-up', () => {
    it.each([
        ['one below rank 2 stays at rank 1', 499,
            { leveledUp: false, rank: 1, statPoints: 0, skillPoints: 5 }],
        ['exactly at rank 2 reaches rank 2', 500,
            { leveledUp: true, rank: 2, statPoints: 16, skillPoints: 8 }],
        ['one below rank 3 stops at rank 2', 749,
            { leveledUp: true, rank: 2, statPoints: 16, skillPoints: 8 }],
        ['exactly at rank 3 climbs two ranks in one go', 750,
            { leveledUp: true, rank: 3, statPoints: 32, skillPoints: 11 }],
        ['one below rank 4 stops at rank 3', 1199,
            { leveledUp: true, rank: 3, statPoints: 32, skillPoints: 11 }],
        ['exactly at rank 4 climbs three ranks in one go', 1200,
            { leveledUp: true, rank: 4, statPoints: 48, skillPoints: 14 }],
        ['far past the last rank stops at the last rank', 50000,
            { leveledUp: true, rank: 4, statPoints: 48, skillPoints: 14 }],
    ])('experience %s', (_name, experience, expected) => {
        const result = levelUp(makeCharacter({ experience }), makeRanks());

        expect(result).toEqual(expected);
    });

    it('a character already at rank 2 only gains the ranks above it, on top of its unspent points', () => {
        const character = makeCharacter({ rank: 2, experience: 800, statPoints: 4, skillPoints: 1 });

        const result = levelUp(character, makeRanks());

        expect(result).toEqual({ leveledUp: true, rank: 3, statPoints: 20, skillPoints: 4 });
    });

    // G9 regression: level-up used to multiply stored hp/aether by the rank percent on top of the formula
    it('hp and aether are not touched by the level-up (the derived stats are recomputed instead)', () => {
        const character = makeCharacter({ experience: 500, stats: { hp: 100, aether: 50 } });

        const result = levelUp(character, makeRanks());

        expect(result).toEqual({ leveledUp: true, rank: 2, statPoints: 16, skillPoints: 8 });
    });

    it('a missing level stops the climb', () => {
        const result = levelUp(makeCharacter({ experience: 1000 }), makeRanks().filter(rank => rank.level !== 2));

        expect(result.leveledUp).toBe(false);
    });

    it('with no ranks defined nobody levels up', () => {
        const result = levelUp(makeCharacter({ experience: 1000 }), []);

        expect(result).toEqual({ leveledUp: false, rank: 1, statPoints: 0, skillPoints: 5 });
    });

    it('leaves the character it was given untouched', () => {
        const character = makeCharacter({ experience: 1200 });

        levelUp(character, makeRanks());

        expect(character).toEqual(makeCharacter({ experience: 1200 }));
    });
});
