import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser } from './support/factories.js';

const app = createApp();

describe('wiki admin routes, gated to masters and admins', () => {
  it('a player is refused and no section is created', async () => {
    const player = await makeUser();
    const client = await logIn(app, player);

    const response = await client.post('/api/wiki/admin/sections', { name: 'Lore' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Forbidden: Insufficient role' });
    const sections = await query('SELECT name FROM wiki_sections');
    expect(sections).toEqual([]);
  });

  it('a master creates a section', async () => {
    const master = await makeUser({ role: 'master' });
    const client = await logIn(app, master);

    const response = await client.post('/api/wiki/admin/sections', { name: 'Lore' });

    expect(response.status).toBe(201);
    const sections = await query('SELECT name FROM wiki_sections');
    expect(sections).toEqual([{ name: 'Lore' }]);
  });
});

describe('an entry id beyond the Postgres integer range', () => {
  // It used to reach the query and fail as a 500. The 500 body shape (no driver or SQL
  // details) is covered in tests/unit/middleware/errorHandler.test.js.
  it('is refused as a bad request before any query', async () => {
    const master = await makeUser({ role: 'master' });
    const client = await logIn(app, master);

    const response = await client.get('/api/wiki/admin/entries/99999999999');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Value must be at most 2147483647' });
  });
});
