import React, { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../../../../components/auth/ProtectedRoute';
import { ModuleConfigurationGuard, WorkflowModeGuard } from '../../../../components/guards';
import { AppRoute, routesConfig } from '../../../../router/routes.config';
import { APEX_ROOT, tenantPathToApexPath } from '../routeMap';

type NativeModuleRouteMountProps = {
  modulePath: 'accounting' | 'purchases' | 'inventory' | 'settings' | 'ai' | 'tools' | 'remaining';
  fallback: React.ReactElement;
};

const MODULE_ROUTE_CONFIG: Record<
  NativeModuleRouteMountProps['modulePath'],
  { tenantRoots: string[]; apexRoot: string; apexRoots?: string[] }
> = {
  accounting: {
    tenantRoots: ['/accounting'],
    apexRoot: `${APEX_ROOT}/accounting`,
    apexRoots: [`${APEX_ROOT}/accounting`, `${APEX_ROOT}/vouchers`, `${APEX_ROOT}/coa`, `${APEX_ROOT}/reports`],
  },
  purchases: { tenantRoots: ['/purchases'], apexRoot: `${APEX_ROOT}/purchases` },
  inventory: { tenantRoots: ['/inventory'], apexRoot: `${APEX_ROOT}/inventory` },
  settings: { tenantRoots: ['/settings'], apexRoot: `${APEX_ROOT}/settings` },
  ai: { tenantRoots: ['/ai-assistant'], apexRoot: `${APEX_ROOT}/ai` },
  tools: { tenantRoots: ['/tools'], apexRoot: `${APEX_ROOT}/tools` },
  remaining: {
    tenantRoots: [
      '/companies',
      '/notifications',
      '/companyAdmin',
      '/error-test',
      '/test-notification',
      '/hr',
      '/pos',
      '/super-admin',
      '/company-wizard',
      '/crm',
      '/manufacturing',
      '/projects',
      '/canvas-dev',
    ],
    apexRoot: APEX_ROOT,
  },
};

const readHashPath = () => {
  const rawPath = window.location.hash.replace(/^#/, '') || '/';
  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
};

const replaceHashPath = (nextPath: string) => {
  const nextHash = `#${nextPath.startsWith('/') ? nextPath : `/${nextPath}`}`;
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  window.history.replaceState(null, '', nextUrl);
  window.dispatchEvent(new Event('hashchange'));
};

const toApexRoutePath = (tenantPath: string) => {
  const apexPath = tenantPathToApexPath(tenantPath);
  return (apexPath || tenantPath).replace(new RegExp(`^${APEX_ROOT.replace('/', '\\/')}/?`), '');
};

function getNativeRoutes(modulePath: NativeModuleRouteMountProps['modulePath']) {
  const { tenantRoots } = MODULE_ROUTE_CONFIG[modulePath];
  return routesConfig.filter((route) =>
    tenantRoots.some((routeRoot) => route.path === routeRoot || route.path.startsWith(`${routeRoot}/`))
  );
}

function useApexModuleNavigationBridge(modulePath: NativeModuleRouteMountProps['modulePath']) {
  useEffect(() => {
    const redirectModuleHashBackIntoApex = () => {
      const hashPath = readHashPath();
      const { tenantRoots, apexRoot, apexRoots } = MODULE_ROUTE_CONFIG[modulePath];
      const isModuleTenantPath = tenantRoots.some((tenantRoot) =>
        hashPath === tenantRoot || hashPath.startsWith(`${tenantRoot}/`)
      );

      if (!isModuleTenantPath) return;

      const apexPath = tenantPathToApexPath(hashPath);
      const allowedApexRoots = apexRoots || [apexRoot];
      if (apexPath && allowedApexRoots.some((allowedRoot) => apexPath.startsWith(allowedRoot))) {
        replaceHashPath(apexPath);
      }
    };

    window.addEventListener('hashchange', redirectModuleHashBackIntoApex);
    return () => window.removeEventListener('hashchange', redirectModuleHashBackIntoApex);
  }, [modulePath]);
}

function GuardedNativeModulePage({ route }: { route: AppRoute }) {
  const Page = route.component;
  const page = <Page />;
  const protectedPage = (
    <ProtectedRoute
      requiredPermission={route.requiredPermission}
      requiredGlobalRole={route.requiredGlobalRole}
      requiredModule={route.requiredModule}
    >
      {page}
    </ProtectedRoute>
  );

  const workflowPage = route.requiredOperationalWorkflow ? (
    <WorkflowModeGuard module={route.requiredOperationalWorkflow}>
      {protectedPage}
    </WorkflowModeGuard>
  ) : (
    protectedPage
  );

  if (route.requiredModule && route.section !== 'SETUP') {
    return (
      <ModuleConfigurationGuard moduleCode={route.requiredModule}>
        {workflowPage}
      </ModuleConfigurationGuard>
    );
  }

  return workflowPage;
}

export function NativeModuleRouteMount({
  modulePath,
  fallback,
}: NativeModuleRouteMountProps) {
  useApexModuleNavigationBridge(modulePath);
  const nativeRoutes = getNativeRoutes(modulePath);
  const { apexRoot } = MODULE_ROUTE_CONFIG[modulePath];
  const fallbackPath = apexRoot.replace(new RegExp(`^${APEX_ROOT.replace('/', '\\/')}/?`), '');

  return (
    <Suspense fallback={<NativeModulePageLoader />}>
      <Routes>
        {nativeRoutes.map((route) => (
          <Route
            key={route.path}
            path={toApexRoutePath(route.path)}
            element={<GuardedNativeModulePage route={route} />}
          />
        ))}
        <Route path={`${fallbackPath}/*`} element={fallback} />
        <Route path="*" element={<Navigate to={apexRoot} replace />} />
      </Routes>
    </Suspense>
  );
}

function NativeModulePageLoader() {
  const { t } = useTranslation('common');

  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white">
      <div className="space-y-2 text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <p className="font-mono text-[11px] text-slate-400">
          {t('auth.loadingResource', { defaultValue: 'Loading page...' })}
        </p>
      </div>
    </div>
  );
}
