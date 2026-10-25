import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser } from './support/factories.js';

const app = createApp();

// Admin edits used to pass the whole request body to the repository, so a client could rewrite
// derived or server-controlled columns (slug, level, section, author). Those fields are now dropped.
describe('wiki admin edits write only the editable fields', () => {
  it('an entry edit changes the title but ignores section, slug, level and author', async () => {
    const master = await makeUser({ role: 'master' });
    const client = await logIn(app, master);
    const lore = await client.post('/api/wiki/admin/sections', { name: 'Lore' });
    const rules = await client.post('/api/wiki/admin/sections', { name: 'Rules' });
    const entry = await client.post('/api/wiki/admin/entries', { sectionId: lore.body.id, title: 'Old', content: 'Text' });

    const response = await client.put(`/api/wiki/admin/entries/${entry.body.id}`, {
      title: 'New', sectionId: rules.body.id, slug: 'hijacked', level: 3, createdBy: 999, viewCount: 1000
    });

    expect(response.status).toBe(200);
    const rows = await query('SELECT title, "sectionId", slug, level, "createdBy", "viewCount" FROM wiki_entries');
    expect(rows).toEqual([
      { title: 'New', sectionId: lore.body.id, slug: 'new', level: 1, createdBy: master.id, viewCount: 0 }
    ]);
  });

  it('a section edit changes the name but ignores slug and author', async () => {
    const master = await makeUser({ role: 'master' });
    const client = await logIn(app, master);
    const section = await client.post('/api/wiki/admin/sections', { name: 'Lore' });

    const response = await client.put(`/api/wiki/admin/sections/${section.body.id}`, {
      name: 'History', slug: 'hijacked', createdBy: 999
    });

    expect(response.status).toBe(200);
    const rows = await query('SELECT name, slug, "createdBy" FROM wiki_sections');
    expect(rows).toEqual([{ name: 'History', slug: 'history', createdBy: master.id }]);
  });
});
