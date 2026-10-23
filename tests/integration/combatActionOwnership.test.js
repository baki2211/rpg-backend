import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import {
  makeUser, makeCharacter, makeLocation, makeSession, makeCombatRound, makeSkillType, makeSkill,
} from './support/factories.js';

// Every d20 is 11 (Standard, x1.0)
vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));

const app = createApp();

// L1: the combat endpoint accepted any skillId, learned or not. The chat path already refused it.
describe('POST /api/combat/rounds/:roundId/actions with a skill the character has not learned', () => {
  it('is forbidden like on the chat path and records no action', async () => {
    const player = await makeUser();
    const master = await makeUser({ role: 'master' });
    const location = await makeLocation();
    const round = await makeCombatRound({ location, createdBy: master, session: await makeSession({ location }) });
    await makeCharacter({ user: player });
    const target = await makeCharacter({ user: await makeUser() });
    const unlearned = await makeSkill({ type: await makeSkillType('Attack'), basePower: 12, target: 'other' });
    const client = await logIn(app, player);

    const response = await client.post(`/api/combat/rounds/${round.id}/actions`, { skillId: unlearned.id, targetId: target.id });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Character does not have this skill' });
    expect(await query(`SELECT id FROM combat_actions`)).toEqual([]);
    expect(await query(`SELECT * FROM character_skills`)).toEqual([]);
  });
});
