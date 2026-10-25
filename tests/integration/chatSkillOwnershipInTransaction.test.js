import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { AppDataSource } from '../../src/data-source.js';
import { logIn } from './support/auth.js';
import { query, untilABackendWaitsOnALock } from './support/database.js';
import { makeUser, makeCharacter, makeLocation, makeSkillType, makeSkill, giveSkill } from './support/factories.js';

// Every d20 is 11 (Standard, x1.0)
vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));

const app = createApp();

/**
 * Another transaction holding the character's row lock, so a post waits at the start of its own
 * transaction after its pre-checks have passed. `forgetSkillAndCommit` removes the learned skill, then commits.
 */
async function holdCharacterRow(character) {
  const runner = AppDataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  await runner.query(`SELECT id FROM characters WHERE id = $1 FOR UPDATE`, [character.id]);
  return {
    forgetSkillAndCommit: async (skill) => {
      await runner.query(`DELETE FROM character_skills WHERE "characterId" = $1 AND "skillId" = $2`, [character.id, skill.id]);
      await runner.commitTransaction();
      await runner.release();
    },
  };
}

describe('POST /api/chat/skills/:skillId when the skill is lost while the post waits', () => {
  // L25: ownership was checked only before the post's transaction, so a chat-only use (no combat round)
  // still posted the skill and counted its branch use after the character no longer had the skill.
  it('a skill removed before the post commits is forbidden and the post changes nothing', async () => {
    const player = await makeUser();
    const location = await makeLocation();
    const character = await makeCharacter({ user: player, experience: 3 });
    const barrier = await makeSkill({ type: await makeSkillType('Buff'), target: 'self' });
    await giveSkill(character, barrier);
    const client = await logIn(app, player);
    const holder = await holdCharacterRow(character);

    const pending = client.post(`/api/chat/skills/${barrier.id}`, { locationId: location.id, message: 'b'.repeat(801) });
    await untilABackendWaitsOnALock();
    await holder.forgetSkillAndCommit(barrier);
    const response = await pending;

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Character does not have this skill' });
    expect(await query(`SELECT id FROM chat_messages`)).toEqual([]);
    expect(await query(`SELECT uses FROM character_skill_branches`)).toEqual([]);
    const [{ experience }] = await query(`SELECT experience FROM characters WHERE id = $1`, [character.id]);
    expect(experience).toBe(3);
  });
});
