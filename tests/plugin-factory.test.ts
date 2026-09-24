import { describe, expect, it } from 'vitest';

import {
  RESOLVED_VIRTUAL_HOST_INIT,
  RESOLVED_VIRTUAL_MANIFEST,
  RESOLVED_VIRTUAL_ZONE_ENTRY,
  VIRTUAL_HOST_INIT,
  VIRTUAL_MANIFEST,
  VIRTUAL_ZONE_ENTRY,
} from '../packages/treez-federal/src/constants';
import { federal } from '../packages/treez-federal/src/index';

describe('plugin-factory', () => {
  it('configures host mode plugin correctly', () => {
    const plugin = federal({
      name: 'rootShell',
      mode: 'host',
      zones: {
        dashboard: {
          basePath: '/dashboard',
          target: 'http://localhost:3001',
        },
      },
    });

    expect(plugin.name).toBe('treez-federal:host');

    // Test virtual host init module:
    if (typeof plugin.resolveId === 'function') {
      const resolved = (plugin.resolveId as any)(VIRTUAL_HOST_INIT);
      expect(resolved).toBe(RESOLVED_VIRTUAL_HOST_INIT);
    }

    if (typeof plugin.load === 'function') {
      const loaded = (plugin.load as any)(RESOLVED_VIRTUAL_HOST_INIT);
      expect(loaded).toContain('initSharedContainer');
      expect(loaded).toContain('container.set');
    }

    // Test index.html transform:
    if (typeof plugin.transformIndexHtml === 'function') {
      const html = '<html><head></head><body></body></html>';
      const transformed = (plugin.transformIndexHtml as any)(html);
      expect(transformed).toContain(VIRTUAL_HOST_INIT);
    }
  });

  it('configures zone mode plugin correctly', () => {
    const plugin = federal({
      name: 'dashboardZone',
      mode: 'zone',
      basePath: '/dashboard',
      routes: './src/routes/index.ts',
      shared: ['react', 'react-dom'],
    });

    expect(plugin.name).toBe('treez-federal:zone');

    // Test user config augmentation:
    if (typeof plugin.config === 'function') {
      const userConfig = (plugin.config as any)({});
      expect(userConfig.base).toBe('/dashboard/');
      expect(userConfig.optimizeDeps?.exclude).toContain('react');
      expect(userConfig.optimizeDeps?.exclude).toContain('react-dom');
    }

    // Test resolveId for zone entry and manifest:
    if (typeof plugin.resolveId === 'function') {
      expect((plugin.resolveId as any)(VIRTUAL_ZONE_ENTRY)).toBe(RESOLVED_VIRTUAL_ZONE_ENTRY);
      expect((plugin.resolveId as any)(VIRTUAL_MANIFEST)).toBe(RESOLVED_VIRTUAL_MANIFEST);
      expect((plugin.resolveId as any)('react')).toBe('\0virtual:treez-federal/shared/react');
    }

    // Test load for zone entry:
    if (typeof plugin.load === 'function') {
      const entryCode = (plugin.load as any)(RESOLVED_VIRTUAL_ZONE_ENTRY);
      expect(entryCode).toContain('createZoneRoutes');
      expect(entryCode).toContain('manifest');
    }
  });
});
