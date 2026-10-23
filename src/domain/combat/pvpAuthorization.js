import { MASTER_OR_ADMIN_ROLES } from '../roles.js';

/**
 * Decide whether a user may resolve a PvP encounter.
 * Staff (admin, master) may resolve any encounter. Anyone else must own the attacker or the defender.
 * NPCs without an owner (`userId` null) never grant access by ownership.
 * @param {Object} params
 * @param {number} params.userId - The caller's user id
 * @param {string} params.role - The caller's role ('user' | 'staffer' | 'master' | 'admin')
 * @param {number|null|undefined} params.attackerOwnerId - `userId` of the attacking character
 * @param {number|null|undefined} params.defenderOwnerId - `userId` of the defending character
 * @returns {boolean}
 */
export function canResolvePvPEncounter({ userId, role, attackerOwnerId, defenderOwnerId }) {
    if (MASTER_OR_ADMIN_ROLES.includes(role)) {
        return true;
    }
    if (userId == null) {
        return false;
    }
    return attackerOwnerId === userId || defenderOwnerId === userId;
}
