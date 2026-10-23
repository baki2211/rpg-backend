// Experience gained by one qualifying chat post.
const EXPERIENCE_PER_POST = 0.5;

// Fallbacks used when the CombatConstant rows are missing or not numeric.
// Also the seed values of the chat_system rows (CombatConstantService.initializeDefaultConstants).
export const DEFAULT_CHAT_RULES = Object.freeze({ minLength: 800, cooldownMs: 30000 });

// CombatConstant keys that tune chat rewards.
export const CHAT_RULE_KEYS = Object.freeze({ minLength: 'CHAT_POST_MIN_LENGTH', cooldownMs: 'CHAT_XP_COOLDOWN_MS' });

/**
 * Read the chat reward tunables from CombatConstant rows, falling back to the defaults.
 * @param {Array<{ constantKey: string, value: number|string }>} constants - Active CombatConstant rows
 * @returns {{ minLength: number, cooldownMs: number }}
 */
export function chatRulesFromConstants(constants) {
    const valueOf = (key, fallback) => {
        const row = constants.find(constant => constant.constantKey === key);
        const value = Number(row?.value);
        return row && Number.isFinite(value) ? value : fallback;
    };

    return {
        minLength: valueOf(CHAT_RULE_KEYS.minLength, DEFAULT_CHAT_RULES.minLength),
        cooldownMs: valueOf(CHAT_RULE_KEYS.cooldownMs, DEFAULT_CHAT_RULES.cooldownMs),
    };
}

/**
 * Decide what a chat post earns.
 * A post longer than minLength counts as a valid post (session participation). It also grants
 * experience unless the author's previous post is less than cooldownMs old.
 * @param {Object} params
 * @param {number} params.length - Message length in characters
 * @param {number|null} params.lastPostAt - Timestamp (ms) of the author's previous post, null if none
 * @param {number} params.now - Current timestamp (ms)
 * @param {number} params.minLength - A post must be strictly longer than this to count
 * @param {number} params.cooldownMs - Minimum time between two experience-granting posts
 * @returns {{ isValidPost: boolean, grantsExperience: boolean, experienceDelta: number }}
 */
export function evaluatePost({ length, lastPostAt, now, minLength, cooldownMs }) {
    const isValidPost = length > minLength;
    const cooledDown = lastPostAt === null || now - lastPostAt >= cooldownMs;
    const grantsExperience = isValidPost && cooledDown;

    return {
        isValidPost,
        grantsExperience,
        experienceDelta: grantsExperience ? EXPERIENCE_PER_POST : 0,
    };
}
