import type { ZoneRouteModule } from '../types';

import { normalizeBasePath } from './zone-matcher';

const zoneModuleCache: Map<string, Promise<ZoneRouteModule>> = new Map();

export function validateZoneEntryUrl(url: string): string {
  const trimmed = url.trim();

  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    throw new Error(
      `[treez-federal] Invalid zone entry URL: protocol-relative URLs are disallowed ("${url}")`,
    );
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `[treez-federal] Invalid zone entry URL scheme: only http: and https: are allowed ("${url}")`,
      );
    }
    return parsed.href;
  } catch (err) {
    if (err instanceof Error && err.message.includes('[treez-federal]')) {
      throw err;
    }
    throw new Error(`[treez-federal] Invalid zone entry URL: "${url}"`);
  }
}

export function resolveZoneEntryUrl(
  zoneName: string,
  options?: {
    entryUrl?: string;
    basePath?: string;
    target?: string;
  },
): string {
  if (options?.entryUrl) {
    return validateZoneEntryUrl(options.entryUrl);
  }

  const base = options?.basePath ? normalizeBasePath(options.basePath) : '/' + zoneName;
  const target = options?.target ? options.target.replace(/\/+$/, '') : '';

  const resolved = target ? target + base + '/zoneEntry.js' : base + '/zoneEntry.js';
  return validateZoneEntryUrl(resolved);
}

export function loadZoneModule<T = ZoneRouteModule>(
  zoneName: string,
  options?: {
    entryUrl?: string;
    basePath?: string;
    target?: string;
  },
): Promise<T> {
  const cached = zoneModuleCache.get(zoneName);
  if (cached) {
    return cached as Promise<T>;
  }

  const entryUrl = resolveZoneEntryUrl(zoneName, options);

  const loadPromise = (async function loadRemote(): Promise<ZoneRouteModule> {
    try {
      const mod = (await import(/* @vite-ignore */ entryUrl)) as ZoneRouteModule;
      return mod;
    } catch (error) {
      zoneModuleCache.delete(zoneName);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[treez-federal] Failed to dynamically load zone "${zoneName}" from entry URL "${entryUrl}": ${message}`,
      );
    }
  })();

  zoneModuleCache.set(zoneName, loadPromise);
  return loadPromise as Promise<T>;
}

export function preloadZoneModule(
  zoneName: string,
  options?: {
    entryUrl?: string;
    basePath?: string;
    target?: string;
  },
): Promise<void> {
  return loadZoneModule(zoneName, options).then(function onLoaded(): void {
    return;
  });
}

export function isZoneLoaded(zoneName: string): boolean {
  return zoneModuleCache.has(zoneName);
}

export function clearZoneCache(zoneName?: string): void {
  if (zoneName) {
    zoneModuleCache.delete(zoneName);
  } else {
    zoneModuleCache.clear();
  }
}
