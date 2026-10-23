import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter, makeLocation, makeRank } from './support/factories.js';

const app = createApp();

describe('POST /api/chat/:locationId', () => {
  // Regression for F3: the author's character was loaded without experience/rank, so every post
  // counted experience from 0 and level-up compared against rank NaN.
  it('a first post longer than 800 characters adds 0.5 experience to the stored total and levels up past the threshold', async () => {
    const player = await makeUser();
    const location = await makeLocation();
    await makeRank({ level: 2, requiredExperience: 100, statPoints: 3, skillPoints: 1 });
    const character = await makeCharacter({ user: player, experience: 99.5, rank: 1, statPoints: 0, skillPoints: 5 });
    const message = 'a'.repeat(801);
    const client = await logIn(app, player);

    const response = await client.post(`/api/chat/${location.id}`, { message });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ message, characterId: character.id, userId: player.id, username: character.name });
    const [progress] = await query(
      `SELECT experience, rank, "statPoints", "skillPoints" FROM characters WHERE id = $1`,
      [character.id]
    );
    expect(progress).toEqual({ experience: 100, rank: 2, statPoints: 3, skillPoints: 6 });
    const messages = await query(`SELECT "characterId", "locationId", length(message) AS length FROM chat_messages`);
    expect(messages).toEqual([{ characterId: character.id, locationId: location.id, length: 801 }]);
  });
});
