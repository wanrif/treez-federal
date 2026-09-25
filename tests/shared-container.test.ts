import { describe, expect, it } from 'vitest';

import {
  getSharedContainer,
  getSharedModule,
  hasSharedModule,
  initSharedContainer,
  setSharedModule,
} from '../packages/treez-federal/src/runtime/index';
import {
  createSharedVirtualModule,
  fromSharedVirtualId,
  isSharedPackage,
  normalizeSharedList,
  toResolvedSharedVirtualId,
  toSharedVirtualId,
} from '../packages/treez-federal/src/shared/externals';

describe('shared-container', () => {
  it('initializes and returns a singleton container', () => {
    const container1 = initSharedContainer();
    const container2 = getSharedContainer();
    expect(container1).toBe(container2);
  });

  it('stores and retrieves shared modules', () => {
    const mockReact = { version: '19.0.0', createElement: () => null };
    setSharedModule('react', mockReact);

    expect(hasSharedModule('react')).toBe(true);
    expect(getSharedModule('react')).toBe(mockReact);
    expect(hasSharedModule('nonexistent')).toBe(false);
  });

  it('checks shared packages and converts virtual IDs', () => {
    const sharedList = ['react', 'react-dom', '@tanstack/react-router'];

    expect(isSharedPackage('react', sharedList)).toBe(true);
    expect(isSharedPackage('react/jsx-runtime', sharedList)).toBe(true);
    expect(isSharedPackage('lodash', sharedList)).toBe(false);

    const virtualId = toSharedVirtualId('react');
    expect(virtualId).toBe('virtual:treez-federal/shared/react');
    expect(fromSharedVirtualId(virtualId)).toBe('react');

    const resolvedId = toResolvedSharedVirtualId('react');
    expect(resolvedId).toBe('\0virtual:treez-federal/shared/react');
    expect(fromSharedVirtualId(resolvedId)).toBe('react');
  });

  it('generates virtual module code with named exports', () => {
    const code = createSharedVirtualModule('react');
    expect(code).toContain('window.__TREEZ_FEDERAL_SHARED__');
    expect(code).toContain('export const useState');
    expect(code).toContain('export const useEffect');
    expect(code).toContain('export default _defaultExport;');

    const jsxDevCode = createSharedVirtualModule('react/jsx-dev-runtime');
    expect(jsxDevCode).toContain('export const jsxDEV');
    expect(jsxDevCode).toContain('export const Fragment');
  });

  it('normalizes shared list to include jsx-runtime and react-dom client', () => {
    const list = normalizeSharedList(['react', 'react-dom', '@tanstack/react-router']);
    expect(list).toContain('react');
    expect(list).toContain('react-dom');
    expect(list).toContain('react/jsx-runtime');
    expect(list).toContain('react/jsx-dev-runtime');
    expect(list).toContain('react-dom/client');
    expect(list).toContain('@tanstack/react-router');

    // Default shared when undefined:
    const defaultList = normalizeSharedList();
    expect(defaultList).toContain('react');

    // Duplicate packages in list:
    const deduped = normalizeSharedList(['react', 'react', 'react-dom', 'react-dom']);
    expect(deduped.filter((p) => p === 'react').length).toBe(1);

    // react-dom without react:
    const domOnly = normalizeSharedList(['react-dom']);
    expect(domOnly).toContain('react-dom/client');

    // Already includes jsx-runtime and client:
    const fullList = normalizeSharedList([
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
    ]);
    expect(fullList).toContain('react-dom/client');
  });

  it('tests known exports and extraction utilities', async () => {
    const { extractPackageExports, getKnownSharedExports } =
      await import('../packages/treez-federal/src/shared/externals');

    expect(getKnownSharedExports('react')).not.toBeNull();
    expect(getKnownSharedExports('react-dom')).not.toBeNull();
    expect(getKnownSharedExports('react-dom/client')).not.toBeNull();
    expect(getKnownSharedExports('react/jsx-runtime')).not.toBeNull();
    expect(getKnownSharedExports('react/jsx-dev-runtime')).not.toBeNull();
    expect(getKnownSharedExports('@tanstack/react-router')).not.toBeNull();
    expect(getKnownSharedExports('other-lib')).toBeNull();

    expect(fromSharedVirtualId('not-a-virtual-id')).toBeNull();

    // extractPackageExports:
    const reactExports = await extractPackageExports('react');
    expect(reactExports).toContain('useState');

    const installedExports = await extractPackageExports('node:path');
    expect(Array.isArray(installedExports)).toBe(true);

    const nonexistentExports = await extractPackageExports('nonexistent-xyz-123');
    expect(nonexistentExports).toEqual([]);

    // createSharedVirtualModule for unknown package without exports:
    const customCode = createSharedVirtualModule('custom-unknown-pkg');
    expect(customCode).toContain('custom-unknown-pkg');
  });

  it('tests shared container in browser context and node register method', () => {
    const nodeContainer = getSharedContainer();
    expect(nodeContainer.get('nonexistentNodePkg')).toBeUndefined();
    nodeContainer.register('nodePkg', { ok: true });
    expect(nodeContainer.get('nodePkg')).toEqual({ ok: true });
    nodeContainer.register('__proto__', { bad: true });

    // Simulate browser window
    const fakeWindow: any = {};
    (globalThis as any).window = fakeWindow;

    try {
      const browserContainer = getSharedContainer();
      expect(browserContainer.version).toBe('1.0.0');
      expect(fakeWindow.__TREEZ_FEDERAL_SHARED__).toBe(browserContainer);

      // Second call returns existing
      const secondCall = getSharedContainer();
      expect(secondCall).toBe(browserContainer);

      // get / set / has / register
      expect(browserContainer.get('nonexistentBrowserPkg')).toBeUndefined();
      browserContainer.set('browserPkg', 'val');
      expect(browserContainer.has('browserPkg')).toBe(true);
      expect(browserContainer.get('browserPkg')).toBe('val');
      browserContainer.register('regPkg', 'regVal');
      expect(browserContainer.get('regPkg')).toBe('regVal');

      // Unsafe keys in browser container
      expect(browserContainer.get('__proto__')).toBeUndefined();
      expect(browserContainer.get('prototype')).toBeUndefined();
      expect(browserContainer.get('constructor')).toBeUndefined();
      expect(browserContainer.has('__proto__')).toBe(false);
      expect(browserContainer.has('prototype')).toBe(false);
      expect(browserContainer.has('constructor')).toBe(false);

      browserContainer.set('__proto__', 'bad');
      browserContainer.set('prototype', 'bad');
      browserContainer.set('constructor', 'bad');
      browserContainer.register('__proto__', 'bad');
      browserContainer.register('prototype', 'bad');
      browserContainer.register('constructor', 'bad');
    } finally {
      delete (globalThis as any).window;
    }
  });
});
