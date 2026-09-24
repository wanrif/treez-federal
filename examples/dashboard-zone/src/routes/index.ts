import { createRoute, type AnyRoute } from '@tanstack/react-router';

import { DashboardIndex } from '../views/DashboardIndex';
import { DashboardLayout } from '../views/DashboardLayout';

export function createZoneRoutes(parentRoute: AnyRoute): AnyRoute {
  const dashboardRoot = createRoute({
    getParentRoute: function getParent(): AnyRoute {
      return parentRoute;
    },
    path: 'dashboard',
    component: DashboardLayout,
  });

  const dashboardHome = createRoute({
    getParentRoute: function getParent(): AnyRoute {
      return dashboardRoot;
    },
    path: '/',
    component: DashboardIndex,
  });

  return dashboardRoot.addChildren([dashboardHome]);
}
