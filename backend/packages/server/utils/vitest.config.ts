import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    include: [path.resolve(__dirname, 'test/**/*.test.ts')],
  },
  resolve: {
    alias: {
      '@activepieces/shared': path.resolve(__dirname, '../../../backend/packages/shared/src/index.ts'),
    },
  },
})
