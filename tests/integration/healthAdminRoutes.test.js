import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { makeUser } from './support/factories.js';

const app = createApp();

// Regression for L36: every /api/health sub-route (stats, cache clear, GC, WebSocket and memory
// cleanup) answered anyone. Only the bare GET /api/health stays public.
describe('/api/health admin routes', () => {
  it('an anonymous cache clear is refused as unauthenticated', async () => {
    const response = await request(app)
      .post('/api/health/cache/clear')
      .set('Cookie', 'csrfToken=matching-token')
      .set('X-CSRF-Token', 'matching-token')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Unauthorized: Token missing' });
  });

  it('a player cannot clear the cache', async () => {
    const player = await makeUser();
    const client = await logIn(app, player);

    const response = await client.post('/api/health/cache/clear');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Access denied: Admins only' });
  });

  it('an admin reads the memory status', async () => {
    const admin = await makeUser({ role: 'admin' });
    const client = await logIn(app, admin);

    const response = await client.get('/api/health/memory/status');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.memory.rss.mb).toBeGreaterThan(0);
  });
});
