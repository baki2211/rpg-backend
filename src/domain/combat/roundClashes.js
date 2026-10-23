import { skillTypeCategory, determineClash } from './clashTable.js';

// Combat round actions (combat_actions rows with their skillData / characterData / targetData snapshots):
// which pairs clash, and the result recorded for each clash or independent action.

/**
 * Whether two submitted actions clash.
 * @param {{ characterId: number, targetId: number|null, skillData: { type: string } }} action1
 * @param {{ characterId: number, targetId: number|null, skillData: { type: string } }} action2
 * @returns {boolean}
 */
export function actionsClash(action1, action2) {
    const type1 = skillTypeCategory(action1.skillData.type);
    const type2 = skillTypeCategory(action2.skillData.type);

    const action1TargetsAction2 = action1.targetId === action2.characterId;
    const action2TargetsAction1 = action2.targetId === action1.characterId;
    const targetsEachOther = action1TargetsAction2 && action2TargetsAction1;

    if (type1 === 'Attack' && type2 === 'Attack' && targetsEachOther) {
        return true;
    }

    if ((type1 === 'Attack' && type2 === 'Defence') ||
        (type1 === 'Defence' && type2 === 'Attack')) {

        const attackAction = type1 === 'Attack' ? action1 : action2;
        const defenceAction = type1 === 'Defence' ? action1 : action2;

        const attackTargetsDefended = attackAction.targetId === defenceAction.targetId;
        const defenceTargetsAttacker = defenceAction.targetId === attackAction.characterId;
        const attackTargetsDefender = attackAction.targetId === defenceAction.characterId;
        const isSelfDefense = defenceAction.targetId === defenceAction.characterId;
        const attacksDefensiveTarget = attackAction.targetId === defenceAction.characterId;

        if (targetsEachOther || attackTargetsDefended || defenceTargetsAttacker ||
            attackTargetsDefender || (isSelfDefense && attacksDefensiveTarget)) {
            return true;
        }
    }

    if ((type1 === 'Attack' && type2 === 'Counter') ||
        (type1 === 'Counter' && type2 === 'Attack')) {
        return true;
    }

    if ((type1 === 'Attack' && (type2 === 'Buff' || type2 === 'Heal')) ||
        ((type1 === 'Buff' || type1 === 'Heal') && type2 === 'Attack')) {
        return true;
    }

    if ((type1 === 'Attack' && type2 === 'Debuff') ||
        (type1 === 'Debuff' && type2 === 'Attack')) {
        return true;
    }

    if ((type1 === 'Attack' && type2 === 'Crafting') ||
        (type1 === 'Crafting' && type2 === 'Attack')) {
        return true;
    }

    return false;
}

/**
 * Pair up the actions of a round. Actions are taken in order; each one clashes with the first
 * unpaired candidate that clashes with it (actions targeting its character, actions by its target,
 * and for an attack the defences on the same target). Every action ends up in exactly one place.
 * @param {Array<{ id: number, characterId: number, targetId: number|null, skillData: { type: string } }>} actions
 * @returns {{ clashes: Array<[Object, Object]>, independentActions: Object[] }}
 */
export function identifyClashes(actions) {
    const clashes = [];
    const independentActions = [];
    const processedActions = new Set();

    const actionsByCharacter = new Map();
    const actionsByTarget = new Map();
    const actionsByType = new Map();

    actions.forEach(action => {
        if (!actionsByCharacter.has(action.characterId)) {
            actionsByCharacter.set(action.characterId, []);
        }
        actionsByCharacter.get(action.characterId).push(action);

        if (action.targetId) {
            if (!actionsByTarget.has(action.targetId)) {
                actionsByTarget.set(action.targetId, []);
            }
            actionsByTarget.get(action.targetId).push(action);
        }

        const skillType = skillTypeCategory(action.skillData.type);
        if (!actionsByType.has(skillType)) {
            actionsByType.set(skillType, []);
        }
        actionsByType.get(skillType).push(action);
    });

    actions.forEach(action1 => {
        if (processedActions.has(action1.id)) return;

        let clashFound = false;
        const potentialClashActions = new Set();

        const actionsTargetingChar = actionsByTarget.get(action1.characterId) || [];
        actionsTargetingChar.forEach(a => potentialClashActions.add(a));

        if (action1.targetId) {
            const actionsFromTarget = actionsByCharacter.get(action1.targetId) || [];
            actionsFromTarget.forEach(a => potentialClashActions.add(a));
        }

        const action1Type = skillTypeCategory(action1.skillData.type);
        if (action1Type === 'Attack' && action1.targetId) {
            const defenseActions = actionsByType.get('Defence') || [];
            defenseActions.forEach(defense => {
                if (defense.targetId === action1.targetId) {
                    potentialClashActions.add(defense);
                }
            });
        }

        for (const action2 of potentialClashActions) {
            if (processedActions.has(action2.id) || action1.id === action2.id) continue;

            if (actionsClash(action1, action2)) {
                clashes.push([action1, action2]);
                processedActions.add(action1.id);
                processedActions.add(action2.id);
                clashFound = true;
                break;
            }
        }

        if (!clashFound) {
            independentActions.push(action1);
            processedActions.add(action1.id);
        }
    });

    return { clashes, independentActions };
}

/**
 * Result of a clash between two round actions, by the clash table (action1 is the attacker side).
 * This is the object stored in combat_actions.clashResult and the round's resolutionData.
 * @param {Object} action1 - Combat action with skillData, characterData, targetData, finalOutput, rollQuality
 * @param {Object} action2 - Same shape
 * @returns {Object}
 */
export function resolveActionClash(action1, action2) {
    const clash = determineClash(skillOf(action1), skillOf(action2), action1.finalOutput, action2.finalOutput);

    return {
        isClash: clash.isClash,
        participants: [participant(action1), participant(action2)],
        winner: clash.winner,
        damage: clash.damage,
        effects: clash.effects,
        resolution: clash.resolution,
        details: clash.resolution || `${action1.characterData.name} (${action1.skillData.name}: ${action1.finalOutput}) vs ${action2.characterData.name} (${action2.skillData.name}: ${action2.finalOutput})`
    };
}

/**
 * Result of an action that clashed with nothing.
 * @param {Object} action - Combat action with skillData, characterData, targetData, finalOutput, rollQuality
 * @returns {Object}
 */
export function summarizeIndependentAction(action) {
    return {
        isClash: false,
        character: action.characterData.name,
        skill: action.skillData.name,
        skillType: action.skillData.type,
        target: action.targetData?.name || (action.skillData.target === 'self' ? 'Self' : 'Area'),
        finalOutput: action.finalOutput,
        rollQuality: action.rollQuality,
        details: `${action.characterData.name} used ${action.skillData.name} on ${action.targetData?.name || action.skillData.target} (Output: ${action.finalOutput})`
    };
}

function skillOf(action) {
    return { type: { name: action.skillData.type }, target: action.skillData.target };
}

function participant(action) {
    return {
        character: action.characterData.name,
        skill: action.skillData.name,
        skillType: action.skillData.type,
        target: action.targetData?.name || 'Self',
        finalOutput: action.finalOutput,
        rollQuality: action.rollQuality
    };
}
