import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter, makeRace } from './support/factories.js';

const app = createApp();

// Security item L4: "one active character per user" is enforced by the partial unique index
// IDX_CHARACTER_ONE_ACTIVE_PER_USER (characters."userId" WHERE "isActive"), NPCs under control included.
// Activation deactivates the old row before activating the new one, so it never trips the index.

const activeRowsOf = (user) =>
  query(`SELECT id, "userId", "isActive" FROM characters WHERE "userId" = $1 AND "isActive" = true`, [user.id]);

describe('switching the active character', () => {
  it('activating a second character deactivates the first and leaves exactly one active row', async () => {
    const player = await makeUser();
    const first = await makeCharacter({ user: player, isActive: true });
    const second = await makeCharacter({ user: player, isActive: false });
    const client = await logIn(app, player);

    const response = await client.put(`/api/characters/${second.id}/activate`);

    expect(response.status).toBe(204);
    expect(await activeRowsOf(player)).toEqual([{ id: second.id, userId: player.id, isActive: true }]);
    expect(await query(`SELECT "isActive" FROM characters WHERE id = $1`, [first.id])).toEqual([{ isActive: false }]);
  });

  it('taking control of an NPC deactivates the own character and leaves the NPC as the only active row', async () => {
    const player = await makeUser();
    const own = await makeCharacter({ user: player, isActive: true });
    const npc = await makeCharacter({ isNPC: true, isActive: false });
    const client = await logIn(app, player);

    const response = await client.post(`/api/characters/npcs/${npc.id}/activate`);

    expect(response.status).toBe(200);
    expect(await activeRowsOf(player)).toEqual([{ id: npc.id, userId: player.id, isActive: true }]);
    expect(await query(`SELECT "isActive" FROM characters WHERE id = $1`, [own.id])).toEqual([{ isActive: false }]);
  });
});

describe('the database guarantee', () => {
  it.each([
    ['inserting a second active character', (user, race) => query(
      `INSERT INTO characters ("userId", name, surname, age, gender, "raceId", "isActive") VALUES ($1, 'Dup', 'Row', 30, 'other', $2, true)`,
      [user.id, race.id]
    )],
    ['activating a second character directly', (user) => query(
      `UPDATE characters SET "isActive" = true WHERE "userId" = $1 AND "isActive" = false`,
      [user.id]
    )],
  ])('%s for the same user is rejected', async (_name, write) => {
    const player = await makeUser();
    const race = await makeRace();
    const active = await makeCharacter({ user: player, race, isActive: true });
    await makeCharacter({ user: player, race, isActive: false });

    const attempt = write(player, race);

    await expect(attempt).rejects.toMatchObject({
      driverError: { code: '23505', constraint: 'IDX_CHARACTER_ONE_ACTIVE_PER_USER' },
    });
    expect(await activeRowsOf(player)).toEqual([{ id: active.id, userId: player.id, isActive: true }]);
  });

  it('several uncontrolled NPCs can be active at once', async () => {
    await makeCharacter({ isNPC: true, isActive: true });

    const attempt = makeCharacter({ isNPC: true, isActive: true });

    await expect(attempt).resolves.toMatchObject({ userId: null, isActive: true });
  });
});
