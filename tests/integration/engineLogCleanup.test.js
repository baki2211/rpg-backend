import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeLocation, makeSession } from './support/factories.js';

const app = createApp();

async function makeEngineLogAgedDays(session, details, ageInDays) {
  await query(
    `INSERT INTO engine_logs ("sessionId", "locationId", type, actor, details, "createdAt")
     VALUES ($1, $2, 'skill_use', 'Hero', $3, now() - make_interval(days => $4))`,
    [session.id, session.locationId, details, ageInDays]
  );
}

describe('admin cleanup of old engine logs', () => {
  it('removes logs older than a year and keeps newer ones', async () => {
    const admin = await makeUser({ role: 'admin' });
    const session = await makeSession({ location: await makeLocation() });
    await makeEngineLogAgedDays(session, 'ancient', 400);
    await makeEngineLogAgedDays(session, 'recent', 10);
    const client = await logIn(app, admin);

    const response = await client.delete('/api/engine-logs/cleanup/365');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: 'Deleted 1 old engine logs', deletedCount: 1 });
    expect(await query('SELECT details FROM engine_logs')).toEqual([{ details: 'recent' }]);
  });

  // More than a year used to be accepted; a huge value made an Invalid Date and a 500
  it.each([
    ['one day past a year', '366', 'Value must be at most 365'],
    ['zero days', '0', 'Value must be at least 1'],
    ['a non-numeric age', 'abc', 'Value must be a valid integer'],
  ])('%s is refused and no log is deleted', async (_name, daysOld, message) => {
    const admin = await makeUser({ role: 'admin' });
    const session = await makeSession({ location: await makeLocation() });
    await makeEngineLogAgedDays(session, 'ancient', 400);
    const client = await logIn(app, admin);

    const response = await client.delete(`/api/engine-logs/cleanup/${daysOld}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(await query('SELECT details FROM engine_logs')).toEqual([{ details: 'ancient' }]);
  });
});
