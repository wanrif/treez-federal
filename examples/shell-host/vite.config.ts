import path from 'node:path';
import { defineConfig } from 'vite';

import { federal } from '../../packages/treez-federal/src/index';

const currentDir = import.meta.dirname || process.cwd();

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@wanrif/treez-federal/router': path.resolve(
        currentDir,
        '../../packages/treez-federal/src/runtime/router.ts',
      ),
      '@wanrif/treez-federal/runtime': path.resolve(
        currentDir,
        '../../packages/treez-federal/src/runtime/index.ts',
      ),
      '@wanrif/treez-federal': path.resolve(
        currentDir,
        '../../packages/treez-federal/src/index.ts',
      ),
      'treez-federal/router': path.resolve(
        currentDir,
        '../../packages/treez-federal/src/runtime/router.ts',
      ),
      'treez-federal/runtime': path.resolve(
        currentDir,
        '../../packages/treez-federal/src/runtime/index.ts',
      ),
      'treez-federal': path.resolve(currentDir, '../../packages/treez-federal/src/index.ts'),
    },
  },
  plugins: [
    federal({
      name: 'rootShell',
      mode: 'host',
      zones: {
        dashboard: {
          basePath: '/dashboard',
          target: 'http://localhost:3001',
        },
      },
      shared: ['react', 'react-dom', '@tanstack/react-router'],
    }),
  ],
});
