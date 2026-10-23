import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter } from './support/factories.js';

const app = createApp();

const readNpc = async (id) => {
  const [row] = await query(
    `SELECT name, background, "userId", "isNPC", "isActive", "createdBy" FROM characters WHERE id = $1`,
    [id]
  );
  return row;
};

describe('PUT /api/characters/npcs/:id', () => {
  // Regression for L2: the request body went straight into the UPDATE, so any column could be set
  it('a master edits the name and background; ownership, NPC and active flags in the body are ignored', async () => {
    const master = await makeUser({ role: 'master' });
    const player = await makeUser();
    const npc = await makeCharacter({ isNPC: true, isActive: false, createdBy: master.id, name: 'Mira', background: 'Innkeeper' });
    const client = await logIn(app, master);

    const response = await client.put(`/api/characters/npcs/${npc.id}`, {
      name: 'Mirabel',
      background: 'Retired innkeeper',
      userId: player.id,
      isNPC: false,
      isActive: true,
      createdBy: player.id,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: npc.id, name: 'Mirabel', userId: null, isNPC: true, isActive: false });
    expect(await readNpc(npc.id)).toEqual({
      name: 'Mirabel',
      background: 'Retired innkeeper',
      userId: null,
      isNPC: true,
      isActive: false,
      createdBy: master.id,
    });
  });

  it('an edit with only server-controlled fields leaves the NPC unchanged', async () => {
    const master = await makeUser({ role: 'master' });
    const player = await makeUser();
    const npc = await makeCharacter({ isNPC: true, isActive: false, createdBy: master.id, name: 'Mira', background: 'Innkeeper' });
    const client = await logIn(app, master);

    const response = await client.put(`/api/characters/npcs/${npc.id}`, { userId: player.id, isNPC: false });

    expect(response.status).toBe(200);
    expect(await readNpc(npc.id)).toEqual({
      name: 'Mira',
      background: 'Innkeeper',
      userId: null,
      isNPC: true,
      isActive: false,
      createdBy: master.id,
    });
  });
});
