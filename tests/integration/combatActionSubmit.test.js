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

describe('POST /api/combat/rounds/:roundId/actions', () => {
  // Regression for F2: target lookup asked for a `skills` relation Character doesn't have, so every
  // skill aimed at another character was rejected with 400.
  it('an attack on another character is recorded in the round against that target and counts one use', async () => {
    const player = await makeUser();
    const master = await makeUser({ role: 'master' });
    const location = await makeLocation();
    const round = await makeCombatRound({ location, createdBy: master, session: await makeSession({ location }) });
    const caster = await makeCharacter({ user: player });
    const target = await makeCharacter({ user: await makeUser() });
    const strike = await makeSkill({ type: await makeSkillType('Attack'), basePower: 12, target: 'other' });
    await giveSkill(caster, strike);
    const client = await logIn(app, player);

    const response = await client.post(`/api/combat/rounds/${round.id}/actions`, { skillId: strike.id, targetId: target.id });

    expect(response.status).toBe(201);
    expect(response.body.action).toMatchObject({
      roundId: round.id, characterId: caster.id, skillId: strike.id, targetId: target.id,
      finalOutput: 24, rollQuality: 'Standard', targetData: { id: target.id, name: target.name },
    });
    const actions = await query(
      `SELECT "characterId", "skillId", "targetId", "finalOutput", "rollQuality" FROM combat_actions WHERE "roundId" = $1`,
      [round.id]
    );
    expect(actions).toEqual([
      { characterId: caster.id, skillId: strike.id, targetId: target.id, finalOutput: 24, rollQuality: 'Standard' },
    ]);
    const [{ uses }] = await query(`SELECT uses FROM character_skills WHERE "characterId" = $1 AND "skillId" = $2`, [caster.id, strike.id]);
    expect(uses).toBe(1);
  });
});
