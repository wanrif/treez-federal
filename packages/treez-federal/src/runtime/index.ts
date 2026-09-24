import type { SharedContainer } from '../types';

declare global {
  interface Window {
    __TREEZ_FEDERAL_SHARED__?: SharedContainer;
  }
}

let nodeFallbackContainer: SharedContainer | null = null;

export function initSharedContainer(): SharedContainer {
  const existing = getSharedContainer();
  return existing;
}

export function getSharedContainer(): SharedContainer {
  const isBrowser = typeof window !== 'undefined';

  if (isBrowser) {
    const existing = window.__TREEZ_FEDERAL_SHARED__;
    if (existing) {
      return existing;
    }

    const modules: Record<string, unknown> = Object.create(null);

    const container: SharedContainer = {
      version: '1.0.0',
      modules,
      get<T = unknown>(name: string): T | undefined {
        if (name === '__proto__' || name === 'prototype' || name === 'constructor') {
          return undefined;
        }
        return modules[name] !== undefined ? (modules[name] as T) : undefined;
      },
      set<T = unknown>(name: string, mod: T): void {
        if (name === '__proto__' || name === 'prototype' || name === 'constructor') {
          return;
        }
        modules[name] = mod;
      },
      has(name: string): boolean {
        if (name === '__proto__' || name === 'prototype' || name === 'constructor') {
          return false;
        }
        return Object.prototype.hasOwnProperty.call(modules, name);
      },
      register(name: string, mod: unknown): void {
        if (name === '__proto__' || name === 'prototype' || name === 'constructor') {
          return;
        }
        modules[name] = mod;
      },
    };

    window.__TREEZ_FEDERAL_SHARED__ = container;
    return container;
  }

  if (nodeFallbackContainer) {
    return nodeFallbackContainer;
  }

  const modules: Record<string, unknown> = Object.create(null);
  const container: SharedContainer = {
    version: '1.0.0',
    modules,
    get<T = unknown>(name: string): T | undefined {
      if (name === '__proto__' || name === 'prototype' || name === 'constructor') {
        return undefined;
      }
      return modules[name] !== undefined ? (modules[name] as T) : undefined;
    },
    set<T = unknown>(name: string, mod: T): void {
      if (name === '__proto__' || name === 'prototype' || name === 'constructor') {
        return;
      }
      modules[name] = mod;
    },
    has(name: string): boolean {
      if (name === '__proto__' || name === 'prototype' || name === 'constructor') {
        return false;
      }
      return Object.prototype.hasOwnProperty.call(modules, name);
    },
    register(name: string, mod: unknown): void {
      if (name === '__proto__' || name === 'prototype' || name === 'constructor') {
        return;
      }
      modules[name] = mod;
    },
  };

  nodeFallbackContainer = container;
  return container;
}

export function getSharedModule<T = unknown>(name: string): T | undefined {
  const container = getSharedContainer();
  return container.get<T>(name);
}

export function setSharedModule<T = unknown>(name: string, module: T): void {
  const container = getSharedContainer();
  container.set<T>(name, module);
}

export function hasSharedModule(name: string): boolean {
  const container = getSharedContainer();
  return container.has(name);
}
