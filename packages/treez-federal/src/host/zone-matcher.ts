import type { HostZoneConfig, ZoneMatch } from '../types';

export function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed.length > 0 ? '/' + trimmed : '/';
}

export function matchZone(
  pathname: string,
  zones: Record<string, HostZoneConfig>,
): ZoneMatch | null {
  const urlPath = pathname.split('?')[0].split('#')[0];

  for (const [zoneName, config] of Object.entries(zones)) {
    const base = normalizeBasePath(config.basePath);

    if (urlPath === base) {
      return {
        zoneName,
        config,
        subPath: '/',
      };
    }

    if (urlPath.startsWith(base + '/')) {
      const subPath = urlPath.slice(base.length);
      return {
        zoneName,
        config,
        subPath: subPath.length > 0 ? subPath : '/',
      };
    }
  }

  return null;
}

export function resolveZoneTargetUrl(pathname: string, zoneConfig: HostZoneConfig): string {
  const target = zoneConfig.target ? zoneConfig.target.replace(/\/+$/, '') : 'http://localhost';
  const leadingSlashPath = pathname.startsWith('/') ? pathname : '/' + pathname;
  return target + leadingSlashPath;
}

export function isZoneAssetRequest(pathname: string, basePath: string): boolean {
  const normalizedBase = normalizeBasePath(basePath);
  const cleanPath = pathname.split('?')[0];

  if (!cleanPath.startsWith(normalizedBase)) {
    return false;
  }

  const sub = cleanPath.slice(normalizedBase.length);

  const isAssets = sub.startsWith('/assets/');
  const isViteClient =
    sub.startsWith('/@vite/') || sub.startsWith('/@fs/') || sub.startsWith('/@id/');
  const isEntry = sub.endsWith('/zoneEntry.js') || sub === '/zoneEntry.js';
  const isSource = sub.startsWith('/src/') || sub.startsWith('/node_modules/');
  const isStaticFile =
    /\.(js|mjs|css|svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|json|map)$/i.test(sub);

  return isAssets || isViteClient || isEntry || isSource || isStaticFile ? true : false;
}
