import { defineConfig } from 'vitest/config';
import { integrationEnv } from './tests/integration/support/env.js';

// HTTP scenarios through createApp() against the docker-compose Postgres, database `rpg_test`
// (schema from src/migrations). Files share one database, so they run one at a time.
export default defineConfig({
  test: {
    name: 'integration',
    environment: 'node',
    include: ['tests/integration/**/*.test.js'],
    env: integrationEnv(),
    globalSetup: ['tests/integration/support/globalSetup.js'],
    setupFiles: ['tests/integration/support/setup.js'],
    fileParallelism: false,
    restoreMocks: true,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
