import type { AnyRoute } from '@tanstack/react-router';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ReactNode } from 'react';

export type FederalMode = 'host' | 'zone';

export interface HostZoneConfig {
  basePath: string;
  target?: string;
  entry?: string;
}

export interface HostConfig {
  name: string;
  mode: 'host';
  zones: Record<string, HostZoneConfig>;
  shared?: string[];
  entryName?: string;
}

export interface ZoneConfig {
  name: string;
  mode: 'zone';
  basePath: string;
  routes?: string;
  shared?: string[];
  entryName?: string;
}

export type FederalConfig = HostConfig | ZoneConfig;

export interface ZoneRouteMetadata {
  path: string;
  id?: string;
  isIndex?: boolean;
}

export interface ZoneManifest {
  name: string;
  mode: 'zone';
  basePath: string;
  routesFile?: string;
  shared: string[];
  buildTime: string;
  routes?: ZoneRouteMetadata[];
}

export interface ZoneMatch {
  zoneName: string;
  config: HostZoneConfig;
  subPath: string;
}

export interface ZoneRouteModule {
  createZoneRoutes?: (parentRoute: AnyRoute) => AnyRoute;
  manifest?: ZoneManifest;
  default?: unknown;
}

export interface CreateZoneRouteOptions {
  parentRoute: AnyRoute;
  zoneName: string;
  basePath: string;
  entryUrl?: string;
  loaderFallback?: () => ReactNode;
  errorFallback?: (error: unknown) => ReactNode;
}

export interface SharedContainer {
  version: string;
  modules: Record<string, unknown>;
  get<T = unknown>(name: string): T | undefined;
  set<T = unknown>(name: string, mod: T): void;
  has(name: string): boolean;
  register(name: string, mod: unknown): void;
}

export interface ProxyMiddlewareOptions {
  zones: Record<string, HostZoneConfig>;
  verbose?: boolean;
}

export type MiddlewareHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;
