import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

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
  it('configures host mode plugin correctly and exercises all hooks', () => {
    const plugin = federal({
      name: 'rootShell',
      mode: 'host',
      shared: ['react', 'react-dom'],
      zones: {
        dashboard: {
          basePath: '/dashboard',
          target: 'http://localhost:3001',
        },
      },
    });

    expect(plugin.name).toBe('treez-federal:host');

    // 1. config hook
    const configFn = plugin.config as Function;
    expect(typeof configFn).toBe('function');
    const userConfig = configFn.call(plugin);
    expect(userConfig.optimizeDeps?.include).toContain('react');
    expect(userConfig.optimizeDeps?.include).toContain('react-dom');
    expect(userConfig.optimizeDeps?.include).toContain('react/jsx-runtime');
    expect(userConfig.optimizeDeps?.exclude).toEqual(['@wanrif/treez-federal/runtime']);

    // 2. configResolved hook
    const configResolvedFn = plugin.configResolved as Function;
    expect(typeof configResolvedFn).toBe('function');
    configResolvedFn.call(plugin, { root: '/custom/root' });

    // 3. resolveId hook
    const resolveId = plugin.resolveId as Function;
    expect(typeof resolveId).toBe('function');
    expect(resolveId.call(plugin, VIRTUAL_HOST_INIT)).toBe(RESOLVED_VIRTUAL_HOST_INIT);
    expect(resolveId.call(plugin, 'unknown-module')).toBeNull();

    // 4. load hook
    const load = plugin.load as Function;
    expect(typeof load).toBe('function');
    const loaded = load.call(plugin, RESOLVED_VIRTUAL_HOST_INIT);
    expect(loaded).toContain('initSharedContainer');
    expect(loaded).toContain('container.set');
    expect(load.call(plugin, 'unknown-module')).toBeNull();

    // 5. transformIndexHtml hook with <head> and without <head>
    const transformIndexHtml = plugin.transformIndexHtml as Function;
    expect(typeof transformIndexHtml).toBe('function');
    const htmlWithHead = '<html><head></head><body></body></html>';
    const transformedWithHead = transformIndexHtml.call(plugin, htmlWithHead);
    expect(transformedWithHead).toContain(VIRTUAL_HOST_INIT);

    const htmlWithoutHead = '<div>No head</div>';
    const transformedWithoutHead = transformIndexHtml.call(plugin, htmlWithoutHead);
    expect(transformedWithoutHead).toContain(VIRTUAL_HOST_INIT);
    expect(transformedWithoutHead).toContain('<div>No head</div>');

    // 6. configureServer hook
    const configureServer = plugin.configureServer as Function;
    expect(typeof configureServer).toBe('function');
    let middlewareUsed: any = null;
    const mockServer: any = {
      middlewares: {
        use: (fn: any) => {
          middlewareUsed = fn;
        },
      },
    };
    configureServer.call(plugin, mockServer);
    expect(typeof middlewareUsed).toBe('function');
  });

  it('configures zone mode plugin correctly and exercises all hooks', async () => {
    const plugin = federal({
      name: 'dashboardZone',
      mode: 'zone',
      basePath: '/dashboard',
      routes: './src/routes/index.ts',
      shared: ['react', 'react-dom'],
    });

    expect(plugin.name).toBe('treez-federal:zone');

    // 1. config hook (with existing optimizeDeps.exclude)
    const configFn = plugin.config as Function;
    expect(typeof configFn).toBe('function');
    const userConfigWithExisting = configFn.call(plugin, {
      optimizeDeps: { exclude: ['custom-lib'] },
    });
    expect(userConfigWithExisting.base).toBe('/dashboard/');
    expect(userConfigWithExisting.optimizeDeps?.exclude).toContain('custom-lib');
    expect(userConfigWithExisting.optimizeDeps?.exclude).toContain('react');

    // config hook (without optimizeDeps)
    const userConfigEmpty = configFn.call(plugin, {});
    expect(userConfigEmpty.optimizeDeps?.exclude).toContain('react');
    expect(userConfigEmpty.optimizeDeps?.exclude).toContain('react-dom');

    // 2. configResolved hook
    const configResolvedFn = plugin.configResolved as Function;
    expect(typeof configResolvedFn).toBe('function');
    configResolvedFn.call(plugin, { root: '/custom/app/root' });

    // 3. resolveId hook
    const resolveId = plugin.resolveId as Function;
    expect(typeof resolveId).toBe('function');
    expect(resolveId.call(plugin, VIRTUAL_ZONE_ENTRY)).toBe(RESOLVED_VIRTUAL_ZONE_ENTRY);
    expect(resolveId.call(plugin, VIRTUAL_MANIFEST)).toBe(RESOLVED_VIRTUAL_MANIFEST);
    expect(resolveId.call(plugin, 'react')).toBe('\0virtual:treez-federal/shared/react');
    expect(resolveId.call(plugin, 'unshared-pkg')).toBeNull();

    // 4. load hook
    const load = plugin.load as Function;
    expect(typeof load).toBe('function');

    // Zone entry with relative routes and resolvedConfig
    const entryCode = load.call(plugin, RESOLVED_VIRTUAL_ZONE_ENTRY);
    expect(entryCode).toContain('createZoneRoutes');
    expect(entryCode).toContain('manifest');
    expect(entryCode).toContain(
      path.resolve('/custom/app/root', './src/routes/index.ts').replace(/\\/g, '/'),
    );

    // Zone manifest virtual module
    const manifestModule = load.call(plugin, RESOLVED_VIRTUAL_MANIFEST);
    expect(manifestModule).toContain('export default');
    expect(manifestModule).toContain('"name": "dashboardZone"');

    // Shared virtual module
    const sharedModule = load.call(plugin, '\0virtual:treez-federal/shared/react');
    expect(sharedModule).toContain('_getSharedContainer');

    // Unknown virtual module
    expect(load.call(plugin, 'some-random-id')).toBeNull();

    // 5. Test load with absolute route path and default routes without configResolved
    const absolutePath = path.resolve('/custom/absolute/routes.ts');
    const absolutePlugin = federal({
      name: 'absZone',
      mode: 'zone',
      basePath: '/abs',
      routes: absolutePath,
    });
    const absEntryCode = (absolutePlugin.load as Function).call(
      absolutePlugin,
      RESOLVED_VIRTUAL_ZONE_ENTRY,
    );
    expect(absEntryCode).toContain(absolutePath.replace(/\\/g, '/'));

    // Default routes without configResolved (falls back to process.cwd() and ./src/routes/index.ts)
    const defaultPlugin = federal({
      name: 'defaultZone',
      mode: 'zone',
      basePath: '/default',
    });
    const defaultEntryCode = (defaultPlugin.load as Function).call(
      defaultPlugin,
      RESOLVED_VIRTUAL_ZONE_ENTRY,
    );
    expect(defaultEntryCode).toContain('src/routes/index.ts');

    // 6. configureServer middleware
    const configureServer = plugin.configureServer as Function;
    let middleware: any = null;
    let transformResult: any = { code: 'console.log("transformed code");' };
    let shouldRejectTransform = false;

    const mockServer: any = {
      transformRequest: vi.fn<() => Promise<any>>(async () => {
        if (shouldRejectTransform) {
          throw new Error('transform failed');
        }
        return transformResult;
      }),
      middlewares: {
        use: (fn: any) => {
          middleware = fn;
        },
      },
    };

    configureServer.call(plugin, mockServer);
    expect(typeof middleware).toBe('function');

    // Case 6a: Matching entryRoute with query string
    let resCode = 0;
    let resEndBody = '';
    const mockRes: any = {
      statusCode: 0,
      setHeader: () => {},
      end: (b: string) => {
        resEndBody = b;
      },
    };
    Object.defineProperty(mockRes, 'statusCode', {
      set(val) {
        resCode = val;
      },
    });

    let nextCalled = false;
    let nextErr: any = null;
    const nextFn = (err?: any) => {
      nextCalled = true;
      nextErr = err;
    };

    middleware({ url: '/dashboard/zoneEntry.js?t=123' }, mockRes, nextFn);
    await new Promise((r) => setTimeout(r, 10));
    expect(resCode).toBe(200);
    expect(resEndBody).toBe('console.log("transformed code");');

    // Case 6b: Matching /zoneEntry.js directly, but transformRequest returns null
    transformResult = null;
    nextCalled = false;
    middleware({ url: '/zoneEntry.js' }, mockRes, nextFn);
    await new Promise((r) => setTimeout(r, 10));
    expect(nextCalled).toBe(true);

    // Case 6c: Matching entryRoute but transformRequest rejects with error
    shouldRejectTransform = true;
    nextCalled = false;
    nextErr = null;
    middleware({ url: '/dashboard/zoneEntry.js' }, mockRes, nextFn);
    await new Promise((r) => setTimeout(r, 10));
    expect(nextCalled).toBe(true);
    expect(nextErr).toBeInstanceOf(Error);
    expect(nextErr.message).toBe('transform failed');

    // Case 6d: Non-matching URL
    nextCalled = false;
    middleware({ url: '/other/path' }, mockRes, nextFn);
    expect(nextCalled).toBe(true);

    // Case 6e: Missing req.url
    nextCalled = false;
    middleware({}, mockRes, nextFn);
    expect(nextCalled).toBe(true);

    // 7. generateBundle hook
    const generateBundle = plugin.generateBundle as Function;
    expect(typeof generateBundle).toBe('function');
    let emittedFile: any = null;
    const mockContext = {
      emitFile: (file: any) => {
        emittedFile = file;
      },
    };
    generateBundle.call(mockContext);
    expect(emittedFile).toBeDefined();
    expect(emittedFile.type).toBe('asset');
    expect(emittedFile.fileName).toBe('manifest.json');
    expect(emittedFile.source).toContain('"name": "dashboardZone"');
  });
});
