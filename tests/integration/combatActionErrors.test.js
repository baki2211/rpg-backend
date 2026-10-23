import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import {
  makeUser, makeCharacter, makeLocation, makeSession, makeCombatRound, makeSkill, giveSkill,
} from './support/factories.js';

// Every d20 is 11 (Standard, x1.0)
vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));

const app = createApp();

async function makePlayerInRound() {
  const player = await makeUser();
  const master = await makeUser({ role: 'master' });
  const location = await makeLocation();
  const round = await makeCombatRound({ location, createdBy: master, session: await makeSession({ location }) });
  const caster = await makeCharacter({ user: player });
  const shield = await makeSkill({ target: 'self' });
  await giveSkill(caster, shield);
  return { player, round, caster, shield };
}

describe('POST /api/combat/rounds/:roundId/actions error responses', () => {
  it('a round id that is not a number is rejected as a bad request and nothing is recorded', async () => {
    const { player, caster, shield } = await makePlayerInRound();
    const client = await logIn(app, player);

    const response = await client.post('/api/combat/rounds/abc/actions', { skillId: shield.id });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be a valid integer' });
    const actions = await query(`SELECT id FROM combat_actions WHERE "characterId" = $1`, [caster.id]);
    expect(actions).toEqual([]);
  });

  // Both requests can pass the "already submitted" check before either commits; the loser then
  // hits the (roundId, characterId) unique index. Either way the second submit is a conflict.
  it('two submits for the same character in the same round record one action and the other is a conflict', async () => {
    const { player, round, caster, shield } = await makePlayerInRound();
    const client = await logIn(app, player);

    const responses = await Promise.all([
      client.post(`/api/combat/rounds/${round.id}/actions`, { skillId: shield.id }),
      client.post(`/api/combat/rounds/${round.id}/actions`, { skillId: shield.id }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const conflict = responses.find((response) => response.status === 409);
    expect([
      'Character has already submitted an action for this round',
      'The request conflicts with an existing record',
    ]).toContain(conflict.body.message);
    const actions = await query(`SELECT "characterId", "skillId" FROM combat_actions WHERE "roundId" = $1`, [round.id]);
    expect(actions).toEqual([{ characterId: caster.id, skillId: shield.id }]);
    const [{ uses }] = await query(`SELECT uses FROM character_skills WHERE "characterId" = $1 AND "skillId" = $2`, [caster.id, shield.id]);
    expect(uses).toBe(1);
  });
});
