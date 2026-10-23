import { beforeAll, beforeEach, afterAll } from 'vitest';
import { AppDataSource } from '../../../src/data-source.js';
import { resetDatabase } from './database.js';

// Loaded before every integration file (vitest `setupFiles`). The schema already exists:
// globalSetup ran the migrations. Data is cleaned at the start of each test, never at the end.
beforeAll(async () => {
  await AppDataSource.initialize();
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await AppDataSource.destroy();
});
