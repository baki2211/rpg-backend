import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { makeUser } from './support/factories.js';

const app = createApp();

// L39: admin maintenance actions are now wrapped for the audit log. The responses stay as they were.
describe('admin maintenance actions', () => {
  it('an admin reloads the static data cache', async () => {
    const admin = await makeUser({ role: 'admin' });
    const client = await logIn(app, admin);

    const response = await client.post('/api/admin/cache/reload');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('reloading an unknown cache entity is a 400 that lists the valid ones', async () => {
    const admin = await makeUser({ role: 'admin' });
    const client = await logIn(app, admin);

    const response = await client.post('/api/admin/cache/reload/Dragon');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "Unknown entity 'Dragon'. Valid: Race, Skill, SkillBranch, SkillType, StatDefinition, Rank, CombatConstant, MasteryTier",
    });
  });

  it('an admin resets the query stats', async () => {
    const admin = await makeUser({ role: 'admin' });
    const client = await logIn(app, admin);

    const response = await client.post('/api/admin/query-stats/reset');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: 'Query monitoring data has been reset' });
  });
});

// L46: /api/health/status used heapUsed/heapTotal as its usage percentage while the public check
// used RSS against the RSS budget. Both now report usage_percent as RSS/budget.
describe('/api/health/status memory figures', () => {
  it('reports RSS usage against the same budget as the public health check, with heap usage named apart', async () => {
    const admin = await makeUser({ role: 'admin' });
    const client = await logIn(app, admin);
    const publicHealth = await request(app).get('/api/health');

    const response = await client.get('/api/health/status');

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.memory).sort()).toEqual([
      'external', 'heapTotal', 'heapUsed', 'heap_usage_percent', 'limit_mb', 'rss', 'usage_percent',
    ]);
    expect(response.body.memory.limit_mb).toBe(publicHealth.body.memory.limit_mb);
    expect(response.body.memory.usage_percent).toBeGreaterThan(0);
  });
});
