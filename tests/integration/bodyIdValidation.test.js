import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeLocation, makeCharacter, makeSkill, giveSkill, makeSession } from './support/factories.js';

const app = createApp();

// Ids in a request body follow the same rule as path ids: a positive PostgreSQL INTEGER given as
// an integer or a plain digit string. Anything else is a 400 before any query; out-of-range values
// used to reach Postgres and fail as a 500.
describe('a malformed or out-of-range id in a request body is a bad request', () => {
  it('a wiki entry in a section beyond the integer range is refused and nothing is saved', async () => {
    const master = await makeUser({ role: 'master' });
    const client = await logIn(app, master);

    const response = await client.post('/api/wiki/admin/entries', { sectionId: 2147483648, title: 'Lore', content: 'Text' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be at most 2147483647' });
    expect(await query('SELECT id FROM wiki_entries')).toEqual([]);
  });

  it('a combat round at a non-numeric location is refused and no round or session is created', async () => {
    const master = await makeUser({ role: 'master' });
    const client = await logIn(app, master);

    const response = await client.post('/api/combat/rounds', { locationId: 'abc' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be a valid integer' });
    expect(await query('SELECT id FROM combat_rounds')).toEqual([]);
    expect(await query('SELECT id FROM sessions')).toEqual([]);
  });

  it('a PvP encounter with a negative attacker id is refused', async () => {
    const player = await makeUser();
    const client = await logIn(app, player);

    const response = await client.post('/api/pvp/resolve', { attackerId: -1, attackerSkillId: 1, defenderId: 2, defenderSkillId: 3 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be at least 1' });
  });

  it('a skill use with a non-numeric clash target is refused and the caster pays nothing', async () => {
    const player = await makeUser();
    const character = await makeCharacter({ user: player, stats: { hp: 50, aether: 30 } });
    const skill = await makeSkill({ aetherCost: 5 });
    await giveSkill(character, skill);
    const client = await logIn(app, player);

    const response = await client.post('/api/skills/use', { characterId: character.id, skillId: skill.id, targetId: 'abc', targetSkillId: skill.id });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be a valid integer' });
    const [row] = await query('SELECT stats FROM characters WHERE id = $1', [character.id]);
    expect(row.stats).toEqual({ hp: 50, aether: 30 });
  });

  it('a session participant beyond the integer range is refused and nobody joins', async () => {
    const player = await makeUser();
    const session = await makeSession({ location: await makeLocation() });
    const client = await logIn(app, player);

    const response = await client.post(`/api/sessions/${session.id}/participants`, { characterId: '2147483648' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be at most 2147483647' });
    expect(await query('SELECT id FROM session_participants')).toEqual([]);
  });
});
