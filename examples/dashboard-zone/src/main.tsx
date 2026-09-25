import * as TanStackRouter from '@tanstack/react-router';
import { createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { initSharedContainer } from '@wanrif/treez-federal/runtime';
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';

import { createZoneRoutes } from './routes/index';

// Initialize container in standalone development mode:
const container = initSharedContainer();
container.set('react', React);
container.set('react-dom', ReactDOM);
container.set('react-dom/client', ReactDOM);
container.set('react/jsx-runtime', JsxRuntime);
container.set('react/jsx-dev-runtime', JsxDevRuntime);
container.set('@tanstack/react-router', TanStackRouter);

const rootRoute = createRootRoute();
const zoneTree = createZoneRoutes(rootRoute);
const routeTree = rootRoute.addChildren([zoneTree]);
const router = createRouter({ routeTree, basepath: '/dashboard' });

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}
