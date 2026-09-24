import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  platform: 'node',
  target: 'node18',
  exports: true,
  publint: true,
  deps: {
    neverBundle: ['vite', 'rolldown'],
  },
  dts: {
    generator: 'oxc',
  },
});
