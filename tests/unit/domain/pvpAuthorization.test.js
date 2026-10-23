import { describe, it, expect } from 'vitest';
import { canResolvePvPEncounter } from '../../../src/domain/combat/pvpAuthorization.js';

const makeRequest = (overrides = {}) => ({
    userId: 7,
    role: 'user',
    attackerOwnerId: 1,
    defenderOwnerId: 2,
    ...overrides,
});

describe('who may resolve a PvP encounter', () => {
    it.each([
        ['the owner of the attacker', 7, 2, true],
        ['the owner of the defender', 1, 7, true],
        ['the owner of both characters', 7, 7, true],
        ['a player who owns neither character', 1, 2, false],
        ['a player facing an unowned NPC they do not control', null, 2, false],
    ])('%s with a player role', (_name, attackerOwnerId, defenderOwnerId, expected) => {
        const request = makeRequest({ attackerOwnerId, defenderOwnerId });

        const allowed = canResolvePvPEncounter(request);

        expect(allowed).toBe(expected);
    });

    it.each([
        ['an admin', 'admin', true],
        ['a master', 'master', true],
        ['a staffer', 'staffer', false],
        ['a player', 'user', false],
    ])('%s who owns neither character', (_name, role, expected) => {
        const request = makeRequest({ role, attackerOwnerId: 1, defenderOwnerId: 2 });

        const allowed = canResolvePvPEncounter(request);

        expect(allowed).toBe(expected);
    });

    it('a caller without a user id is refused even when both characters are unowned NPCs', () => {
        const request = makeRequest({ userId: undefined, attackerOwnerId: undefined, defenderOwnerId: null });

        const allowed = canResolvePvPEncounter(request);

        expect(allowed).toBe(false);
    });
});
