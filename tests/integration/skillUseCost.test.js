import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter, makeSkill, giveSkill } from './support/factories.js';

// Every d20 is 11 (Standard, x1.0)
vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));

const app = createApp();

describe('POST /api/skills/use without a target', () => {
  // Item 10/11: the aether cost and the use were never saved on this path; now both commit together.
  it('pays the aether cost from the stored stats and counts one use', async () => {
    const player = await makeUser();
    const character = await makeCharacter({ user: player, stats: { hp: 50, aether: 30 } });
    const ward = await makeSkill({ target: 'self', basePower: 10, aetherCost: 7 });
    await giveSkill(character, ward);
    const client = await logIn(app, player);

    const response = await client.post('/api/skills/use', { characterId: character.id, skillId: ward.id });

    // output: 10 * (1.0 + 1.0) * 1.0 = 20; aether 30 - 7 = 23
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Skill used successfully', output: 20, remainingAether: 23 });
    const [{ stats }] = await query(`SELECT stats FROM characters WHERE id = $1`, [character.id]);
    expect(stats).toEqual({ hp: 50, aether: 23 });
    const [{ uses }] = await query(`SELECT uses FROM character_skills WHERE "characterId" = $1 AND "skillId" = $2`, [character.id, ward.id]);
    expect(uses).toBe(1);
  });

  // The stats are re-read under a row lock, so concurrent uses can't overwrite each other's aether
  it('two uses at the same time both pay their cost and both count', async () => {
    const player = await makeUser();
    const character = await makeCharacter({ user: player, stats: { hp: 50, aether: 30 } });
    const ward = await makeSkill({ target: 'self', basePower: 10, aetherCost: 7 });
    await giveSkill(character, ward);
    const client = await logIn(app, player);

    const responses = await Promise.all([
      client.post('/api/skills/use', { characterId: character.id, skillId: ward.id }),
      client.post('/api/skills/use', { characterId: character.id, skillId: ward.id }),
    ]);

    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(responses.map(response => response.body.remainingAether).sort()).toEqual([16, 23]);
    const [{ stats }] = await query(`SELECT stats FROM characters WHERE id = $1`, [character.id]);
    expect(stats).toEqual({ hp: 50, aether: 16 });
    const [{ uses }] = await query(`SELECT uses FROM character_skills WHERE "characterId" = $1 AND "skillId" = $2`, [character.id, ward.id]);
    expect(uses).toBe(2);
  });

  it('a character without enough aether is refused and nothing is written', async () => {
    const player = await makeUser();
    const character = await makeCharacter({ user: player, stats: { hp: 50, aether: 6 } });
    const ward = await makeSkill({ target: 'self', basePower: 10, aetherCost: 7 });
    await giveSkill(character, ward);
    const client = await logIn(app, player);

    const response = await client.post('/api/skills/use', { characterId: character.id, skillId: ward.id });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Insufficient aether to use this skill. Required: 7, Available: 6' });
    const [{ stats }] = await query(`SELECT stats FROM characters WHERE id = $1`, [character.id]);
    expect(stats).toEqual({ hp: 50, aether: 6 });
    const [{ uses }] = await query(`SELECT uses FROM character_skills WHERE "characterId" = $1 AND "skillId" = $2`, [character.id, ward.id]);
    expect(uses).toBe(0);
  });
});
