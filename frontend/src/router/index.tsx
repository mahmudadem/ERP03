import { Suspense, lazy } from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';

import { AppShell } from '../layout/AppShell';
import { routesConfig } from './routes.config';

// Auth & Security
import { LoginPage } from '../pages/LoginPage';
import { RequireAuth } from '../components/auth/RequireAuth';
import { RequireOnboarding } from '../components/auth/RequireOnboarding';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

// Onboarding
import { LandingPage, PlanSelectionPage, CompaniesListPage } from '../modules/onboarding';

// Lazy pages
const ForbiddenPage = lazy(() => import('../pages/ForbiddenPage'));
const CompanySelectorPageLazy = lazy(() => import('../modules/company-selector/CompanySelectorPage'));
const NewCompanyWizardPage = lazy(() => import('../modules/onboarding/pages/NewCompanyWizardPage'));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[400px] text-gray-400">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
    <span>Loading resource...</span>
  </div>
);

// Routes
const routes = [
  // Public: Landing page for signup/login
  {
    path: '/auth',
    element: <LandingPage />,
  },
  // Legacy login route - redirect to new landing
  {
    path: '/login',
    element: <Navigate to="/auth?mode=login" replace />,
  },
  // Onboarding: Plan selection (requires auth, skip onboarding check)
  {
    path: '/onboarding/plan',
    element: (
      <RequireAuth>
        <PlanSelectionPage />
      </RequireAuth>
    ),
  },
  // Company selector (requires auth only - no plan check to avoid redirect loop after plan selection)
  {
    path: '/company-selector',
    element: (
      <RequireAuth>
        <CompaniesListPage />
      </RequireAuth>
    ),
  },
  // New Company Wizard (standalone, no app shell)
  {
    path: '/company-wizard',
    element: (
      <RequireAuth>
        <Suspense fallback={<PageLoader />}>
          <NewCompanyWizardPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  // Main app routes (requires auth + plan)
  {
    path: '/',
    element: (
      <RequireOnboarding>
        <AppShell />
      </RequireOnboarding>
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


