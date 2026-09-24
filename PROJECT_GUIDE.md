# ⚡ treez-federal

> Next.js Multi-Zones architecture for Vite and Rolldown with first-class TanStack Router integration.

---

## 1. Overview & Objective

`treez-federal` brings the **Multi-Zones** architecture (popularized by Next.js) to the Vite Single Page Application ecosystem:

- **Path-Based Zone Routing:** Splits monolithic frontends into independent applications organized under a single domain (`/` for Root Shell, `/dashboard/*` for Dashboard Zone, `/analytics/*` for Analytics Zone).
- **Client-Side SPA Navigation:** Transition across zones without triggering hard browser reloads (F5), preserving shared layout containers, memory context, and client state.
- **Auto-Proxying Dev Server:** Eliminates manual reverse proxy configurations during local development via automated Vite connect middleware.
- **Full TanStack Router Continuity:** Ensures a single singleton router context, route parameter validation integrity, and uninterrupted data loader lifecycles.

---

## 2. Core Architecture

### Topology & Request Routing

```text
Domain: [https://app.example.com](https://app.example.com)
 ├── /               -> Root Shell Zone (Host Orchestrator)
 ├── /dashboard/*    -> Remote Zone: Dashboard (Base: /dashboard/)
 └── /settings/*     -> Remote Zone: Settings  (Base: /settings/)

```

### Runtime Shared Container

Prevents duplicate instantiation of stateful singletons in the browser:

```text
window.__TREEZ_FEDERAL_SHARED__
 ├── react
 ├── react-dom
 └── @tanstack/react-router

```

---

## 3. Package & Repository Structure

Managed via monorepo workspaces (Bun):

```text
treez-federal/
├── packages/
│   └── treez-federal/                # Core plugin & client runtime
│       ├── src/
│       │   ├── index.ts               # Vite plugin factory export
│       │   ├── types.ts               # Config types (strict isolatedDeclarations)
│       │   ├── constants.ts           # Shared presets & virtual specifiers
│       │   ├── server/
│       │   │   └── proxy-middleware.ts # Dev server dynamic proxy for zone routes
│       │   ├── host/
│       │   │   ├── zone-matcher.ts    # Dynamic zone resolution logic
│       │   │   └── virtual-loader.ts  # Dynamic ESM importer
│       │   ├── zone/
│       │   │   ├── entry-builder.ts   # zoneEntry.js generator & base path isolation
│       │   │   └── manifest.ts        # TanStack route metadata extraction
│       │   ├── shared/
│       │   │   └── externals.ts       # Shared singleton externalizer
│       │   └── runtime/
│       │       ├── index.ts           # Browser container registry
│       │       └── router.ts          # TanStack Router zone route helpers
│       ├── package.json
│       ├── tsdown.config.ts
│       └── tsconfig.json
├── examples/
│   ├── shell-host/                    # Root zone (Port 3000)
│   └── dashboard-zone/                # Dashboard zone (Port 3001, Base /dashboard/)
├── package.json
└── tsconfig.base.json

```

---

## 4. API & Configuration Design

### A. Remote Zone Configuration

```ts
// dashboard-zone/vite.config.ts
import { defineConfig } from 'vite';
import { federal } from 'treez-federal';

export default defineConfig({
  base: '/dashboard/',
  server: {
    port: 3001,
  },
  plugins: [
    federal({
      name: 'dashboardZone',
      mode: 'zone',
      basePath: '/dashboard',
      routes: './src/routes/index.ts',
      shared: ['react', 'react-dom', '@tanstack/react-router'],
    }),
  ],
});
```

### B. Root Shell Configuration (Host Orchestrator)

```ts
// shell-host/vite.config.ts
import { defineConfig } from 'vite';
import { federal } from 'treez-federal';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    federal({
      name: 'rootShell',
      mode: 'host',
      zones: {
        dashboard: {
          basePath: '/dashboard',
          target: 'http://localhost:3001',
        },
      },
      shared: ['react', 'react-dom', '@tanstack/react-router'],
    }),
  ],
});
```

---

## 5. TanStack Router Multi-Zone Integration

### Remote Zone: Expose Sub-Route Factory

```ts
// dashboard-zone/src/routes/index.ts
import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../views/DashboardLayout';
import { DashboardIndex } from '../views/DashboardIndex';

export function createZoneRoutes(parentRoute: AnyRoute) {
  const dashboardRoot = createRoute({
    getParentRoute: () => parentRoute,
    path: 'dashboard',
    component: DashboardLayout,
  });

  const dashboardHome = createRoute({
    getParentRoute: () => dashboardRoot,
    path: '/',
    component: DashboardIndex,
  });

  return dashboardRoot.addChildren([dashboardHome]);
}
```

### Root Shell: Mount Zone Route

```tsx
// shell-host/src/router.ts
import { createRootRoute, createRouter } from '@tanstack/react-router';
import { createZoneRoute } from 'treez-federal/router';
import { ShellLayout } from './ShellLayout';

const rootRoute = createRootRoute({
  component: ShellLayout,
});

const dashboardRoute = createZoneRoute({
  parentRoute: rootRoute,
  zoneName: 'dashboard',
  basePath: 'dashboard',
  loaderFallback: () => <div>Loading Dashboard Zone...</div>,
});

const routeTree = rootRoute.addChildren([dashboardRoute]);

export const router = createRouter({ routeTree });
```

---

## 6. Tooling & Development Conventions

- **Compiler & Bundler:** `tsdown` powered by `rolldown`.
- **DTS Generator:** `oxc` declaration engine (`isolatedDeclarations: true`).
- **Linter:** `oxlint` (Rust-based static analyzer).
- **Formatter:** `oxfmt` (tabs, single quotes).
- **Code Conventions:**
- Function declarations over function expressions (`function foo() {}`).
- Strict ternary operators (`condition ? 'value' : null`).
- Explicit return types must be defined on all public functions and exported interfaces.

---

## 7. Implementation Milestones

| Phase       | Milestone                | Success Criteria                                                                                                       |
| ----------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Phase 1** | Workspace & Engine Setup | `treez-federal` compiles cleanly via `tsdown` + `oxc` without declaration errors.                                      |
| **Phase 2** | Dev Server Auto-Proxy    | Host transparently proxies `/dashboard/assets/*` requests to the remote dev server using Vite middleware.              |
| **Phase 3** | Shared Scope Container   | `react` and `@tanstack/react-router` maintain singleton runtime states without duplicate context errors.               |
| **Phase 4** | TanStack Zone Adapter    | Helper `createZoneRoute` successfully stitches the remote route sub-tree and executes client-side SPA navigation.      |
| **Phase 5** | Production Static Build  | Asset paths isolate cleanly into separate base directories; host and zones deploy independently to static CDN storage. |
