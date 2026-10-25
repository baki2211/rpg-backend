import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeLocation, makeSession, makeCharacter } from './support/factories.js';

const app = createApp();

async function aSessionWithAParticipant() {
  const location = await makeLocation();
  const session = await makeSession({ location });
  const character = await makeCharacter({ user: await makeUser() });
  await query('INSERT INTO session_participants ("sessionId", "characterId") VALUES ($1, $2)', [session.id, character.id]);
  return { location, session, character };
}

// Regression for L56: only freeze/unfreeze/close were gated, so any player could open, close or
// edit any session through the other write routes, including the legacy PUT status/active ones.
describe('session writes by a player', () => {
  it.each([
    ['create a session', (client, { location }) => client.post('/api/sessions', { name: 'Tavern', locationId: location.id })],
    ['add a participant', (client, { session, character }) => client.post(`/api/sessions/${session.id}/participants`, { characterId: character.id })],
    ['remove a participant', (client, { session, character }) => client.delete(`/api/sessions/${session.id}/participants/${character.id}`)],
    ['freeze a session', (client, { session }) => client.post(`/api/sessions/${session.id}/freeze`)],
    ['close a session', (client, { session }) => client.post(`/api/sessions/${session.id}/close`)],
  ])('cannot %s and nothing changes', async (_action, send) => {
    const player = await makeUser();
    const fixture = await aSessionWithAParticipant();
    const client = await logIn(app, player);

    const response = await send(client, fixture);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Forbidden: Insufficient role' });
    expect(await query('SELECT "isActive", status FROM sessions')).toEqual([{ isActive: true, status: 'open' }]);
    expect(await query('SELECT "characterId" FROM session_participants')).toEqual([{ characterId: fixture.character.id }]);
  });
});
