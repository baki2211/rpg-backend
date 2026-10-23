import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter, makeSkillType, makeSkill, giveSkill } from './support/factories.js';

// Every d20 is 11 (Standard, x1.0)
vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));

const app = createApp();

describe('POST /api/skills/use with a target skill', () => {
  // Regression for F1: the clash was never awaited, HP was written to a `health` field that doesn't
  // exist, and usage was counted outside the HP transaction. Every clash returned 500.
  it('an attack stronger than the defence damages the defender by the excess and counts one use of each skill', async () => {
    const owner = await makeUser();
    const attacker = await makeCharacter({ user: owner, stats: { hp: 50, aether: 30 } });
    const defender = await makeCharacter({ user: await makeUser(), stats: { hp: 40, aether: 30 } });
    const attack = await makeSkill({ type: await makeSkillType('Attack'), basePower: 15, target: 'other' });
    const defence = await makeSkill({ type: await makeSkillType('Defence'), basePower: 10, target: 'self' });
    await giveSkill(attacker, attack);
    await giveSkill(defender, defence);
    const client = await logIn(app, owner);

    const response = await client.post('/api/skills/use', {
      characterId: attacker.id, skillId: attack.id, targetId: defender.id, targetSkillId: defence.id,
    });

    // outputs: attack 15 * (1.0 + 1.0) * 1.0 = 30, defence 10 * 2 * 1.0 = 20, so 10 gets through
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'Clash resolved',
      result: { winner: 'attacker', damage: { attacker: 0, defender: 10 }, effects: ['damage_absorbed', 'absorbed_20_damage'] },
    });
    const hp = await query(`SELECT id, (stats->>'hp')::int AS hp FROM characters ORDER BY id`);
    expect(hp).toEqual([{ id: attacker.id, hp: 50 }, { id: defender.id, hp: 30 }]);
    const uses = await query(`SELECT "characterId", "skillId", uses FROM character_skills ORDER BY "characterId"`);
    expect(uses).toEqual([
      { characterId: attacker.id, skillId: attack.id, uses: 1 },
      { characterId: defender.id, skillId: defence.id, uses: 1 },
    ]);
  });
});
