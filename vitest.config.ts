import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['packages/treez-federal/src/**'],
      exclude: ['**/*.d.ts', '**/types.ts'],
    },
  },
});
