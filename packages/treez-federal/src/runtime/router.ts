import type { Context } from 'react';

import { createRoute, type AnyRoute, useLocation } from '@tanstack/react-router';
import {
  createElement,
  createContext,
  useContext,
  useEffect,
  useState,
  Fragment,
  type ReactElement,
  type ComponentType,
} from 'react';

import type { CreateZoneRouteOptions, ZoneRouteModule } from '../types';

import { loadZoneModule } from '../host/virtual-loader';
import { normalizeBasePath } from '../host/zone-matcher';

export interface ZoneContextValue {
  zoneName: string;
  basePath: string;
  activeChildComponent: ComponentType | null;
}

export const ZoneContext: Context<ZoneContextValue | null> = createContext<ZoneContextValue | null>(
  null,
);

export function useZoneContext(): ZoneContextValue | null {
  return useContext(ZoneContext);
}

export function ZoneOutlet(): ReactElement | null {
  const ctx = useZoneContext();
  if (ctx && ctx.activeChildComponent) {
    return createElement(ctx.activeChildComponent);
  }
  return null;
}

interface ZoneRendererProps {
  options: CreateZoneRouteOptions;
  module: ZoneRouteModule;
}

function findMatchingChildRoute(
  routeTree: AnyRoute,
  currentPath: string,
  basePath: string,
): ComponentType | null {
  const normBase = normalizeBasePath(basePath);
  let sub = currentPath.startsWith(normBase) ? currentPath.slice(normBase.length) : currentPath;
  if (!sub.startsWith('/')) {
    sub = '/' + sub;
  }

  const children = (routeTree.children as AnyRoute[] | undefined) || [];

  for (const child of children) {
    const childRecord = child as unknown as Record<string, unknown>;
    const optionsRecord = child.options as unknown as Record<string, unknown> | undefined;
    const rawPath = (childRecord.path || optionsRecord?.path || '/') as string;
    const childPath = typeof rawPath === 'string' ? rawPath : '/';
    if (childPath === '/' && (sub === '/' || sub === '')) {
      return (child.options.component as ComponentType) || null;
    }
    const cleanChild = childPath.startsWith('/') ? childPath : '/' + childPath;
    if (cleanChild !== '/' && (sub === cleanChild || sub.startsWith(cleanChild + '/'))) {
      return (child.options.component as ComponentType) || null;
    }
  }

  return null;
}

function ZoneRenderer(props: ZoneRendererProps): ReactElement | null {
  const location = useLocation();
  const { options, module } = props;

  let remoteTree: AnyRoute | null = null;
  if (typeof module.createZoneRoutes === 'function') {
    remoteTree = module.createZoneRoutes(options.parentRoute);
  }

  const childComponent = remoteTree
    ? findMatchingChildRoute(remoteTree, location.pathname, options.basePath)
    : null;

  const contextValue: ZoneContextValue = {
    zoneName: options.zoneName,
    basePath: options.basePath,
    activeChildComponent: childComponent,
  };

  let rootComponent: ComponentType | null = null;
  if (remoteTree && remoteTree.options.component) {
    rootComponent = remoteTree.options.component as ComponentType;
  } else if (typeof module.default === 'function') {
    rootComponent = module.default as ComponentType;
  }

  if (rootComponent) {
    return createElement(
      ZoneContext.Provider,
      { value: contextValue },
      createElement(rootComponent, null, childComponent ? createElement(childComponent) : null),
    );
  }

  if (childComponent) {
    return createElement(
      ZoneContext.Provider,
      { value: contextValue },
      createElement(childComponent),
    );
  }

  return null;
}

function ZoneHostComponent(props: { options: CreateZoneRouteOptions }): ReactElement | null {
  const { options } = props;
  const [loadState, setLoadState] = useState<{
    status: 'loading' | 'success' | 'error';
    module?: ZoneRouteModule;
    error?: unknown;
  }>({
    status: 'loading',
  });

  useEffect(
    function fetchModule(): () => void {
      let isCancelled = false;

      loadZoneModule(options.zoneName, {
        basePath: options.basePath,
        entryUrl: options.entryUrl,
      })
        .then(function onLoadSuccess(mod: ZoneRouteModule): void {
          if (!isCancelled) {
            setLoadState({ status: 'success', module: mod });
          }
        })
        .catch(function onLoadError(err: unknown): void {
          if (!isCancelled) {
            setLoadState({ status: 'error', error: err });
          }
        });

      return function cleanup(): void {
        isCancelled = true;
      };
    },
    [options.zoneName, options.basePath, options.entryUrl],
  );

  if (loadState.status === 'loading') {
    return options.loaderFallback
      ? createElement(Fragment, null, options.loaderFallback())
      : createElement('div', { className: 'treez-zone-loading' }, 'Loading Zone...');
  }

  if (loadState.status === 'error') {
    if (options.errorFallback) {
      return createElement(Fragment, null, options.errorFallback(loadState.error));
    }
    const message =
      loadState.error instanceof Error ? loadState.error.message : String(loadState.error);
    return createElement(
      'div',
      { className: 'treez-zone-error', style: { color: 'red', padding: '1rem' } },
      `Failed to load zone "${options.zoneName}": ${message}`,
    );
  }

  if (loadState.status === 'success' && loadState.module) {
    return createElement(ZoneRenderer, {
      options,
      module: loadState.module,
    });
  }

  return null;
}

export function createZoneRoute(options: CreateZoneRouteOptions): AnyRoute {
  const rawPath = options.basePath.replace(/^\/+|\/+$/g, '');

  const zoneRoute = createRoute({
    getParentRoute: function getParent(): AnyRoute {
      return options.parentRoute;
    },
    path: rawPath,
    component: function ZoneRootRoute(): ReactElement | null {
      return createElement(ZoneHostComponent, { options });
    },
  });

  const zoneIndexRoute = createRoute({
    getParentRoute: function getParent(): AnyRoute {
      return zoneRoute;
    },
    path: '/',
    component: function ZoneIndexRoute(): ReactElement | null {
      return createElement(ZoneHostComponent, { options });
    },
  });

  const zoneSplatRoute = createRoute({
    getParentRoute: function getParent(): AnyRoute {
      return zoneRoute;
    },
    path: '$',
    component: function ZoneSplatRoute(): ReactElement | null {
      return createElement(ZoneHostComponent, { options });
    },
  });

  return zoneRoute.addChildren([zoneIndexRoute, zoneSplatRoute]);
}
