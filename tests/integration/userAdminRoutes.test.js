import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser } from './support/factories.js';

const app = createApp();

// Regression for L33: the /api/user admin routes moved from isAdmin to requireRole(['admin']).
// Access stays admin only: masters and players are refused.
describe('/api/user admin routes', () => {
  it.each([
    ['a player', 'user'],
    ['a master', 'master'],
  ])('%s cannot change another account role, and the role stays as it was', async (_name, role) => {
    const caller = await makeUser({ role });
    const target = await makeUser();
    const client = await logIn(app, caller);

    const response = await client.put(`/api/user/${target.id}/role`, { role: 'admin' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Forbidden: Insufficient role' });
    const rows = await query('SELECT role FROM users WHERE id = $1', [target.id]);
    expect(rows).toEqual([{ role: 'user' }]);
  });

  it('an admin promotes a player to master', async () => {
    const admin = await makeUser({ role: 'admin' });
    const target = await makeUser({ username: 'promoted' });
    const client = await logIn(app, admin);

    const response = await client.put(`/api/user/${target.id}/role`, { role: 'master' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ id: target.id, username: 'promoted', role: 'master' }));
    const rows = await query('SELECT role FROM users WHERE id = $1', [target.id]);
    expect(rows).toEqual([{ role: 'master' }]);
  });
});
