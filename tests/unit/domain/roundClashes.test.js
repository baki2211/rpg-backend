import { describe, it, expect } from 'vitest';
import { actionsClash, identifyClashes, resolveActionClash, summarizeIndependentAction } from '../../../src/domain/combat/roundClashes.js';

// A submitted round action: who acts, on whom, with which skill type (the raw skill_types.name).
function makeSubmission(id, characterId, targetId, type) {
    return { id, characterId, targetId, skillData: { type } };
}

// A round action with the snapshots stored on combat_actions, as used for the round result.
function makeAction({ character, skill, type, target = 'other', targetName = null, finalOutput, rollQuality = 'Standard' }) {
    return {
        characterData: { name: character },
        skillData: { name: skill, type, target },
        targetData: targetName ? { name: targetName } : null,
        finalOutput,
        rollQuality,
    };
}

function idsOf({ clashes, independentActions }) {
    return {
        clashes: clashes.map(pair => pair.map(action => action.id)),
        independent: independentActions.map(action => action.id),
    };
}

// Characters 10, 20, 30, 40 and 99; a submission is (id, character, target, skill type).
const CLASHING_PAIRS = [
    ['two attacks aimed at each other', [1, 10, 20, 'Attack'], [2, 20, 10, 'Attack']],
    ['an attack and the self-defence of its target', [1, 10, 20, 'Attack'], [2, 20, 20, 'Defence']],
    ['an attack and the self-defence of its target, spelled Defense', [1, 10, 20, 'Attack'], [2, 20, 20, 'Defense']],
    ['an attack and a third party defending the same target', [1, 10, 20, 'Attack'], [2, 30, 20, 'Defence']],
    ['an attack and a third party defending the same target, spelled Defense', [1, 10, 20, 'Attack'], [2, 30, 20, 'Defense']],
    ['an attack and a defence aimed at the attacker', [1, 10, 99, 'Attack'], [2, 20, 10, 'Defence']],
    ['an attack on a character who is defending someone else', [1, 10, 20, 'Attack'], [2, 20, 30, 'Defence']],
    ['an attack and a counter between unrelated characters', [1, 10, 20, 'Attack'], [2, 30, 40, 'Counter']],
    ['an attack and a buff between unrelated characters', [1, 10, 20, 'Attack'], [2, 30, 40, 'Buff']],
    ['an attack and a healing between unrelated characters', [1, 10, 20, 'Attack'], [2, 30, 30, 'Healing']],
    ['an attack and a debuff between unrelated characters', [1, 10, 20, 'Attack'], [2, 30, 40, 'Debuff']],
    ['an attack and a crafting between unrelated characters', [1, 10, 20, 'Attack'], [2, 30, 30, 'Crafting']],
];

const NON_CLASHING_PAIRS = [
    ['two attacks on different targets', [1, 10, 20, 'Attack'], [2, 30, 40, 'Attack']],
    ['an attack whose target attacks someone else', [1, 10, 20, 'Attack'], [2, 20, 30, 'Attack']],
    ['an attack and an unrelated self-defence', [1, 10, 30, 'Attack'], [2, 20, 20, 'Defence']],
    ['an attack and an unrelated self-defence, spelled Defense', [1, 10, 30, 'Attack'], [2, 20, 20, 'Defense']],
    ['an attack and a passive skill', [1, 10, 20, 'Attack'], [2, 20, 10, 'Passive']],
    ['two defences', [1, 10, 10, 'Defence'], [2, 20, 20, 'Defence']],
    ['two counters aimed at each other', [1, 10, 20, 'Counter'], [2, 20, 10, 'Counter']],
    ['two buffs', [1, 10, 20, 'Buff'], [2, 30, 40, 'Buff']],
    ['a buff and a debuff', [1, 10, 20, 'Buff'], [2, 30, 40, 'Debuff']],
    ['a healing and a defence', [1, 10, 20, 'Healing'], [2, 30, 30, 'Defence']],
    ['a counter and a defence aimed at each other', [1, 10, 20, 'Counter'], [2, 20, 10, 'Defence']],
];

describe('whether two round actions clash', () => {
    it.each(CLASHING_PAIRS)('%s clash', (_name, first, second) => {
        const result = actionsClash(makeSubmission(...first), makeSubmission(...second));

        expect(result).toBe(true);
    });

    it.each(CLASHING_PAIRS)('%s clash when listed the other way round', (_name, first, second) => {
        const result = actionsClash(makeSubmission(...second), makeSubmission(...first));

        expect(result).toBe(true);
    });

    it.each(NON_CLASHING_PAIRS)('%s do not clash', (_name, first, second) => {
        const result = actionsClash(makeSubmission(...first), makeSubmission(...second));

        expect(result).toBe(false);
    });

    it.each(NON_CLASHING_PAIRS)('%s do not clash when listed the other way round', (_name, first, second) => {
        const result = actionsClash(makeSubmission(...second), makeSubmission(...first));

        expect(result).toBe(false);
    });
});

describe('pairing the actions of a round', () => {
    it.each([
        ['a round without actions has no clashes and no independent actions', [], [], []],
        ['a lone buff acts independently', [[1, 10, null, 'Buff']], [], [1]],
        ['two attackers aimed at each other form one clash', [[1, 10, 20, 'Attack'], [2, 20, 10, 'Attack']], [[1, 2]], []],
        ['two attacks on different targets act independently', [[1, 10, 20, 'Attack'], [2, 30, 40, 'Attack']], [], [1, 2]],
        ['a clash and an unrelated self-buff are kept apart', [[1, 10, 20, 'Attack'], [2, 20, 10, 'Attack'], [3, 30, 30, 'Buff']], [[1, 2]], [3]],
        [
            'two separate duels form two clashes',
            [[1, 10, 20, 'Attack'], [2, 20, 10, 'Attack'], [3, 30, 40, 'Attack'], [4, 40, 30, 'Attack']],
            [[1, 2], [3, 4]],
            [],
        ],
        ['an attack and the self-defence of its target form one clash', [[1, 10, 20, 'Attack'], [2, 20, 20, 'Defence']], [[1, 2]], []],
        ['a self-defence listed before the attack on it forms one clash, defence first', [[1, 20, 20, 'Defence'], [2, 10, 20, 'Attack']], [[1, 2]], []],
        ['an attack and a third party defending its target form one clash', [[1, 10, 30, 'Attack'], [2, 20, 30, 'Defence']], [[1, 2]], []],
        ['an attack and a third party defending its target, spelled Defense, form one clash', [[1, 10, 30, 'Attack'], [2, 20, 30, 'Defense']], [[1, 2]], []],
        ['an attack and an unrelated self-defence act independently', [[1, 10, 30, 'Attack'], [2, 20, 20, 'Defence']], [], [1, 2]],
        ['an attack and the counter of its target form one clash', [[1, 10, 20, 'Attack'], [2, 20, 10, 'Counter']], [[1, 2]], []],
        ['an attack and a counter between unrelated characters act independently', [[1, 10, 20, 'Attack'], [2, 30, 40, 'Counter']], [], [1, 2]],
        [
            'a third attacker on an already paired character acts alone',
            [[1, 10, 20, 'Attack'], [2, 20, 10, 'Attack'], [3, 30, 10, 'Attack']],
            [[1, 2]],
            [3],
        ],
        [
            'every action ends up in exactly one place',
            [[1, 10, 20, 'Attack'], [2, 20, 10, 'Attack'], [3, 30, 40, 'Attack'], [4, 50, 50, 'Buff']],
            [[1, 2]],
            [3, 4],
        ],
    ])('%s', (_name, submissions, clashes, independent) => {
        const actions = submissions.map(fields => makeSubmission(...fields));

        const result = identifyClashes(actions);

        expect(idsOf(result)).toEqual({ clashes, independent });
    });
});

describe('result of a clash between two round actions', () => {
    it('records both participants and the clash table result, the first action on the attacker side', () => {
        const attack = makeAction({ character: 'Aria', skill: 'Strike', type: 'Attack', targetName: 'Bram', finalOutput: 30 });
        const counter = makeAction({ character: 'Bram', skill: 'Riposte', type: 'Counter', targetName: 'Aria', finalOutput: 35, rollQuality: 'Critical' });

        const result = resolveActionClash(attack, counter);

        expect(result).toEqual({
            isClash: true,
            participants: [
                { character: 'Aria', skill: 'Strike', skillType: 'Attack', target: 'Bram', finalOutput: 30, rollQuality: 'Standard' },
                { character: 'Bram', skill: 'Riposte', skillType: 'Counter', target: 'Aria', finalOutput: 35, rollQuality: 'Critical' },
            ],
            winner: 'defender',
            damage: { attacker: 35, defender: 0 },
            effects: ['counter_successful', 'attacker_takes_counter_damage'],
            resolution: 'Counter successful! Attacker takes 35 damage from counter',
            details: 'Counter successful! Attacker takes 35 damage from counter',
        });
    });

    it('a participant without a target is shown as targeting itself', () => {
        const attack = makeAction({ character: 'Aria', skill: 'Strike', type: 'Attack', targetName: 'Bram', finalOutput: 30 });
        const guard = makeAction({ character: 'Bram', skill: 'Guard', type: 'Defence', target: 'self', finalOutput: 20 });

        const result = resolveActionClash(attack, guard);

        expect(result.participants[1].target).toBe('Self');
    });
});

describe('result of an action that clashed with nothing', () => {
    it.each([
        ['an action with a target shows the target name', 'other', 'Bob', 'Bob'],
        ['a self-targeted action without a target shows Self', 'self', null, 'Self'],
        ['an area action without a target shows Area', 'area', null, 'Area'],
    ])('%s', (_name, skillTarget, targetName, shownTarget) => {
        const action = makeAction({ character: 'Alice', skill: 'Strike', type: 'Attack', target: skillTarget, targetName, finalOutput: 20 });

        const result = summarizeIndependentAction(action);

        expect(result.target).toBe(shownTarget);
    });
});
