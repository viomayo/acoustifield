import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'jsdom',
    exclude: ['tests/e2e/**', 'node_modules/**'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['lib/idb.ts', 'lib/exports.ts', 'lib/supabase/sync.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 75,
        branches: 45,
      },
    },
  },
})
