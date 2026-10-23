import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { makeUser, TEST_PASSWORD } from './support/factories.js';

const app = createApp();

describe('JSON API responses', () => {
  it('are labelled application/json', async () => {
    const user = await makeUser();

    const response = await request(app).post('/api/auth/login').send({ username: user.username, password: TEST_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
  });
});
