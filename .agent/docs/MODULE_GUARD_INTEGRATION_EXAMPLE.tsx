/**
 * INTEGRATION EXAMPLE - Module Configuration Guard
 * 
 * This file shows how to integrate the ModuleConfigurationGuard into your router.
 * Copy the relevant parts into your router/index.tsx file.
 */

import { Suspense } from 'react';
import { ModuleConfigurationGuard } from '../components/guards';

// Example: Wrapping a single route with the guard
// ================================================

// BEFORE (without guard):
{
  path: 'accounting',
  element: (
    <Suspense fallback={<PageLoader />}>
      <ProtectedRoute requiredModule="accounting">
        <AccountingHomePage />
      </ProtectedRoute>
    </Suspense>
  ),
}

// AFTER (with guard):
{
  path: 'accounting',
  element: (
    <Suspense fallback={<PageLoader />}>
      <ModuleConfigurationGuard moduleCode="accounting">
        <ProtectedRoute requiredModule="accounting">
          <AccountingHomePage />
        </ProtectedRoute>
      </ModuleConfigurationGuard>
    </Suspense>
  ),
}

// Example: Complete router integration
// =====================================

// In your router/index.tsx, modify the main app routes section:

// CURRENT CODE (lines 120-136):
children: [
  ...routesConfig
    .filter((route) => route.section !== 'SUPER_ADMIN')
    .map((route) => ({
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
]

// UPDATED CODE (with guard):
children: [
  ...routesConfig
    .filter((route) => route.section !== 'SUPER_ADMIN')
    .map((route) => ({
      path: route.path === '/' ? undefined : route.path.replace(/^\//, ''),
      index: route.path === '/',
      element: (
        <Suspense fallback={<PageLoader />}>
          {/* Wrap with guard if route requires a module (except SETUP routes) */}
          {route.requiredModule && route.section !== 'SETUP' ? (
            <ModuleConfigurationGuard moduleCode={route.requiredModule}>
              <ProtectedRoute
                requiredPermission={route.requiredPermission}
                requiredGlobalRole={route.requiredGlobalRole}
                requiredModule={route.requiredModule}
              >
                <route.component />
              </ProtectedRoute>
            </ModuleConfigurationGuard>
          ) : (
            <ProtectedRoute
              requiredPermission={route.requiredPermission}
              requiredGlobalRole={route.requiredGlobalRole}
              requiredModule={route.requiredModule}
            >
              <route.component />
            </ProtectedRoute>
          )}
        </Suspense>
      ),
    })),
]

// Example: Manual integration for specific modules only
// ======================================================

// If you want to guard only specific modules (e.g., accounting and inventory):

children: [
  ...routesConfig
    .filter((route) => route.section !== 'SUPER_ADMIN')
    .map((route) => {
      const shouldGuard = ['accounting', 'inventory', 'crm', 'hr'].includes(route.requiredModule || '');
      
      return {
        path: route.path === '/' ? undefined : route.path.replace(/^\//, ''),
        index: route.path === '/',
        element: (
          <Suspense fallback={<PageLoader />}>
            {shouldGuard && route.section !== 'SETUP' ? (
              <ModuleConfigurationGuard moduleCode={route.requiredModule!}>
                <ProtectedRoute
                  requiredPermission={route.requiredPermission}
                  requiredGlobalRole={route.requiredGlobalRole}
                  requiredModule={route.requiredModule}
                >
                  <route.component />
                </ProtectedRoute>
              </ModuleConfigurationGuard>
            ) : (
              <ProtectedRoute
                requiredPermission={route.requiredPermission}
                requiredGlobalRole={route.requiredGlobalRole}
                requiredModule={route.requiredModule}
              >
                <route.component />
              </ProtectedRoute>
            )}
          </Suspense>
        ),
      };
    }),
]

// Notes:
// - The guard automatically shows the setup prompt for uninitialized modules
// - Users can click "Start Configuration" to go to setup wizard
// - Users can click "Skip for Now" to proceed anyway
// - Once a module is initialized, the guard becomes transparent
// - SETUP routes should NOT be guarded (they ARE the setup pages!)
