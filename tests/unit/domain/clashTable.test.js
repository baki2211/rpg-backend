import { describe, it, expect } from 'vitest';
import { skillTypeCategory, resolveClashByTable, determineClash, resolveEncounter } from '../../../src/domain/combat/clashTable.js';

function makeSkill({ type = 'Attack', target = 'other', name = 'Strike' } = {}) {
    return { name, target, type: type === null ? undefined : { name: type } };
}

function makeSide({ name = 'Aria', skill = makeSkill(), output = 30, roll = 11 } = {}) {
    return { character: { name }, skill, output, roll };
}

// Expected results, written out by hand. `attacker` is side A, `defender` is side B.
function clash(winner, effects, attacker, defender) {
    return { isClash: true, winner, effects, damage: { attacker, defender } };
}

function bothResolve(effects, attacker = 0, defender = 0) {
    return { isClash: false, winner: null, effects, damage: { attacker, defender } };
}

const NO_INTERACTION = bothResolve(['no_interaction']);
const INDEPENDENT = bothResolve(['both_resolve_independently']);
const BUFF_AND_DEBUFF = bothResolve(['both_resolve', 'buff_debuff_interaction']);

describe('clash category of a skill type', () => {
    it.each([
        ['Attack', 'Attack'],
        ['Defence', 'Defence'],
        ['Defense', 'Defence'],
        ['Counter', 'Counter'],
        ['Buff', 'Buff'],
        ['Debuff', 'Debuff'],
        ['Healing', 'Heal'],
        ['Crafting', 'Crafting'],
        ['Passive', 'Passive'],
        ['Fireball', 'Unknown'],
        ['attack', 'Unknown'],
        ['toString', 'Unknown'],
        [undefined, 'Unknown'],
        [null, 'Unknown'],
    ])('%s is %s', (typeName, expected) => {
        expect(skillTypeCategory(typeName)).toBe(expected);
    });
});

describe('clash table, every pair of categories (side A output 30, side B output 20, aimed at each other)', () => {
    it.each([
        ['Attack', 'Attack', clash('attacker', ['mutual_damage', 'both_take_full_output'], 20, 30)],
        ['Attack', 'Defence', clash('attacker', ['damage_absorbed', 'absorbed_20_damage'], 0, 10)],
        ['Attack', 'Counter', clash('attacker', ['counter_failed', 'defender_takes_attack_damage'], 0, 30)],
        ['Attack', 'Buff', bothResolve(['buff_heal_executed', 'attack_executed', 'both_resolve'], 0, 30)],
        ['Attack', 'Heal', bothResolve(['buff_heal_executed', 'attack_executed', 'both_resolve'], 0, 30)],
        ['Attack', 'Debuff', bothResolve(['debuff_applied', 'attack_executed', 'both_resolve'], 0, 30)],
        ['Attack', 'Crafting', clash('attacker', ['crafting_interrupted', 'crafting_output_negated'], 0, 30)],
        ['Attack', 'Passive', NO_INTERACTION],
        ['Attack', 'Unknown', NO_INTERACTION],

        ['Defence', 'Attack', clash('attacker', ['damage_absorbed', 'absorbed_20_damage'], 0, 0)],
        ['Defence', 'Defence', NO_INTERACTION],
        ['Defence', 'Counter', NO_INTERACTION],
        ['Defence', 'Buff', INDEPENDENT],
        ['Defence', 'Heal', INDEPENDENT],
        ['Defence', 'Debuff', NO_INTERACTION],
        ['Defence', 'Crafting', NO_INTERACTION],
        ['Defence', 'Passive', NO_INTERACTION],
        ['Defence', 'Unknown', NO_INTERACTION],

        ['Counter', 'Attack', clash('attacker', ['counter_successful', 'defender_takes_counter_damage'], 0, 30)],
        ['Counter', 'Defence', NO_INTERACTION],
        ['Counter', 'Counter', NO_INTERACTION],
        ['Counter', 'Buff', NO_INTERACTION],
        ['Counter', 'Heal', NO_INTERACTION],
        ['Counter', 'Debuff', NO_INTERACTION],
        ['Counter', 'Crafting', NO_INTERACTION],
        ['Counter', 'Passive', NO_INTERACTION],
        ['Counter', 'Unknown', NO_INTERACTION],

        ['Buff', 'Attack', bothResolve(['buff_heal_executed', 'attack_executed', 'both_resolve'], 20, 0)],
        // Defence vs Buff is "both resolve independently", but Buff vs Defence falls through to "no interaction"
        ['Buff', 'Defence', NO_INTERACTION],
        ['Buff', 'Counter', NO_INTERACTION],
        ['Buff', 'Buff', INDEPENDENT],
        ['Buff', 'Heal', INDEPENDENT],
        ['Buff', 'Debuff', BUFF_AND_DEBUFF],
        ['Buff', 'Crafting', NO_INTERACTION],
        ['Buff', 'Passive', NO_INTERACTION],
        ['Buff', 'Unknown', NO_INTERACTION],

        ['Heal', 'Attack', bothResolve(['buff_heal_executed', 'attack_executed', 'both_resolve'], 20, 0)],
        ['Heal', 'Defence', NO_INTERACTION],
        ['Heal', 'Counter', NO_INTERACTION],
        ['Heal', 'Buff', INDEPENDENT],
        ['Heal', 'Heal', INDEPENDENT],
        ['Heal', 'Debuff', BUFF_AND_DEBUFF],
        ['Heal', 'Crafting', NO_INTERACTION],
        ['Heal', 'Passive', NO_INTERACTION],
        ['Heal', 'Unknown', NO_INTERACTION],

        ['Debuff', 'Attack', bothResolve(['debuff_applied', 'attack_executed', 'both_resolve'], 20, 0)],
        ['Debuff', 'Defence', NO_INTERACTION],
        ['Debuff', 'Counter', NO_INTERACTION],
        ['Debuff', 'Buff', BUFF_AND_DEBUFF],
        ['Debuff', 'Heal', BUFF_AND_DEBUFF],
        ['Debuff', 'Debuff', NO_INTERACTION],
        ['Debuff', 'Crafting', NO_INTERACTION],
        ['Debuff', 'Passive', NO_INTERACTION],
        ['Debuff', 'Unknown', NO_INTERACTION],

        ['Crafting', 'Attack', clash('defender', ['crafting_interrupted', 'crafting_output_negated'], 20, 0)],
        ['Crafting', 'Defence', NO_INTERACTION],
        ['Crafting', 'Counter', NO_INTERACTION],
        ['Crafting', 'Buff', NO_INTERACTION],
        ['Crafting', 'Heal', NO_INTERACTION],
        ['Crafting', 'Debuff', NO_INTERACTION],
        ['Crafting', 'Crafting', NO_INTERACTION],
        ['Crafting', 'Passive', NO_INTERACTION],
        ['Crafting', 'Unknown', NO_INTERACTION],

        ['Passive', 'Attack', NO_INTERACTION],
        ['Passive', 'Defence', NO_INTERACTION],
        ['Passive', 'Counter', NO_INTERACTION],
        ['Passive', 'Buff', NO_INTERACTION],
        ['Passive', 'Heal', NO_INTERACTION],
        ['Passive', 'Debuff', NO_INTERACTION],
        ['Passive', 'Crafting', NO_INTERACTION],
        ['Passive', 'Passive', NO_INTERACTION],
        ['Passive', 'Unknown', NO_INTERACTION],

        ['Unknown', 'Attack', NO_INTERACTION],
        ['Unknown', 'Defence', NO_INTERACTION],
        ['Unknown', 'Counter', NO_INTERACTION],
        ['Unknown', 'Buff', NO_INTERACTION],
        ['Unknown', 'Heal', NO_INTERACTION],
        ['Unknown', 'Debuff', NO_INTERACTION],
        ['Unknown', 'Crafting', NO_INTERACTION],
        ['Unknown', 'Passive', NO_INTERACTION],
        ['Unknown', 'Unknown', NO_INTERACTION],
    ])('%s against %s', (typeA, typeB, expected) => {
        const result = resolveClashByTable(typeA, typeB, 30, 20, true);

        expect(result).toMatchObject(expected);
    });
});

describe('clash table, outputs on both sides of a tie', () => {
    it.each([
        ['attack against attack: the stronger attacker wins', 'Attack', 'Attack', 30, 20, 'attacker', { attacker: 20, defender: 30 }],
        ['attack against attack: the stronger defender wins', 'Attack', 'Attack', 20, 30, 'defender', { attacker: 30, defender: 20 }],
        ['attack against attack: equal outputs tie and both take the full output', 'Attack', 'Attack', 25, 25, 'tie', { attacker: 25, defender: 25 }],

        ['defence one weaker than the attack lets 1 through', 'Attack', 'Defence', 21, 20, 'attacker', { attacker: 0, defender: 1 }],
        ['defence equal to the attack absorbs it all', 'Attack', 'Defence', 20, 20, 'defender', { attacker: 0, defender: 0 }],
        ['defence one stronger than the attack absorbs it all', 'Attack', 'Defence', 19, 20, 'defender', { attacker: 0, defender: 0 }],

        ['a defence on side A one weaker than side B\'s attack lets 1 through to side A', 'Defence', 'Attack', 20, 21, 'defender', { attacker: 1, defender: 0 }],
        ['a defence on side A equal to side B\'s attack absorbs it all', 'Defence', 'Attack', 20, 20, 'attacker', { attacker: 0, defender: 0 }],
        ['a defence on side A one stronger than side B\'s attack absorbs it all', 'Defence', 'Attack', 21, 20, 'attacker', { attacker: 0, defender: 0 }],

        ['a counter one stronger than the attack hits the attacker with the counter output', 'Attack', 'Counter', 20, 21, 'defender', { attacker: 21, defender: 0 }],
        ['a counter equal to the attack fails and the defender takes the attack', 'Attack', 'Counter', 20, 20, 'attacker', { attacker: 0, defender: 20 }],
        ['a counter one weaker than the attack fails and the defender takes the attack', 'Attack', 'Counter', 21, 20, 'attacker', { attacker: 0, defender: 21 }],

        ['a counter on side A one stronger than side B\'s attack hits side B', 'Counter', 'Attack', 21, 20, 'attacker', { attacker: 0, defender: 21 }],
        ['a counter on side A equal to side B\'s attack fails and side A takes the attack', 'Counter', 'Attack', 20, 20, 'defender', { attacker: 20, defender: 0 }],
        ['a counter on side A one weaker than side B\'s attack fails and side A takes the attack', 'Counter', 'Attack', 20, 21, 'defender', { attacker: 21, defender: 0 }],
    ])('%s', (_name, typeA, typeB, outputA, outputB, winner, damage) => {
        const result = resolveClashByTable(typeA, typeB, outputA, outputB, true);

        expect(result).toMatchObject({ winner, damage });
    });
});

describe('clash table, aiming', () => {
    it('two attacks not aimed at each other do not interact', () => {
        const result = resolveClashByTable('Attack', 'Attack', 30, 20, false);

        expect(result).toEqual({
            isClash: false,
            winner: null,
            effects: ['no_interaction'],
            damage: { attacker: 0, defender: 0 },
            resolution: 'No clash: Both skills resolve independently',
        });
    });

    it.each([
        ['Attack', 'Defence', clash('attacker', ['damage_absorbed', 'absorbed_20_damage'], 0, 10)],
        ['Attack', 'Counter', clash('attacker', ['counter_failed', 'defender_takes_attack_damage'], 0, 30)],
        ['Counter', 'Attack', clash('attacker', ['counter_successful', 'defender_takes_counter_damage'], 0, 30)],
        ['Attack', 'Crafting', clash('attacker', ['crafting_interrupted', 'crafting_output_negated'], 0, 30)],
    ])('aiming only matters for two attacks: %s against %s clashes either way', (typeA, typeB, expected) => {
        const result = resolveClashByTable(typeA, typeB, 30, 20, false);

        expect(result).toMatchObject(expected);
    });
});

describe('clash table, resolution text', () => {
    it.each([
        ['Attack', 'Attack', 30, 20, 'Both attackers take damage: Attacker takes 20, Defender takes 30'],
        ['Attack', 'Defence', 30, 20, 'Defence absorbs 20 damage. Remaining damage: 10'],
        ['Attack', 'Counter', 30, 20, 'Counter failed! Defender takes 30 damage from attack'],
        ['Attack', 'Counter', 20, 30, 'Counter successful! Attacker takes 30 damage from counter'],
        ['Attack', 'Buff', 30, 20, 'Both resolve: Buff effect applied, then 30 damage dealt'],
        ['Attack', 'Heal', 30, 20, 'Both resolve: Heal effect applied, then 30 damage dealt'],
        ['Attack', 'Debuff', 30, 20, 'Both resolve: Debuff applied, then 30 damage dealt'],
        ['Attack', 'Crafting', 30, 20, 'Crafting interrupted by attack! Crafting output negated, 30 damage dealt'],
        ['Defence', 'Attack', 30, 20, 'Defence absorbs 20 damage. Remaining damage: 0'],
        ['Defence', 'Heal', 30, 20, 'Both resolve independently: Defence ready, Heal effect applied'],
        ['Counter', 'Attack', 30, 20, 'Counter successful! Defender takes 30 damage from counter'],
        ['Counter', 'Attack', 20, 30, 'Counter failed! Attacker takes 30 damage from attack'],
        ['Buff', 'Attack', 30, 20, 'Both resolve: Buff effect applied, then 20 damage dealt'],
        ['Debuff', 'Attack', 30, 20, 'Both resolve: Debuff applied, then 20 damage dealt'],
        ['Crafting', 'Attack', 30, 20, 'Crafting interrupted by attack! Crafting output negated, 20 damage dealt'],
        ['Heal', 'Buff', 30, 20, 'Both resolve independently: Heal and Buff effects both apply'],
        ['Buff', 'Debuff', 30, 20, 'Both resolve: Buff and Debuff effects both apply'],
        ['Debuff', 'Heal', 30, 20, 'Both resolve: Debuff and Heal effects both apply'],
        ['Passive', 'Attack', 30, 20, 'No clash: Both skills resolve independently'],
    ])('%s against %s, %i to %i, reads "%s"', (typeA, typeB, outputA, outputB, resolution) => {
        const result = resolveClashByTable(typeA, typeB, outputA, outputB, true);

        expect(result.resolution).toBe(resolution);
    });
});

describe('clash between two skills', () => {
    it.each([
        ['both target others', 'other', 'other', true],
        ['side A targets itself', 'self', 'other', false],
        ['side B targets itself', 'other', 'self', false],
        ['both target themselves', 'self', 'self', false],
        ['side B has no target', 'other', 'none', false],
    ])('two attacks clash only when both target others: %s', (_name, targetA, targetB, isClash) => {
        const result = determineClash(makeSkill({ target: targetA }), makeSkill({ target: targetB }), 30, 20);

        expect(result.isClash).toBe(isClash);
    });

    it('a healing skill is treated as a heal', () => {
        const result = determineClash(makeSkill(), makeSkill({ type: 'Healing', target: 'self' }), 25, 12);

        expect(result.resolution).toBe('Both resolve: Heal effect applied, then 25 damage dealt');
    });

    it('a defense skill spelled the American way absorbs like a defence', () => {
        const result = determineClash(makeSkill(), makeSkill({ type: 'Defense', target: 'self' }), 30, 20);

        expect(result).toMatchObject(clash('attacker', ['damage_absorbed', 'absorbed_20_damage'], 0, 10));
    });

    it.each([
        ['an unknown type name', 'Fireball'],
        ['no type at all', null],
    ])('a skill with %s does not interact with an attack', (_name, type) => {
        const result = determineClash(makeSkill(), makeSkill({ type }), 30, 20);

        expect(result).toMatchObject(NO_INTERACTION);
    });
});

describe('PvP encounter', () => {
    it('reports both sides with their real d20 roll and output, and the clash result', () => {
        const attacker = makeSide({ name: 'Aria', skill: makeSkill({ name: 'Strike' }), output: 30, roll: 11 });
        const defender = makeSide({ name: 'Bram', skill: makeSkill({ type: 'Defence', target: 'self', name: 'Guard' }), output: 20, roll: 7 });

        const result = resolveEncounter(attacker, defender);

        expect(result).toEqual({
            isClash: true,
            report: [
                { actor: 'Aria', target: 'Aria', roll: 11, skillType: 'Attack', skillName: 'Strike', output: 30 },
                { actor: 'Bram', target: 'Bram', roll: 7, skillType: 'Defence', skillName: 'Guard', output: 20 },
            ],
            winner: 'attacker',
            effects: ['damage_absorbed', 'absorbed_20_damage'],
            damage: { attacker: 0, defender: 10 },
            resolution: 'Defence absorbs 20 damage. Remaining damage: 10',
        });
    });

    it('a successful counter makes the defender the winner and hits the attacker', () => {
        const attacker = makeSide({ name: 'Aria', skill: makeSkill({ name: 'Strike' }), output: 20, roll: 9 });
        const defender = makeSide({ name: 'Bram', skill: makeSkill({ type: 'Counter', name: 'Riposte' }), output: 30, roll: 18 });

        const result = resolveEncounter(attacker, defender);

        expect(result).toEqual({
            isClash: true,
            report: [
                { actor: 'Aria', target: 'Bram', roll: 9, skillType: 'Attack', skillName: 'Strike', output: 20 },
                { actor: 'Bram', target: 'Aria', roll: 18, skillType: 'Counter', skillName: 'Riposte', output: 30 },
            ],
            winner: 'defender',
            effects: ['counter_successful', 'attacker_takes_counter_damage'],
            damage: { attacker: 30, defender: 0 },
            resolution: 'Counter successful! Attacker takes 30 damage from counter',
        });
    });

    it('two attacks at each other hit both sides and the higher output wins', () => {
        const attacker = makeSide({ name: 'Aria', output: 18 });
        const defender = makeSide({ name: 'Bram', output: 24 });

        const result = resolveEncounter(attacker, defender);

        expect(result).toMatchObject({ isClash: true, winner: 'defender', damage: { attacker: 24, defender: 18 } });
    });

    it('a skill without a type is reported as Unknown and nothing clashes', () => {
        const attacker = makeSide({ name: 'Aria', output: 30 });
        const defender = makeSide({ name: 'Bram', skill: makeSkill({ type: null, name: 'Mystery' }), output: 20, roll: 3 });

        const result = resolveEncounter(attacker, defender);

        expect(result).toMatchObject({
            isClash: false,
            winner: null,
            report: [
                { actor: 'Aria', target: 'Bram', skillType: 'Attack' },
                { actor: 'Bram', target: 'Aria', roll: 3, skillType: 'Unknown', skillName: 'Mystery', output: 20 },
            ],
            damage: { attacker: 0, defender: 0 },
        });
    });

    it('when the defender targets another character, each side targets the other', () => {
        const attacker = makeSide({ name: 'Aria' });
        const defender = makeSide({ name: 'Bram', skill: makeSkill({ type: 'Counter' }), output: 20, roll: 4 });

        const result = resolveEncounter(attacker, defender);

        expect(result.report.map(({ actor, target }) => ({ actor, target }))).toEqual([
            { actor: 'Aria', target: 'Bram' },
            { actor: 'Bram', target: 'Aria' },
        ]);
    });

    // Current behaviour, kept from before the extraction (RULEBOOK_REVIEW.md fix plan item 6, leftovers):
    // both report targets follow the defender's skill, so a self-buff on the attacker side is reported
    // as aimed at the defender.
    it('the report targets follow the defender\'s skill target, even for an attacker buffing itself', () => {
        const attacker = makeSide({ name: 'Aria', skill: makeSkill({ type: 'Buff', target: 'self', name: 'Focus' }), output: 15 });
        const defender = makeSide({ name: 'Bram', output: 20 });

        const result = resolveEncounter(attacker, defender);

        expect(result.report.map(({ actor, target }) => ({ actor, target }))).toEqual([
            { actor: 'Aria', target: 'Bram' },
            { actor: 'Bram', target: 'Aria' },
        ]);
    });
});
