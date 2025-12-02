import { Suspense, lazy } from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';

import { AppShell } from '../layout/AppShell';
import { routesConfig } from './routes.config';

// Auth & Security
import { LoginPage } from '../pages/LoginPage';
import { RequireAuth } from '../components/auth/RequireAuth';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

// Lazy pages
const ForbiddenPage = lazy(() => import('../pages/ForbiddenPage'));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[400px] text-gray-400">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
    <span>Loading resource...</span>
  </div>
);

// Routes
const routes = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      ...routesConfig.map((route) => ({
        path: route.path === '/' ? undefined : route.path.replace(/^\//, ''),
        index: route.path === '/',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              requiredPermission={route.requiredPermission}
              requiredGlobalRole={route.requiredGlobalRole}
              requiredModule={route.requiredModule}
            >
              <route.component />
            </ProtectedRoute>
          </Suspense>
        ),
      })),

      {
        path: 'forbidden',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ForbiddenPage />
          </Suspense>
        ),
      },

      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
];

export const router = createHashRouter(routes);
