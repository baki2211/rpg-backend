import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter, makeStatDefinition } from './support/factories.js';

const app = createApp();

async function makeFocusAndControlDefinitions() {
  await makeStatDefinition({ internalName: 'foc', displayName: 'Focus', category: 'primary_stat', sortOrder: 1 });
  await makeStatDefinition({ internalName: 'con', displayName: 'Control', category: 'primary_stat', sortOrder: 2 });
  await makeStatDefinition({ internalName: 'hp', displayName: 'Health', category: 'resource', minValue: 0, maxValue: 100, defaultValue: 0 });
}

// L22: keys no stat definition knows used to be merged into the `stats` jsonb with only a warning.
describe('PUT /api/characters/:id/stats with keys no stat definition knows', () => {
  it('is refused and the unknown keys are not saved', async () => {
    await makeFocusAndControlDefinitions();
    const player = await makeUser();
    const character = await makeCharacter({ user: player, stats: { foc: 10, con: 10, hp: 50, aether: 30 } });
    const client = await logIn(app, player);

    const response = await client.put(`/api/characters/${character.id}/stats`, { foc: 12, luck: 99, zeal: 1 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Unknown stats: luck, zeal' });
    const [{ stats }] = await query(`SELECT stats FROM characters WHERE id = $1`, [character.id]);
    expect(stats).toEqual({ foc: 10, con: 10, hp: 50, aether: 30 });
  });

  it('sending back the derived stats a character already has is accepted', async () => {
    await makeFocusAndControlDefinitions();
    const player = await makeUser();
    const character = await makeCharacter({
      user: player,
      stats: { foc: 10, con: 10, hp: 30, aether: 22, reactions: 5, speed: 3 },
    });
    const client = await logIn(app, player);

    const response = await client.put(`/api/characters/${character.id}/stats`, {
      foc: 12, con: 10, hp: 30, aether: 22, reactions: 5, speed: 3,
    });

    // Race without bonuses, no ranks row: reactions = floor(12 / 2) = 6, speed = floor(10 / 3) = 3,
    // hp = 10 * 3 = 30, aether = floor(sqrt(12 + 10) * 5) = floor(23.45) = 23
    const expectedStats = { foc: 12, con: 10, hp: 30, aether: 23, reactions: 6, speed: 3 };
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: character.id, stats: expectedStats });
    const [{ stats }] = await query(`SELECT stats FROM characters WHERE id = $1`, [character.id]);
    expect(stats).toEqual(expectedStats);
  });
});
