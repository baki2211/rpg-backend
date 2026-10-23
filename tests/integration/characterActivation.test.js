import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter, makeRace } from './support/factories.js';

const app = createApp();

describe('PUT /api/characters/:id/activate', () => {
  // Regression for F9: deactivating the others and activating the chosen one were separate commits,
  // so a failure in between left the user with no active character.
  it('activating a character leaves it as the only active one and releases the NPC the user controlled', async () => {
    const player = await makeUser();
    const current = await makeCharacter({ user: player, isActive: true });
    const chosen = await makeCharacter({ user: player, isActive: false });
    const npc = await makeCharacter({ user: player, isActive: true, isNPC: true });
    const other = await makeCharacter({ user: await makeUser(), isActive: true });
    const client = await logIn(app, player);

    const response = await client.put(`/api/characters/${chosen.id}/activate`);

    expect(response.status).toBe(204);
    const rows = await query(`SELECT id, "userId", "isActive" FROM characters ORDER BY id`);
    expect(rows).toEqual([
      { id: current.id, userId: player.id, isActive: false },
      { id: chosen.id, userId: player.id, isActive: true },
      { id: npc.id, userId: null, isActive: false },
      { id: other.id, userId: other.userId, isActive: true },
    ]);
  });
});

describe('reading the active character', () => {
  // Regression for F14: every read of the active character "fixed" duplicate active rows with
  // updates, outside any transaction. Reads must not write; activation keeps a single active row.
  it('looking up a user with two active characters (older data) changes no rows', async () => {
    const player = await makeUser();
    const older = await makeCharacter({ user: player, isActive: true });
    const newer = await makeCharacter({ user: player, isActive: true });
    const before = await query(`SELECT id, "userId", "isActive", "updatedAt" FROM characters ORDER BY id`);
    const client = await logIn(app, player);

    // The presence location update looks up the user's active character
    const response = await client.post('/api/presence/location', { location: 'Dashboard' });

    expect(response.status).toBe(200);
    const after = await query(`SELECT id, "userId", "isActive", "updatedAt" FROM characters ORDER BY id`);
    expect(after).toEqual(before);
    expect(after.map(({ id, isActive }) => ({ id, isActive }))).toEqual([
      { id: older.id, isActive: true },
      { id: newer.id, isActive: true },
    ]);
  });
});

describe('POST /api/characters', () => {
  // Security item 11: the body used to be spread into the new row, so a client could set its own
  // progression, NPC flag or owner.
  it('a new character ignores rank, experience, points, NPC flag and owner sent by the client', async () => {
    const player = await makeUser();
    const someoneElse = await makeUser();
    const race = await makeRace();
    const client = await logIn(app, player);

    const response = await client.post('/api/characters', {
      name: 'Aldric', surname: 'Vale', age: '30', gender: 'male', raceId: race.id,
      rank: 9, experience: 5000, skillPoints: 99, statPoints: 40, isNPC: true, userId: someoneElse.id,
    });

    expect(response.status).toBe(201);
    const rows = await query(
      `SELECT name, "userId", rank, experience, "skillPoints", "statPoints", "isNPC", "isActive" FROM characters`
    );
    expect(rows).toEqual([{
      name: 'Aldric', userId: player.id, rank: 1, experience: 0, skillPoints: 5, statPoints: 0, isNPC: false, isActive: false,
    }]);
  });
});
