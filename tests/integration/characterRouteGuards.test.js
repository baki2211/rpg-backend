import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter } from './support/factories.js';

const app = createApp();

describe('GET /api/characters/all, the list of every player\'s characters', () => {
  // Regression for L19: the route had no role gate, so any player could list everyone's characters
  it('a player is refused', async () => {
    const player = await makeUser();
    await makeCharacter({ user: player, name: 'Aria' });
    const client = await logIn(app, player);

    const response = await client.get('/api/characters/all');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Forbidden: Insufficient role' });
  });

  it("a master sees every player's characters", async () => {
    const master = await makeUser({ role: 'master' });
    const alice = await makeUser({ username: 'alice' });
    const bob = await makeUser({ username: 'bob' });
    await makeCharacter({ user: alice, name: 'Aria' });
    await makeCharacter({ user: bob, name: 'Brom' });
    const client = await logIn(app, master);

    const response = await client.get('/api/characters/all');

    expect(response.status).toBe(200);
    expect(response.body.map((character) => [character.name, character.user.username])).toEqual([
      ['Aria', 'alice'],
      ['Brom', 'bob'],
    ]);
  });
});

describe('NPC routes with an id that is not a whole number', () => {
  // Regression for L21: Number('1.5') reached the query as a non-integer id
  it('an NPC edit is rejected with 400 and no NPC changes', async () => {
    const master = await makeUser({ role: 'master' });
    const npc = await makeCharacter({ isNPC: true, isActive: false, createdBy: master.id, name: 'Mira' });
    const client = await logIn(app, master);

    const response = await client.put('/api/characters/npcs/1.5', { name: 'Mirabel' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be a valid integer' });
    const [row] = await query('SELECT name FROM characters WHERE id = $1', [npc.id]);
    expect(row).toEqual({ name: 'Mira' });
  });
});
