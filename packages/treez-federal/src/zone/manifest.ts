import type { ZoneConfig, ZoneManifest } from '../types';

import { DEFAULT_SHARED } from '../constants';
import { normalizeBasePath } from '../host/zone-matcher';

export function createZoneManifest(config: ZoneConfig): ZoneManifest {
  const sharedList: string[] = config.shared ? [...config.shared] : [...DEFAULT_SHARED];

  return {
    name: config.name,
    mode: 'zone',
    basePath: normalizeBasePath(config.basePath),
    routesFile: config.routes ? config.routes : undefined,
    shared: sharedList,
    buildTime: new Date().toISOString(),
  };
}

export function generateManifestJson(manifest: ZoneManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function generateManifestVirtualModule(manifest: ZoneManifest): string {
  return `export const manifest = ${JSON.stringify(manifest, null, 2)};\nexport default manifest;\n`;
}
