import { createRootRoute, createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import {
  clearZoneCache,
  isZoneLoaded,
  resolveZoneEntryUrl,
} from '../packages/treez-federal/src/host/virtual-loader';
import { createZoneRoute } from '../packages/treez-federal/src/runtime/router';

describe('router-integration', () => {
  it('resolves zone entry URLs correctly', () => {
    expect(
      resolveZoneEntryUrl('dashboard', {
        basePath: '/dashboard',
        target: 'http://localhost:3001',
      }),
    ).toBe('http://localhost:3001/dashboard/zoneEntry.js');

    expect(
      resolveZoneEntryUrl('dashboard', {
        entryUrl: 'https://cdn.example.com/zones/dashboard/zoneEntry.js',
      }),
    ).toBe('https://cdn.example.com/zones/dashboard/zoneEntry.js');
  });

  it('manages zone cache properly', () => {
    clearZoneCache();
    expect(isZoneLoaded('dashboard')).toBe(false);
  });

  it('stitches remote zone route into TanStack Router route tree', () => {
    const rootRoute = createRootRoute();

    const dashboardRoute = createZoneRoute({
      parentRoute: rootRoute,
      zoneName: 'dashboard',
      basePath: 'dashboard',
    });

    const routeTree = rootRoute.addChildren([dashboardRoute]);
    const router = createRouter({ routeTree });

    expect(router.routesById).toHaveProperty('__root__');
    expect(router.routesById).toHaveProperty('/dashboard');
    expect(router.routesById).toHaveProperty('/dashboard/');
    expect(router.routesById).toHaveProperty('/dashboard/$');
  });
});
