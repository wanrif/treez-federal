import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import * as TanStackRouter from '@tanstack/react-router';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  clearZoneCache,
  isZoneLoaded,
  loadZoneModule,
  preloadZoneModule,
  resolveZoneEntryUrl,
  validateZoneEntryUrl,
} from '../packages/treez-federal/src/host/virtual-loader';
import {
  createZoneModuleFetcher,
  createZoneRoute,
  findMatchingChildRoute,
  useZoneContext,
  ZoneContext,
  ZoneHostComponent,
  ZoneOutlet,
  ZoneRenderer,
} from '../packages/treez-federal/src/runtime/router';

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

    // Default options
    expect(resolveZoneEntryUrl('analytics')).toBe('/analytics/zoneEntry.js');

    // Target with trailing slash
    expect(
      resolveZoneEntryUrl('analytics', {
        basePath: 'analytics',
        target: 'http://localhost:3000///',
      }),
    ).toBe('http://localhost:3000/analytics/zoneEntry.js');

    // Invalid scheme throwing standard error
    expect(() => validateZoneEntryUrl('invalid:uri:test')).toThrow(
      '[treez-federal] Invalid zone entry URL',
    );
    expect(() => validateZoneEntryUrl('not a valid url at all')).toThrow(
      '[treez-federal] Invalid zone entry URL',
    );
  });

  it('manages zone cache and loads modules properly', async () => {
    clearZoneCache();
    expect(isZoneLoaded('dashboard')).toBe(false);

    // Load with an existing local file starting with /
    const cwd = process
      .cwd()
      .replace(/^[/\\]+/, '')
      .replace(/\\/g, '/');
    const localEntryUrl =
      '/' +
      (process.platform === 'win32' ? cwd : '/' + cwd) +
      '/packages/treez-federal/dist/index.js';
    const mod = await loadZoneModule('dashboard', { entryUrl: localEntryUrl });
    expect(mod).toBeDefined();
    expect(isZoneLoaded('dashboard')).toBe(true);

    // Second call hits cache
    const cachedMod = await loadZoneModule('dashboard', { entryUrl: localEntryUrl });
    expect(cachedMod).toBe(mod);

    // Preload module
    await preloadZoneModule('dashboard', { entryUrl: localEntryUrl });

    // Clear specific zone
    clearZoneCache('dashboard');
    expect(isZoneLoaded('dashboard')).toBe(false);

    // Clear all
    clearZoneCache();

    // Loading nonexistent zone rejects
    await expect(
      loadZoneModule('failZone', { entryUrl: '/nonexistent-entry-fail-123.js' }),
    ).rejects.toThrow('Failed to dynamically load zone "failZone"');

    // Loading zone that throws a non-Error primitive
    const fixturePath =
      '/' + (process.platform === 'win32' ? cwd : '/' + cwd) + '/tests/fixtures/throw-primitive.js';
    await expect(loadZoneModule('primitiveErrZone', { entryUrl: fixturePath })).rejects.toThrow(
      'primitive string error',
    );
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

    // Test getParentRoute calls
    expect((dashboardRoute as any).options.getParentRoute()).toBe(rootRoute);
    const indexRoute = router.routesById['/dashboard/'] as any;
    expect(indexRoute.options.getParentRoute()).toBe(dashboardRoute);
    const splatRoute = router.routesById['/dashboard/$'] as any;
    expect(splatRoute.options.getParentRoute()).toBe(dashboardRoute);

    // Child routes should render ZoneOutlet so they do not duplicate ZoneHostComponent
    const indexElement = indexRoute.options.component();
    expect(indexElement.type.name).toBe('ZoneOutlet');

    const splatElement = splatRoute.options.component();
    expect(splatElement.type.name).toBe('ZoneOutlet');

    // Root component returns ZoneHostComponent element
    const rootElement = (dashboardRoute as any).options.component();
    expect(rootElement.type.name).toBe('ZoneHostComponent');
  });

  it('tests ZoneOutlet and useZoneContext in and out of provider', () => {
    // Outside provider
    expect(renderToString(createElement(ZoneOutlet))).toBe('');

    function Consumer() {
      const ctx = useZoneContext();
      return createElement('span', null, ctx?.zoneName || 'none');
    }

    // Inside provider with null active child
    const withoutChild = renderToString(
      createElement(
        ZoneContext.Provider,
        { value: { zoneName: 'testZone', basePath: '/test', activeChildComponent: null } },
        createElement(Consumer),
        createElement(ZoneOutlet),
      ),
    );
    expect(withoutChild).toContain('testZone');

    // Inside provider with active child
    const DummyChild = () => createElement('b', null, 'child content');
    const withChild = renderToString(
      createElement(
        ZoneContext.Provider,
        { value: { zoneName: 'testZone', basePath: '/test', activeChildComponent: DummyChild } },
        createElement(ZoneOutlet),
      ),
    );
    expect(withChild).toContain('child content');
  });

  it('tests findMatchingChildRoute matching branches', () => {
    const root = createRootRoute();
    const child1 = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: () => createElement('div', null, 'index-child'),
    });
    const child2 = createRoute({
      getParentRoute: () => root,
      path: 'settings',
      component: () => createElement('div', null, 'settings-child'),
    });
    const child3 = createRoute({
      getParentRoute: () => root,
      path: '/about',
    });

    const tree = root.addChildren([child1, child2, child3]);

    // Path === '/' exact
    expect(findMatchingChildRoute(tree, '/dash', '/dash')).toBe(child1.options.component);
    // Path === '' (empty sub)
    expect(findMatchingChildRoute(tree, '/dash/', '/dash')).toBe(child1.options.component);
    // Path === 'settings'
    expect(findMatchingChildRoute(tree, '/dash/settings', '/dash')).toBe(child2.options.component);
    // Subpath matching settings/profile
    expect(findMatchingChildRoute(tree, '/dash/settings/profile', '/dash')).toBe(
      child2.options.component,
    );
    // No match
    expect(findMatchingChildRoute(tree, '/dash/nomatch', '/dash')).toBeNull();
    // Non-starting basePath
    expect(findMatchingChildRoute(tree, '/other/path', '/dash')).toBeNull();
    // Route without children
    expect(findMatchingChildRoute(child1, '/dash', '/dash')).toBeNull();
    // Route child with path '/about' having no component
    expect(findMatchingChildRoute(tree, '/dash/about', '/dash')).toBeNull();

    // Route child with path '/' having no component
    const childEmpty = createRoute({
      getParentRoute: () => root,
      path: '/',
    });
    const emptyTree = root.addChildren([childEmpty]);
    expect(findMatchingChildRoute(emptyTree, '/dash', '/dash')).toBeNull();

    // Route child with no path property
    const childNoPath = { options: {} } as any;
    expect(findMatchingChildRoute({ children: [childNoPath] } as any, '/dash', '/dash')).toBeNull();
  });

  it('tests ZoneRenderer with various module formats', async () => {
    const root = createRootRoute();
    const Child = () => createElement('span', null, 'child-rendered');
    const RootComp = (props: any) => createElement('div', null, props.children);

    const options = {
      parentRoute: root,
      zoneName: 'dash',
      basePath: '/dash',
    };

    async function renderWithRouter(mod: any, initialPath = '/dash/child') {
      const root = createRootRoute();
      const page = createRoute({
        getParentRoute: () => root,
        path: '$',
        component: () => createElement(ZoneRenderer, { options, module: mod }),
      });
      const router = createRouter({
        routeTree: root.addChildren([page]),
        history: TanStackRouter.createMemoryHistory({ initialEntries: [initialPath] }),
      });
      await router.load();
      return renderToString(createElement(TanStackRouter.RouterProvider, { router }));
    }

    // Case 1: remoteTree with root component and matching child
    const mod1 = {
      createZoneRoutes: (parent: any) => {
        const c = createRoute({ getParentRoute: () => parent, path: 'child', component: Child });
        const r = createRoute({
          getParentRoute: () => parent,
          path: '/',
          component: RootComp,
        });
        return r.addChildren([c]);
      },
    };
    const html1 = await renderWithRouter(mod1, '/dash/child');
    expect(html1).toContain('child-rendered');

    // Case 2: default export component
    const mod2 = {
      default: RootComp,
    };
    const html2 = await renderWithRouter(mod2, '/dash/other');
    expect(html2).toContain('<div></div>');

    // Case 3: childComponent only (no root component)
    const mod3 = {
      createZoneRoutes: (parent: any) => {
        const c = createRoute({ getParentRoute: () => parent, path: 'child', component: Child });
        const r = createRoute({
          getParentRoute: () => parent,
          path: '/',
        });
        return r.addChildren([c]);
      },
    };
    const html3 = await renderWithRouter(mod3, '/dash/child');
    expect(html3).toContain('child-rendered');

    // Case 4: neither root nor child matches
    const mod4 = {};
    const html4 = await renderWithRouter(mod4, '/dash/none');
    expect(html4).toBe('<!--$--><!--/$-->');
  });

  it('tests ZoneHostComponent fallbacks and lifecycle states', async () => {
    // Initial loading state with custom loader fallback
    const root = createRootRoute();
    const htmlLoader = renderToString(
      createElement(ZoneHostComponent, {
        options: {
          parentRoute: root,
          zoneName: 'customZone',
          basePath: '/custom',
          loaderFallback: () => createElement('div', null, 'custom loader...'),
        },
      }),
    );
    expect(htmlLoader).toContain('custom loader...');

    // Initial loading state default
    const htmlDefaultLoader = renderToString(
      createElement(ZoneHostComponent, {
        options: {
          parentRoute: root,
          zoneName: 'customZone',
          basePath: '/custom',
        },
      }),
    );
    expect(htmlDefaultLoader).toContain('Loading Zone...');

    // Error state with Error instance (default renderer)
    const htmlErrorInstance = renderToString(
      createElement(ZoneHostComponent, {
        options: {
          parentRoute: root,
          zoneName: 'customZone',
          basePath: '/custom',
        },
        initialLoadState: {
          status: 'error',
          error: new Error('Network timeout'),
        },
      }),
    );
    expect(htmlErrorInstance).toContain(
      'Failed to load zone &quot;customZone&quot;: Network timeout',
    );

    // Error state with plain string (default renderer)
    const htmlErrorString = renderToString(
      createElement(ZoneHostComponent, {
        options: {
          parentRoute: root,
          zoneName: 'customZone',
          basePath: '/custom',
        },
        initialLoadState: {
          status: 'error',
          error: 'Something went wrong',
        },
      }),
    );
    expect(htmlErrorString).toContain(
      'Failed to load zone &quot;customZone&quot;: Something went wrong',
    );

    // Error state with custom errorFallback
    const htmlCustomError = renderToString(
      createElement(ZoneHostComponent, {
        options: {
          parentRoute: root,
          zoneName: 'customZone',
          basePath: '/custom',
          errorFallback: (err) => createElement('div', null, `Custom: ${String(err)}`),
        },
        initialLoadState: {
          status: 'error',
          error: 'Fatal crash',
        },
      }),
    );
    expect(htmlCustomError).toContain('Custom: Fatal crash');

    // Success state with missing module returns null
    const htmlSuccessNoMod = renderToString(
      createElement(ZoneHostComponent, {
        options: {
          parentRoute: root,
          zoneName: 'customZone',
          basePath: '/custom',
        },
        initialLoadState: {
          status: 'success',
        },
      }),
    );
    expect(htmlSuccessNoMod).toBe('');

    // Success state with valid module renders ZoneRenderer
    const dummyRoute = createRoute({
      getParentRoute: () => root,
      path: '$',
      component: () =>
        createElement(ZoneHostComponent, {
          options: {
            parentRoute: root,
            zoneName: 'customZone',
            basePath: '/custom',
          },
          initialLoadState: {
            status: 'success',
            module: { default: () => createElement('span', null, 'Zone Rendered Content') },
          },
        }),
    });
    const router = createRouter({
      routeTree: root.addChildren([dummyRoute]),
      history: TanStackRouter.createMemoryHistory({ initialEntries: ['/custom'] }),
    });
    await router.load();
    const htmlSuccess = renderToString(createElement(TanStackRouter.RouterProvider, { router }));
    expect(htmlSuccess).toContain('Zone Rendered Content');

    // Test createZoneModuleFetcher callbacks
    let successCalled = false;
    let errorCalled = false;

    // 1. Success case using cached module
    const cwd = process
      .cwd()
      .replace(/^[/\\]+/, '')
      .replace(/\\/g, '/');
    const localEntryUrl =
      '/' +
      (process.platform === 'win32' ? cwd : '/' + cwd) +
      '/packages/treez-federal/dist/index.js';
    createZoneModuleFetcher(
      { zoneName: 'dashboard', entryUrl: localEntryUrl, basePath: '/dashboard' },
      () => {
        successCalled = true;
      },
      () => {},
    );

    // 2. Error case with failing zone
    createZoneModuleFetcher(
      { zoneName: 'failZone', entryUrl: '/nonexistent-entry.js', basePath: '/fail' },
      () => {},
      () => {
        errorCalled = true;
      },
    );

    // 3. Cancelled case on error
    let cancelledError = false;
    const cleanupError = createZoneModuleFetcher(
      { zoneName: 'cancelZoneErr', entryUrl: '/nonexistent-entry.js', basePath: '/cancel' },
      () => {},
      () => {
        cancelledError = true;
      },
    );
    cleanupError(); // immediately cancel

    // 4. Cancelled case on success
    let cancelledSuccess = false;
    const cleanupSuccess = createZoneModuleFetcher(
      { zoneName: 'dashboard', entryUrl: localEntryUrl, basePath: '/dashboard' },
      () => {
        cancelledSuccess = true;
      },
      () => {},
    );
    cleanupSuccess(); // immediately cancel

    await new Promise((r) => setTimeout(r, 60));
    expect(successCalled).toBe(true);
    expect(errorCalled).toBe(true);
    expect(cancelledSuccess).toBe(false);
    expect(cancelledError).toBe(false);

    // Exercise ZoneHostComponent's internal effect callbacks via hookRunner
    const capturedEffects: (() => void | (() => void))[] = [];
    const hookRunner = (fn: any) => {
      capturedEffects.push(fn);
    };

    renderToString(
      createElement(ZoneHostComponent, {
        options: {
          parentRoute: root,
          zoneName: 'dashboard',
          basePath: '/dashboard',
          entryUrl: localEntryUrl,
        },
        hookRunner,
      }),
    );

    renderToString(
      createElement(ZoneHostComponent, {
        options: {
          parentRoute: root,
          zoneName: 'failZone',
          basePath: '/fail',
          entryUrl: '/nonexistent-entry-999.js',
        },
        hookRunner,
      }),
    );

    const cleanups = capturedEffects.map((fn) => fn());
    await new Promise((r) => setTimeout(r, 60));

    cleanups.forEach((c) => {
      if (typeof c === 'function') {
        c();
      }
    });
  });
});
