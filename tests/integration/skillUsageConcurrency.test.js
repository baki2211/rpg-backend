import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { AppDataSource } from '../../src/data-source.js';
import { logIn } from './support/auth.js';
import { query, untilABackendWaitsOnALock } from './support/database.js';
import { makeUser, makeCharacter, makeSkillType, makeSkillBranch, makeSkill, giveSkill } from './support/factories.js';

// Every d20 is 11 (Standard, x1.0)
vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));

const app = createApp();

/**
 * Another first use of the branch, held open in its own transaction: it has inserted the character's
 * character_skill_branches row (not counted yet) and not committed. FK triggers are off for this one
 * transaction (session_replication_role), so the insert doesn't take a key-share lock on the character
 * row and the request under test gets past its character lock to the branch row.
 */
async function openConcurrentFirstUseOfBranch({ character, branch }) {
  const runner = AppDataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  await runner.query(`SET LOCAL session_replication_role = replica`);
  await runner.query(
    `INSERT INTO character_skill_branches ("characterId", "branchId", uses, rank) VALUES ($1, $2, 0, 1)`,
    [character.id, branch.id]
  );
  return {
    commit: async () => {
      await runner.commitTransaction();
      await runner.release();
    },
  };
}

describe('skill usage counted by concurrent operations', () => {
  // L5: the first use of a branch inserted its character_skill_branches row after a failed lookup,
  // so when another first use had inserted the row but not committed yet, the second insert waited
  // on it and then failed on the unique index.
  it('a first use of a branch while another first use holds the new branch row uncommitted is counted on that row', async () => {
    const player = await makeUser();
    const character = await makeCharacter({ user: player, stats: { hp: 50, aether: 30 } });
    const branch = await makeSkillBranch();
    const strike = await makeSkill({ branch, type: await makeSkillType('Buff'), target: 'self' });
    await giveSkill(character, strike, { uses: 3 });
    const client = await logIn(app, player);
    const concurrent = await openConcurrentFirstUseOfBranch({ character, branch });

    const pending = client.post('/api/skills/use', { characterId: character.id, skillId: strike.id });
    await untilABackendWaitsOnALock();
    await concurrent.commit();
    const response = await pending;

    expect(response.status).toBe(200);
    const branchRows = await query(`SELECT "characterId", "branchId", uses, rank FROM character_skill_branches`);
    expect(branchRows).toEqual([{ characterId: character.id, branchId: branch.id, uses: 1, rank: 1 }]);
    const skillRows = await query(`SELECT "skillId", uses FROM character_skills`);
    expect(skillRows).toEqual([{ skillId: strike.id, uses: 4 }]);
  });

  // L6: each encounter locked the attacker's usage rows, then the defender's. Two encounters with the
  // sides swapped took the same rows in opposite orders and could deadlock.
  // Smoke test, probabilistic: the two requests may or may not interleave on a given run, so a pass
  // doesn't prove the lock order, but a deadlock here would surface as a 500.
  it('two simultaneous encounters with the sides swapped both resolve and count two uses per side', async () => {
    const master = await makeUser({ role: 'master' });
    const first = await makeCharacter({ user: await makeUser() });
    const second = await makeCharacter({ user: await makeUser() });
    const firstSkill = await makeSkill({ type: await makeSkillType('Attack'), basePower: 15, target: 'other' });
    const secondSkill = await makeSkill({ type: await makeSkillType('Attack'), basePower: 10, target: 'other' });
    await giveSkill(first, firstSkill, { uses: 4 });
    await giveSkill(second, secondSkill, { uses: 7 });
    const client = await logIn(app, master);

    const responses = await Promise.all([
      client.post('/api/pvp/resolve', {
        attackerId: first.id, attackerSkillId: firstSkill.id, defenderId: second.id, defenderSkillId: secondSkill.id,
      }),
      client.post('/api/pvp/resolve', {
        attackerId: second.id, attackerSkillId: secondSkill.id, defenderId: first.id, defenderSkillId: firstSkill.id,
      }),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    const skillUses = await query(`SELECT "characterId", "skillId", uses FROM character_skills ORDER BY "characterId"`);
    expect(skillUses).toEqual([
      { characterId: first.id, skillId: firstSkill.id, uses: 6 },
      { characterId: second.id, skillId: secondSkill.id, uses: 9 },
    ]);
    const branchUses = await query(`SELECT "characterId", "branchId", uses FROM character_skill_branches ORDER BY "characterId"`);
    expect(branchUses).toEqual([
      { characterId: first.id, branchId: firstSkill.branchId, uses: 2 },
      { characterId: second.id, branchId: secondSkill.branchId, uses: 2 },
    ]);
  });
});
