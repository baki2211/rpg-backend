import { defineConfig } from 'vitest/config';

// Unit tests only: no database, no network. Integration tests have their own config
// (vitest.integration.config.js, `npm run test:integration`) because they need Postgres.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/migrations/**', 'src/data-source*.js'],
    },
  },
});
