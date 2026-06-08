import React, { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../../../../components/auth/ProtectedRoute';
import { ModuleConfigurationGuard, WorkflowModeGuard } from '../../../../components/guards';
import { AppRoute, routesConfig } from '../../../../router/routes.config';
import { APEX_ROOT, tenantPathToApexPath } from '../routeMap';

const salesNativeRoutes = routesConfig.filter((route) => route.path.startsWith('/sales/'));

const toApexSalesRoutePath = (tenantPath: string) => tenantPath.replace(/^\//, '');

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

function useApexSalesNavigationBridge() {
  useEffect(() => {
    const redirectSalesHashBackIntoApex = () => {
      const hashPath = readHashPath();
      const isSalesTenantPath = hashPath === '/sales' || hashPath.startsWith('/sales/');

      if (!isSalesTenantPath) return;

      const apexPath = tenantPathToApexPath(hashPath);
      if (apexPath && apexPath.startsWith(`${APEX_ROOT}/sales`)) {
        replaceHashPath(apexPath);
      }
    };

    window.addEventListener('hashchange', redirectSalesHashBackIntoApex);
    return () => window.removeEventListener('hashchange', redirectSalesHashBackIntoApex);
  }, []);
}

function GuardedNativeSalesPage({ route }: { route: AppRoute }) {
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

export function NativeSalesRouteMount({
  fallback,
}: {
  fallback: React.ReactElement;
}) {
  useApexSalesNavigationBridge();

  return (
    <Suspense fallback={<NativeSalesPageLoader />}>
      <Routes>
        {salesNativeRoutes.map((route) => (
          <Route
            key={route.path}
            path={toApexSalesRoutePath(route.path)}
            element={<GuardedNativeSalesPage route={route} />}
          />
        ))}
        <Route path="sales/*" element={fallback} />
        <Route path="*" element={<Navigate to={`${APEX_ROOT}/sales`} replace />} />
      </Routes>
    </Suspense>
  );
}

function NativeSalesPageLoader() {
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
