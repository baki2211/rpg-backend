// Fields a master or admin may change when editing an NPC: identity, race, stats and progression.
// Ownership and control (id, userId, createdBy, isNPC, isActive) and timestamps are server-controlled:
// NPC activation and deactivation have their own routes.
export const NPC_UPDATABLE_FIELDS = [
    'name', 'surname', 'age', 'gender', 'background', 'imageUrl',
    'raceId', 'stats', 'rank', 'experience', 'skillPoints', 'statPoints'
];

/**
 * The part of an NPC edit request that may be written. Any other field is dropped, the same way
 * character creation drops fields a player may not set.
 * @param {Object} data - Request body
 * @returns {Object} A new object with only the updatable fields that were present
 */
export function pickNpcUpdatableFields(data) {
    return Object.fromEntries(
        NPC_UPDATABLE_FIELDS.filter(field => data[field] !== undefined).map(field => [field, data[field]])
    );
}
