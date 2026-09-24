import { describe, expect, it } from 'vitest';

import type { HostZoneConfig } from '../packages/treez-federal/src/types';

import {
  isZoneAssetRequest,
  matchZone,
  normalizeBasePath,
  resolveZoneTargetUrl,
} from '../packages/treez-federal/src/host/zone-matcher';

describe('zone-matcher', () => {
  it('normalizes base paths correctly', () => {
    expect(normalizeBasePath('dashboard')).toBe('/dashboard');
    expect(normalizeBasePath('/dashboard')).toBe('/dashboard');
    expect(normalizeBasePath('/dashboard/')).toBe('/dashboard');
    expect(normalizeBasePath('///analytics///')).toBe('/analytics');
    expect(normalizeBasePath('/')).toBe('/');
  });

  const zones: Record<string, HostZoneConfig> = {
    dashboard: {
      basePath: '/dashboard',
      target: 'http://localhost:3001',
    },
    settings: {
      basePath: '/settings/',
      target: 'http://localhost:3002',
    },
  };

  it('matches exact zone root and subpaths', () => {
    const rootMatch = matchZone('/dashboard', zones);
    expect(rootMatch).not.toBeNull();
    expect(rootMatch?.zoneName).toBe('dashboard');
    expect(rootMatch?.subPath).toBe('/');

    const subMatch = matchZone('/dashboard/analytics', zones);
    expect(subMatch).not.toBeNull();
    expect(subMatch?.zoneName).toBe('dashboard');
    expect(subMatch?.subPath).toBe('/analytics');

    const settingsMatch = matchZone('/settings/account', zones);
    expect(settingsMatch).not.toBeNull();
    expect(settingsMatch?.zoneName).toBe('settings');
    expect(settingsMatch?.subPath).toBe('/account');
  });

  it('returns null for non-matching paths', () => {
    expect(matchZone('/', zones)).toBeNull();
    expect(matchZone('/home', zones)).toBeNull();
    expect(matchZone('/dash', zones)).toBeNull();
  });

  it('resolves target URLs correctly', () => {
    const url = resolveZoneTargetUrl('/dashboard/assets/app.js', zones.dashboard);
    expect(url).toBe('http://localhost:3001/dashboard/assets/app.js');
  });

  it('detects zone asset requests accurately', () => {
    expect(isZoneAssetRequest('/dashboard/assets/main.js', '/dashboard')).toBe(true);
    expect(isZoneAssetRequest('/dashboard/zoneEntry.js', '/dashboard')).toBe(true);
    expect(isZoneAssetRequest('/dashboard/@vite/client', '/dashboard')).toBe(true);
    expect(isZoneAssetRequest('/dashboard/logo.svg', '/dashboard')).toBe(true);
    expect(isZoneAssetRequest('/dashboard/src/main.tsx', '/dashboard')).toBe(true);

    // Standard HTML navigation is not an asset request:
    expect(isZoneAssetRequest('/dashboard', '/dashboard')).toBe(false);
    expect(isZoneAssetRequest('/dashboard/overview', '/dashboard')).toBe(false);
  });
});
