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

  it('creates zone manifest with default values when options omitted', () => {
    const manifest = createZoneManifest({
      name: 'minimalZone',
      mode: 'zone',
      basePath: 'minimal',
    });

    expect(manifest.routesFile).toBeUndefined();
    expect(manifest.shared.length).toBeGreaterThan(0);
    expect(manifest.basePath).toBe('/minimal');
  });

  it('generates zoneEntry.js code with proper imports, backslashes, and manifest', () => {
    const manifest = createZoneManifest({
      name: 'testZone',
      mode: 'zone',
      basePath: '/test',
    });

    const code = generateZoneEntryCode({
      routesPath: 'src\\routes\\index.ts',
      manifest,
    });

    expect(code).toContain('src/routes/index.ts');
    expect(code).toContain('"name": "testZone"');
  });

  it('generates zoneEntry.js code with proper imports when manifest omitted', () => {
    const code = generateZoneEntryCode({
      routesPath: './src/routes/index.ts',
    });

    expect(code).toContain('createZoneRoutes as _createZoneRoutes');
    expect(code).toContain('manifest = {}');
  });
});
