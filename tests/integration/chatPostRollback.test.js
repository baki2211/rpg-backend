import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import {
  makeUser, makeCharacter, makeLocation, makeSession, makeCombatRound, makeSkillType, makeSkill, giveSkill, makeRank,
} from './support/factories.js';

// Every d20 is 11 (Standard, x1.0)
vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));

const app = createApp();

// Largest value of a Postgres `int` column; one more point overflows characters."statPoints".
const MAX_INT = 2147483647;

describe('POST /api/chat/skills/:skillId when a later step of the post fails', () => {
  // Regression for F9/F5: the combat action (and its usage) committed before the message transaction,
  // so a failure afterwards left an orphan combat action. Now the whole post is one transaction.
  it('a level-up that cannot be saved rolls back the combat action, the skill use, the experience and the message', async () => {
    const player = await makeUser();
    const master = await makeUser({ role: 'master' });
    const location = await makeLocation();
    const round = await makeCombatRound({ location, createdBy: master, session: await makeSession({ location }) });
    // Reaching rank 2 would add MAX_INT stat points to the 1 the character has: the save fails in Postgres
    await makeRank({ level: 2, requiredExperience: 100, statPoints: MAX_INT, skillPoints: 1 });
    const character = await makeCharacter({ user: player, experience: 99.5, rank: 1, statPoints: 1, skillPoints: 5 });
    const barrier = await makeSkill({ type: await makeSkillType('Buff'), basePower: 9, target: 'self' });
    await giveSkill(character, barrier);
    const client = await logIn(app, player);

    const response = await client.post(`/api/chat/skills/${barrier.id}`, { locationId: location.id, message: 'b'.repeat(801) });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Internal Server Error' });
    expect(await query(`SELECT id FROM combat_actions WHERE "roundId" = $1`, [round.id])).toEqual([]);
    expect(await query(`SELECT id FROM chat_messages`)).toEqual([]);
    expect(await query(`SELECT uses FROM character_skills WHERE "characterId" = $1`, [character.id])).toEqual([{ uses: 0 }]);
    expect(await query(`SELECT uses FROM character_skill_branches WHERE "characterId" = $1`, [character.id])).toEqual([]);
    const [progress] = await query(
      `SELECT experience, rank, "statPoints", "skillPoints" FROM characters WHERE id = $1`,
      [character.id]
    );
    expect(progress).toEqual({ experience: 99.5, rank: 1, statPoints: 1, skillPoints: 5 });
  });
});
