import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter, makeSkill } from './support/factories.js';

const app = createApp();

describe('POST /api/characters/:id/skills/:skillId/acquire', () => {
  // Regression for F9: the character_skills row and the skill point deduction were two separate
  // commits, and the deduction used a value read before the insert.
  it('spends the skill point cost and adds the skill to the character in one transaction', async () => {
    const player = await makeUser();
    const character = await makeCharacter({ user: player, skillPoints: 5 });
    const fireball = await makeSkill({ skillPointCost: 3 });
    const client = await logIn(app, player);

    const response = await client.post(`/api/characters/${character.id}/skills/${fireball.id}/acquire`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: character.id, skillPoints: 2 });
    expect(response.body.skills.map(skill => skill.id)).toEqual([fireball.id]);
    const [{ skillPoints }] = await query(`SELECT "skillPoints" FROM characters WHERE id = $1`, [character.id]);
    expect(skillPoints).toBe(2);
    const learned = await query(`SELECT "characterId", "skillId", uses FROM character_skills`);
    expect(learned).toEqual([{ characterId: character.id, skillId: fireball.id, uses: 0 }]);
  });

  it('a character with fewer points than the cost is refused and nothing is written', async () => {
    const player = await makeUser();
    const character = await makeCharacter({ user: player, skillPoints: 2 });
    const fireball = await makeSkill({ skillPointCost: 3 });
    const client = await logIn(app, player);

    const response = await client.post(`/api/characters/${character.id}/skills/${fireball.id}/acquire`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Not enough skill points' });
    const [{ skillPoints }] = await query(`SELECT "skillPoints" FROM characters WHERE id = $1`, [character.id]);
    expect(skillPoints).toBe(2);
    expect(await query(`SELECT * FROM character_skills`)).toEqual([]);
  });

  // The points are re-read under a row lock, so two requests can't both spend the same points
  it('two skills requested at once with points for only one: one is learned and the points are spent once', async () => {
    const player = await makeUser();
    const character = await makeCharacter({ user: player, skillPoints: 3 });
    const fireball = await makeSkill({ skillPointCost: 3 });
    const frostbolt = await makeSkill({ skillPointCost: 3 });
    const client = await logIn(app, player);

    const responses = await Promise.all([
      client.post(`/api/characters/${character.id}/skills/${fireball.id}/acquire`),
      client.post(`/api/characters/${character.id}/skills/${frostbolt.id}/acquire`),
    ]);

    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
    const winner = [fireball, frostbolt][responses.findIndex(response => response.status === 200)];
    const [{ skillPoints }] = await query(`SELECT "skillPoints" FROM characters WHERE id = $1`, [character.id]);
    expect(skillPoints).toBe(0);
    const learned = await query(`SELECT "characterId", "skillId" FROM character_skills`);
    expect(learned).toEqual([{ characterId: character.id, skillId: winner.id }]);
  });
});
