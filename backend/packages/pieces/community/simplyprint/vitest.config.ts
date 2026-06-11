import path from 'path';
import { defineConfig } from 'vitest/config';

const repoRoot = path.resolve(__dirname, '../../../..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@activepieces/shared': path.resolve(repoRoot, 'backend/packages/shared/src/index.ts'),
      '@activepieces/pieces-framework': path.resolve(repoRoot, 'backend/packages/pieces/framework/src/index.ts'),
      '@activepieces/pieces-common': path.resolve(repoRoot, 'backend/packages/pieces/common/src/index.ts'),
    },
  },
});
