import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeLocation, makeSession } from './support/factories.js';

const app = createApp();

// Text filters and names must be a single string within the column length. A repeated query param
// (`?status=a&status=b`) arrives as an array and used to reach the `where` clause; a session without
// a name failed on the NOT NULL column as a 500.
describe('a malformed text param is a bad request', () => {
  it('a repeated status filter on location events is refused', async () => {
    const player = await makeUser();
    const location = await makeLocation();
    const client = await logIn(app, player);

    const response = await client.get(`/api/events/location/${location.id}?status=active&status=closed`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be a string' });
  });

  it('a repeated type filter on session engine logs is refused', async () => {
    const player = await makeUser();
    const session = await makeSession({ location: await makeLocation() });
    const client = await logIn(app, player);

    const response = await client.get(`/api/engine-logs/session/${session.id}?type=clash&type=damage`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be a string' });
  });

  it('a session without a name is refused and nothing is saved', async () => {
    const player = await makeUser();
    const location = await makeLocation();
    const client = await logIn(app, player);

    const response = await client.post('/api/sessions', { locationId: location.id });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value is required' });
    expect(await query('SELECT id FROM sessions')).toEqual([]);
  });

  it('a session name longer than 100 characters is refused and nothing is saved', async () => {
    const player = await makeUser();
    const location = await makeLocation();
    const client = await logIn(app, player);

    const response = await client.post('/api/sessions', { name: 'a'.repeat(101), locationId: location.id });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be at most 100 characters' });
    expect(await query('SELECT id FROM sessions')).toEqual([]);
  });
});

describe('a valid session name', () => {
  it('is saved trimmed', async () => {
    const player = await makeUser();
    const location = await makeLocation();
    const client = await logIn(app, player);

    const response = await client.post('/api/sessions', { name: '  Tavern  ', locationId: location.id });

    expect(response.status).toBe(200);
    expect(await query('SELECT name FROM sessions')).toEqual([{ name: 'Tavern' }]);
  });
});
