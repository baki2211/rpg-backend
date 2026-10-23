/**
 * Decide whether a character may learn a skill, and what it has left afterwards.
 * A skill already known is refused first; otherwise the character needs at least the skill's
 * point cost (spending every remaining point is allowed).
 * @param {Object} params
 * @param {number} params.skillPoints - characters.skillPoints
 * @param {number} params.skillPointCost - skills.skillPointCost
 * @param {boolean} params.alreadyKnown - The character already has a character_skills row for the skill
 * @returns {{ allowed: boolean, reason: 'already_known'|'not_enough_points'|null, error: string|null,
 *             remainingSkillPoints: number }} `remainingSkillPoints` is unchanged when refused
 */
export function planSkillAcquisition({ skillPoints, skillPointCost, alreadyKnown }) {
    if (alreadyKnown) {
        return { allowed: false, reason: 'already_known', error: 'Character already has this skill', remainingSkillPoints: skillPoints };
    }
    if (skillPoints < skillPointCost) {
        return { allowed: false, reason: 'not_enough_points', error: 'Not enough skill points', remainingSkillPoints: skillPoints };
    }
    return { allowed: true, reason: null, error: null, remainingSkillPoints: skillPoints - skillPointCost };
}
