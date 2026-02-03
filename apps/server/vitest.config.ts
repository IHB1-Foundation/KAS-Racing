import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests sequentially to avoid DB conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Ensure test isolation
    sequence: {
      shuffle: false,
    },
    // Environment variables for testing
    env: {
      SKIP_KEY_VALIDATION: 'true',
      NETWORK: 'mainnet',
    },
  },
});
