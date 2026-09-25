import type { ReactElement } from 'react';

import { createRootRoute, createRouter, createRoute } from '@tanstack/react-router';
import { createZoneRoute } from '@wanrif/treez-federal/router';

import { ShellLayout } from './ShellLayout';

const rootRoute = createRootRoute({
  component: ShellLayout,
});

const indexRoute = createRoute({
  getParentRoute: function getParent() {
    return rootRoute;
  },
  path: '/',
  component: function Home(): ReactElement {
    return (
      <div className="card">
        <span className="badge badge-host">Host View</span>
        <h1>⚡ Root Shell Orchestrator</h1>
        <p style={{ marginTop: '0.5rem', color: '#9ca3af' }}>
          This is the host shell running at port 3000. It manages multi-zone routing and shared
          dependencies.
        </p>

        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#1f2937',
            borderRadius: '8px',
          }}
        >
          <h3>Multi-Zone Architecture Demonstration</h3>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', color: '#d1d5db' }}>
            <li>
              Click <strong>+1</strong> in the header to modify host state.
            </li>
            <li>
              Navigate to <strong>Dashboard Zone</strong> via client-side routing.
            </li>
            <li>
              Observe that state in the header is preserved across zone boundaries without hard
              reloads.
            </li>
          </ul>
        </div>
      </div>
    );
  },
});

const dashboardRoute = createZoneRoute({
  parentRoute: rootRoute,
  zoneName: 'dashboard',
  basePath: 'dashboard',
  loaderFallback: function Fallback(): ReactElement {
    return <div className="loading-zone">Loading Dashboard Zone...</div>;
  },
});

const routeTree = rootRoute.addChildren([indexRoute, dashboardRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
