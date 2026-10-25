import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { makeUser, makeLocation, makeSession, makeCombatRound } from './support/factories.js';

const app = createApp();

// `limit` is a positive PostgreSQL INTEGER; when it's absent the route keeps its default page size.
// Malformed values used to reach the query as NaN or a negative take and fail as a 500.
describe('a malformed or out-of-range limit is a bad request', () => {
  it('a negative limit on resolved combat rounds is refused', async () => {
    const player = await makeUser();
    const location = await makeLocation();
    const client = await logIn(app, player);

    const response = await client.get(`/api/combat/rounds/resolved/${location.id}?limit=-1`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be at least 1' });
  });

  it('a limit beyond the integer range on location events is refused', async () => {
    const player = await makeUser();
    const location = await makeLocation();
    const client = await logIn(app, player);

    const response = await client.get(`/api/events/location/${location.id}?limit=2147483648`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be at most 2147483647' });
  });

  it('a non-numeric limit on session engine logs is refused', async () => {
    const player = await makeUser();
    const session = await makeSession({ location: await makeLocation() });
    const client = await logIn(app, player);

    const response = await client.get(`/api/engine-logs/session/${session.id}?limit=abc`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be a valid integer' });
  });

  it('a non-numeric section on the public wiki search is refused', async () => {
    const response = await request(app).get('/api/wiki/search?q=lore&section=abc');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be a valid integer' });
  });
});

describe('resolved combat rounds without a limit', () => {
  it('still lists the resolved rounds at the location', async () => {
    const master = await makeUser({ role: 'master' });
    const location = await makeLocation();
    await makeCombatRound({ location, createdBy: master, roundNumber: 1, status: 'resolved' });
    await makeCombatRound({ location, createdBy: master, roundNumber: 2, status: 'active' });
    const client = await logIn(app, master);

    const response = await client.get(`/api/combat/rounds/resolved/${location.id}`);

    expect(response.status).toBe(200);
    expect(response.body.rounds.map(({ roundNumber, status }) => ({ roundNumber, status }))).toEqual([
      { roundNumber: 1, status: 'resolved' },
    ]);
  });
});
