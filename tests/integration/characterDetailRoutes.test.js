import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter, makeSkill, giveSkill, makeStatDefinition } from './support/factories.js';

const app = createApp();

// L13: these routes declare `/:id` but the handlers read `req.params.characterId`, so every
// request looked up character NaN.
describe('GET /api/characters/:id/skills/available', () => {
  it('lists the skills the character has not learned yet', async () => {
    const player = await makeUser();
    const character = await makeCharacter({ user: player });
    const fireball = await makeSkill({ name: 'Fireball' });
    const frostbolt = await makeSkill({ name: 'Frostbolt' });
    await giveSkill(character, fireball);
    const client = await logIn(app, player);

    const response = await client.get(`/api/characters/${character.id}/skills/available`);

    expect(response.status).toBe(200);
    expect(response.body.map(skill => skill.name)).toEqual(['Frostbolt']);
    expect(response.body[0].id).toBe(frostbolt.id);
  });

  it("another player's character is not found", async () => {
    const owner = await makeUser();
    const character = await makeCharacter({ user: owner });
    await makeSkill({ name: 'Fireball' });
    const intruder = await makeUser();
    const client = await logIn(app, intruder);

    const response = await client.get(`/api/characters/${character.id}/skills/available`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Character not found' });
  });
});

describe('PUT /api/characters/:id/stats', () => {
  it('saves the new primary stat and recomputes the derived stats', async () => {
    await makeStatDefinition({ internalName: 'foc', displayName: 'Focus', category: 'primary_stat', sortOrder: 1 });
    await makeStatDefinition({ internalName: 'con', displayName: 'Control', category: 'primary_stat', sortOrder: 2 });
    await makeStatDefinition({ internalName: 'hp', displayName: 'Health', category: 'resource', minValue: 0, maxValue: 100, defaultValue: 0 });
    const player = await makeUser();
    const character = await makeCharacter({ user: player, stats: { foc: 10, con: 10, hp: 50, aether: 30 } });
    const client = await logIn(app, player);

    const response = await client.put(`/api/characters/${character.id}/stats`, { foc: 12 });

    // Race without bonuses, no ranks row: reactions = floor(12 / 2) = 6, speed = floor(10 / 3) = 3,
    // hp = 10 * 3 = 30, aether = floor(sqrt(12 + 10) * 5) = floor(23.45) = 23
    const expectedStats = { foc: 12, con: 10, hp: 30, aether: 23, reactions: 6, speed: 3 };
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: character.id, stats: expectedStats });
    const [{ stats }] = await query(`SELECT stats FROM characters WHERE id = $1`, [character.id]);
    expect(stats).toEqual(expectedStats);
  });
});

describe('character detail routes with an id that is not a whole number', () => {
  it.each([
    ['reading available skills', 'get', '/api/characters/abc/skills/available'],
    ['updating stats', 'put', '/api/characters/1.5/stats'],
  ])('%s is refused as a bad request', async (_name, method, url) => {
    const player = await makeUser();
    const character = await makeCharacter({ user: player, stats: { foc: 10, con: 10, hp: 50, aether: 30 } });
    const client = await logIn(app, player);

    const response = await client[method](url, { foc: 12 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be a valid integer' });
    const [{ stats }] = await query(`SELECT stats FROM characters WHERE id = $1`, [character.id]);
    expect(stats).toEqual({ foc: 10, con: 10, hp: 50, aether: 30 });
  });
});
