import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeLocation, makeEvent, makeCombatRound } from './support/factories.js';

const app = createApp();

describe('POST /api/combat/rounds outside an event', () => {
  // Regression for F4: the non-event lookup used `eventId: null`, which TypeORM 1.0 rejects (500).
  it('numbers the new round after the last non-event round at the location, ignoring event rounds', async () => {
    const master = await makeUser({ role: 'master' });
    const location = await makeLocation();
    await makeCombatRound({ location, createdBy: master, roundNumber: 1, status: 'resolved' });
    const closedEvent = await makeEvent({ location, createdBy: master, status: 'closed' });
    await makeCombatRound({ location, createdBy: master, event: closedEvent, roundNumber: 5, status: 'resolved' });
    const client = await logIn(app, master);

    const response = await client.post('/api/combat/rounds', { locationId: location.id });

    expect(response.status).toBe(201);
    expect(response.body.round).toMatchObject({ roundNumber: 2, status: 'active', eventId: null });
    const rounds = await query(
      `SELECT "roundNumber", "eventId", "status", "createdBy", "sessionId" FROM combat_rounds
       WHERE "locationId" = $1 AND "eventId" IS NULL ORDER BY "roundNumber"`,
      [location.id]
    );
    expect(rounds.map(({ roundNumber, status }) => ({ roundNumber, status }))).toEqual([
      { roundNumber: 1, status: 'resolved' },
      { roundNumber: 2, status: 'active' },
    ]);
    expect(rounds[1].createdBy).toBe(master.id);
    const [session] = await query(`SELECT "locationId", "isActive" FROM sessions WHERE id = $1`, [rounds[1].sessionId]);
    expect(session).toEqual({ locationId: location.id, isActive: true });
  });
});
