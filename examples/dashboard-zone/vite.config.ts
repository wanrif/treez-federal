import path from 'node:path';
import { defineConfig } from 'vite';

import { federal } from '../../packages/treez-federal/src/index';

const currentDir = import.meta.dirname || process.cwd();

export default defineConfig({
  base: '/dashboard/',
  server: {
    port: 3001,
  },
  resolve: {
    alias: {
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
      name: 'dashboardZone',
      mode: 'zone',
      basePath: '/dashboard',
      routes: './src/routes/index.ts',
      shared: ['react', 'react-dom', '@tanstack/react-router'],
    }),
  ],
});
