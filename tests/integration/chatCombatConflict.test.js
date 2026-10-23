import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { AppDataSource } from '../../src/data-source.js';
import { logIn } from './support/auth.js';
import { query, untilABackendWaitsOnALock } from './support/database.js';
import {
  makeUser, makeCharacter, makeLocation, makeSession, makeCombatRound, makeSkillType, makeSkill, giveSkill,
} from './support/factories.js';

// Every d20 is 11 (Standard, x1.0)
vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));

const app = createApp();

/**
 * A concurrent combat submission for the same character and round, held open in its own transaction.
 * FK triggers are off for this one transaction (session_replication_role), so the insert doesn't take a
 * key-share lock on the character row and the chat post can get past its row lock and existence check.
 */
async function openConcurrentCombatAction({ round, character, skill }) {
  const runner = AppDataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  await runner.query(`SET LOCAL session_replication_role = replica`);
  await runner.query(
    `INSERT INTO combat_actions ("roundId", "characterId", "skillId", "targetId", "finalOutput", "outcomeMultiplier", "rollQuality")
     VALUES ($1, $2, $3, $2, 7, 1.0, 'Standard')`,
    [round.id, character.id, skill.id]
  );
  return {
    commit: async () => {
      await runner.commitTransaction();
      await runner.release();
    },
  };
}

describe('POST /api/chat/skills/:skillId racing another combat submission', () => {
  // Regression for L14: the unique-index violation was re-wrapped as a 500 carrying the raw SQL error text
  it('the chat post that loses the race gets a 409 with a generic message and saves nothing', async () => {
    const player = await makeUser();
    const master = await makeUser({ role: 'master' });
    const location = await makeLocation();
    const session = await makeSession({ location });
    const round = await makeCombatRound({ location, createdBy: master, session });
    const character = await makeCharacter({ user: player });
    const barrier = await makeSkill({ type: await makeSkillType('Buff'), basePower: 9, target: 'self' });
    await giveSkill(character, barrier);
    const client = await logIn(app, player);
    const concurrent = await openConcurrentCombatAction({ round, character, skill: barrier });

    const pending = client.post(`/api/chat/skills/${barrier.id}`, { locationId: location.id, message: 'b'.repeat(801) });
    await untilABackendWaitsOnALock();
    await concurrent.commit();
    const response = await pending;

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: `Failed to submit ${barrier.name} to combat: The request conflicts with an existing record`,
    });
    const actions = await query(`SELECT "characterId", "finalOutput" FROM combat_actions WHERE "roundId" = $1`, [round.id]);
    expect(actions).toEqual([{ characterId: character.id, finalOutput: 7 }]);
    expect(await query(`SELECT id FROM chat_messages WHERE "characterId" = $1`, [character.id])).toEqual([]);
    const [{ uses, experience }] = await query(
      `SELECT cs.uses, c.experience FROM character_skills cs JOIN characters c ON c.id = cs."characterId"
       WHERE cs."characterId" = $1 AND cs."skillId" = $2`,
      [character.id, barrier.id]
    );
    expect({ uses, experience }).toEqual({ uses: 0, experience: 0 });
  });
});
