import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeLocation, makeEvent, makeCombatRound } from './support/factories.js';

const app = createApp();

// Regression for L37: the query monitoring stats and their reset answered anyone.
describe('/api/admin/query-stats', () => {
  it('an anonymous reset is refused as unauthenticated', async () => {
    const response = await request(app)
      .post('/api/admin/query-stats/reset')
      .set('Cookie', 'csrfToken=matching-token')
      .set('X-CSRF-Token', 'matching-token')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Unauthorized: Token missing' });
  });

  it('a player cannot read the stats', async () => {
    const player = await makeUser();
    const client = await logIn(app, player);

    const response = await client.get('/api/admin/query-stats');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Access denied: Admins only' });
  });

  it('an admin reads the stats', async () => {
    const admin = await makeUser({ role: 'admin' });
    const client = await logIn(app, admin);

    const response = await client.get('/api/admin/query-stats');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(expect.objectContaining({ totalQueries: 0, queryBreakdown: {} }));
  });
});

// Regression for L31: path ids went through parseInt/Number unchecked, so "1abc" acted on row 1
// and an id beyond the Postgres integer range failed as a 500.
describe('a path id that is not a valid row id', () => {
  it('a wiki section id with trailing letters is a 400 and the section keeps its name', async () => {
    const admin = await makeUser({ role: 'admin' });
    const client = await logIn(app, admin);
    await client.post('/api/wiki/admin/sections', { name: 'Lore' });

    const response = await client.put('/api/wiki/admin/sections/1abc', { name: 'Renamed' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be a valid integer' });
    const sections = await query('SELECT id, name FROM wiki_sections');
    expect(sections).toEqual([{ id: 1, name: 'Lore' }]);
  });

  it('a combat round id with trailing letters is a 400 and the round stays active', async () => {
    const admin = await makeUser({ role: 'admin' });
    const location = await makeLocation();
    await makeCombatRound({ location, createdBy: admin });
    const client = await logIn(app, admin);

    const response = await client.post('/api/combat/rounds/1abc/cancel');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be a valid integer' });
    const rounds = await query('SELECT id, status FROM combat_rounds');
    expect(rounds).toEqual([{ id: 1, status: 'active' }]);
  });

  it('an event id beyond the Postgres integer range is a 400 and the event stays active', async () => {
    const admin = await makeUser({ role: 'admin' });
    const location = await makeLocation();
    await makeEvent({ location, createdBy: admin });
    const client = await logIn(app, admin);

    const response = await client.post('/api/events/99999999999/close');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be at most 2147483647' });
    const events = await query('SELECT id, status FROM events');
    expect(events).toEqual([{ id: 1, status: 'active' }]);
  });
});
