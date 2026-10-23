import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('GET /api/health (public health check)', () => {
  // RSS_BUDGET_BYTES is 8 GiB in the integration env (support/env.js)
  it('reports real memory numbers against the configured budget and healthy status with the database connected', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.error).toBeUndefined();
    expect(response.body.status).toBe('healthy');
    expect(response.body.memory.usage_percent).toBeGreaterThan(0);
    expect(response.body.memory.rss_mb).toBeGreaterThan(0);
    expect(response.body.memory.limit_mb).toBe(8192);
    expect(response.body.memory.status).toBe('healthy');
    expect(response.body.database.status).toBe('connected');
  });

  // L34: the health router used to be mounted on /api itself
  it('is no longer served at the bare /api/ path', async () => {
    const response = await request(app).get('/api/');

    expect(response.status).toBe(404);
  });
});
