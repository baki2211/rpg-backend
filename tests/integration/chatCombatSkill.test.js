import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import {
  makeUser, makeCharacter, makeLocation, makeSession, makeCombatRound, makeSkillType, makeSkill, giveSkill,
} from './support/factories.js';

// Every d20 is 11 (Standard, x1.0)
vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));

const app = createApp();

describe('POST /api/chat/skills/:skillId during an active combat round', () => {
  // Regression for F5/N1: combat submission failures were swallowed, usage was counted twice, and the
  // chat message and the engine log came from two different rolls.
  it('a self skill launched in chat enters the round once, counts one use, and chat, round and engine log show the same output', async () => {
    const player = await makeUser();
    const master = await makeUser({ role: 'master' });
    const location = await makeLocation();
    const session = await makeSession({ location });
    const round = await makeCombatRound({ location, createdBy: master, session });
    const character = await makeCharacter({ user: player });
    const barrier = await makeSkill({ type: await makeSkillType('Buff'), basePower: 9, target: 'self' });
    await giveSkill(character, barrier);
    const client = await logIn(app, player);

    const response = await client.post(`/api/chat/skills/${barrier.id}`, { locationId: location.id, message: 'b'.repeat(801) });

    // output: 9 * (1.0 + 1.0) * 1.0 = 18
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ characterId: character.id, skillId: barrier.id, skillOutput: 18, skillRoll: 'Standard Success' });
    const actions = await query(
      `SELECT "characterId", "skillId", "targetId", "finalOutput" FROM combat_actions WHERE "roundId" = $1`,
      [round.id]
    );
    expect(actions).toEqual([{ characterId: character.id, skillId: barrier.id, targetId: character.id, finalOutput: 18 }]);
    const [{ uses }] = await query(`SELECT uses FROM character_skills WHERE "characterId" = $1 AND "skillId" = $2`, [character.id, barrier.id]);
    expect(uses).toBe(1);
    const [message] = await query(`SELECT "skillOutput" FROM chat_messages WHERE "characterId" = $1`, [character.id]);
    const logs = await query(`SELECT "sessionId", skill, ("engineData"->>'finalOutput')::int AS "finalOutput" FROM engine_logs WHERE type = 'skill_use'`);
    expect(logs).toEqual([{ sessionId: session.id, skill: barrier.name, finalOutput: message.skillOutput }]);
    expect(message.skillOutput).toBe(18);
  });
});
