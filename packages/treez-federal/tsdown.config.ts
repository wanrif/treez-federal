import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    router: 'src/runtime/router.ts',
    runtime: 'src/runtime/index.ts',
  },
  format: ['esm'],
  clean: true,
  platform: 'neutral',
  dts: {
    generator: 'oxc',
  },
  deps: {
    neverBundle: ['vite', 'rolldown', 'react', 'react-dom', '@tanstack/react-router', /^node:/],
  },
});
