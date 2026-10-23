// Skill targets that join an active combat round without a chosen target.
const TARGETLESS_COMBAT_TARGETS = ['self', 'any', 'none'];

const OTHER_TARGET_NEEDS_SCENE =
    'Skills targeting other players can only be used during active events or combat rounds';

/**
 * Decide how a skill attached to a chat post is handled.
 * - An 'other' skill aimed at someone needs an active event or combat round.
 * - It goes into the combat round only when a round is active: 'other' skills when a target
 *   is chosen, 'self'/'any'/'none' skills always.
 * - Usage is counted once per post: by the combat submission when there is one, otherwise by
 *   the chat post itself when the post grants experience.
 * @param {Object} params
 * @param {string} params.skillTarget - The skill's `target` ('self' | 'other' | 'any' | 'none')
 * @param {boolean} params.hasSelectedTarget - The author picked a target in chat
 * @param {boolean} params.hasActiveEvent - The location has an active event
 * @param {boolean} params.hasActiveRound - The location has an active combat round
 * @param {boolean} params.grantsExperience - The post grants experience (see evaluatePost)
 * @returns {{ allowed: boolean, error: string|null, submitToCombat: boolean,
 *             incrementUsageInChat: boolean, writeEngineLog: boolean }}
 */
export function planChatSkillUse({ skillTarget, hasSelectedTarget, hasActiveEvent, hasActiveRound, grantsExperience }) {
    const targetsOther = skillTarget === 'other' && hasSelectedTarget;

    if (targetsOther && !hasActiveEvent && !hasActiveRound) {
        return {
            allowed: false,
            error: OTHER_TARGET_NEEDS_SCENE,
            submitToCombat: false,
            incrementUsageInChat: false,
            writeEngineLog: false,
        };
    }

    const submitToCombat = hasActiveRound && (targetsOther || TARGETLESS_COMBAT_TARGETS.includes(skillTarget));

    return {
        allowed: true,
        error: null,
        submitToCombat,
        incrementUsageInChat: grantsExperience && !submitToCombat,
        writeEngineLog: grantsExperience,
    };
}
