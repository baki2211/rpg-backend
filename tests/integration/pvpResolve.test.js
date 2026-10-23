import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter, makeSkillType, makeSkill, giveSkill } from './support/factories.js';

// Every d20 is 11 (Standard, x1.0)
vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));

const app = createApp();

describe('POST /api/pvp/resolve', () => {
  // Usage used to be counted twice per encounter (in the resolver and again by callers), in separate transactions.
  it('resolving an encounter as the attacker\'s owner counts exactly one use of each skill', async () => {
    const owner = await makeUser();
    const attacker = await makeCharacter({ user: owner });
    const defender = await makeCharacter({ user: await makeUser() });
    const attack = await makeSkill({ type: await makeSkillType('Attack'), basePower: 15, target: 'other' });
    const defence = await makeSkill({ type: await makeSkillType('Defence'), basePower: 10, target: 'self' });
    await giveSkill(attacker, attack, { uses: 4 });
    await giveSkill(defender, defence, { uses: 7 });
    const client = await logIn(app, owner);

    const response = await client.post('/api/pvp/resolve', {
      attackerId: attacker.id, attackerSkillId: attack.id, defenderId: defender.id, defenderSkillId: defence.id,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ isClash: true, winner: 'attacker', damage: { attacker: 0, defender: 10 } });
    // The report shows the d20 that was actually rolled (it used to invent one from the multiplier)
    expect(response.body.report.map(({ actor, output, roll }) => ({ actor, output, roll }))).toEqual([
      { actor: attacker.name, output: 30, roll: 11 },
      { actor: defender.name, output: 20, roll: 11 },
    ]);
    const uses = await query(`SELECT "characterId", "skillId", uses FROM character_skills ORDER BY "characterId"`);
    expect(uses).toEqual([
      { characterId: attacker.id, skillId: attack.id, uses: 5 },
      { characterId: defender.id, skillId: defence.id, uses: 8 },
    ]);
  });

  // Security item 11: any logged-in user could resolve (and count uses for) any two characters.
  it('a player who owns neither character is forbidden and no use is counted', async () => {
    const outsider = await makeUser();
    const attacker = await makeCharacter({ user: await makeUser() });
    const defender = await makeCharacter({ user: await makeUser() });
    const attack = await makeSkill({ type: await makeSkillType('Attack'), basePower: 15, target: 'other' });
    const defence = await makeSkill({ type: await makeSkillType('Defence'), basePower: 10, target: 'self' });
    await giveSkill(attacker, attack);
    await giveSkill(defender, defence);
    const client = await logIn(app, outsider);

    const response = await client.post('/api/pvp/resolve', {
      attackerId: attacker.id, attackerSkillId: attack.id, defenderId: defender.id, defenderSkillId: defence.id,
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'You can only resolve encounters involving your own characters' });
    const uses = await query(`SELECT "characterId", uses FROM character_skills ORDER BY "characterId"`);
    expect(uses).toEqual([{ characterId: attacker.id, uses: 0 }, { characterId: defender.id, uses: 0 }]);
  });

  it('a master who owns neither character may resolve the encounter', async () => {
    const master = await makeUser({ role: 'master' });
    const attacker = await makeCharacter({ user: await makeUser() });
    const defender = await makeCharacter({ user: await makeUser() });
    const attack = await makeSkill({ type: await makeSkillType('Attack'), basePower: 15, target: 'other' });
    const defence = await makeSkill({ type: await makeSkillType('Defence'), basePower: 10, target: 'self' });
    await giveSkill(attacker, attack);
    await giveSkill(defender, defence);
    const client = await logIn(app, master);

    const response = await client.post('/api/pvp/resolve', {
      attackerId: attacker.id, attackerSkillId: attack.id, defenderId: defender.id, defenderSkillId: defence.id,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ isClash: true, winner: 'attacker', damage: { attacker: 0, defender: 10 } });
    const uses = await query(`SELECT "characterId", uses FROM character_skills ORDER BY "characterId"`);
    expect(uses).toEqual([{ characterId: attacker.id, uses: 1 }, { characterId: defender.id, uses: 1 }]);
  });
});
