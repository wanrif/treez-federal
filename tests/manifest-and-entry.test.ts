import { describe, expect, it } from 'vitest';

import { generateZoneEntryCode } from '../packages/treez-federal/src/zone/entry-builder';
import {
  createZoneManifest,
  generateManifestJson,
  generateManifestVirtualModule,
} from '../packages/treez-federal/src/zone/manifest';

describe('manifest-and-entry', () => {
  it('creates zone manifest with normalized values', () => {
    const manifest = createZoneManifest({
      name: 'dashboardZone',
      mode: 'zone',
      basePath: '/dashboard/',
      routes: './src/routes/index.ts',
      shared: ['react', 'react-dom'],
    });

    expect(manifest.name).toBe('dashboardZone');
    expect(manifest.mode).toBe('zone');
    expect(manifest.basePath).toBe('/dashboard');
    expect(manifest.routesFile).toBe('./src/routes/index.ts');
    expect(manifest.shared).toEqual(['react', 'react-dom']);
    expect(manifest.buildTime).toBeDefined();

    const json = generateManifestJson(manifest);
    expect(json).toContain('"name": "dashboardZone"');

    const virtualMod = generateManifestVirtualModule(manifest);
    expect(virtualMod).toContain('export const manifest');
  });

  it('generates zoneEntry.js code with proper imports and exports', () => {
    const code = generateZoneEntryCode({
      routesPath: './src/routes/index.ts',
    });

    expect(code).toContain('createZoneRoutes as _createZoneRoutes');
    expect(code).toContain('./src/routes/index.ts');
    expect(code).toContain('export const createZoneRoutes = _createZoneRoutes;');
    expect(code).toContain('export default');
  });
});
