import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 120000,
    hookTimeout: 120000,
    teardownTimeout: 120000,
    setupFiles: ['./tests/setup.ts'],
    // Agent worktrees live under .claude/worktrees and carry their own copies of tests/.
    exclude: [...configDefaults.exclude, '.claude/**'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    }
  }
});
