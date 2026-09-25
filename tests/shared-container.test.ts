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
  });
});
