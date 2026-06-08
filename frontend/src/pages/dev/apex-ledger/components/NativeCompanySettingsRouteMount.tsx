import React, { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../../../../components/auth/ProtectedRoute';
import { ModuleConfigurationGuard, WorkflowModeGuard } from '../../../../components/guards';
import { AppRoute, routesConfig } from '../../../../router/routes.config';
import { APEX_ROOT, tenantPathToApexPath } from '../routeMap';

const COMPANY_SETTINGS_ROUTE_PATHS = new Set([
  '/system/currencies',
  '/settings/tax-codes',
  '/settings/notifications',
  '/settings/communications',
]);

const isCompanySettingsRoute = (path: string) => {
  return path.startsWith('/company-admin/') || COMPANY_SETTINGS_ROUTE_PATHS.has(path);
};

const companySettingsNativeRoutes = routesConfig.filter((route) => isCompanySettingsRoute(route.path));

const toApexRoutePath = (tenantPath: string) => tenantPath.replace(/^\//, '');

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

function isCompanySettingsTenantPath(path: string) {
  return path.startsWith('/company-admin/') || COMPANY_SETTINGS_ROUTE_PATHS.has(path);
}

function useApexCompanySettingsNavigationBridge() {
  useEffect(() => {
    const redirectCompanySettingsHashBackIntoApex = () => {
      const hashPath = readHashPath();
      if (!isCompanySettingsTenantPath(hashPath)) return;

      const apexPath = tenantPathToApexPath(hashPath);
      if (apexPath && apexPath.startsWith(APEX_ROOT)) {
        replaceHashPath(apexPath);
      }
    };

    window.addEventListener('hashchange', redirectCompanySettingsHashBackIntoApex);
    return () => window.removeEventListener('hashchange', redirectCompanySettingsHashBackIntoApex);
  }, []);
}

function GuardedNativeCompanySettingsPage({ route }: { route: AppRoute }) {
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

export function NativeCompanySettingsRouteMount() {
  useApexCompanySettingsNavigationBridge();

  return (
    <Suspense fallback={<NativeCompanySettingsPageLoader />}>
      <Routes>
        {companySettingsNativeRoutes.map((route) => (
          <Route
            key={route.path}
            path={toApexRoutePath(route.path)}
            element={<GuardedNativeCompanySettingsPage route={route} />}
          />
        ))}
        <Route path="company-admin/*" element={<Navigate to={`${APEX_ROOT}/company-admin/overview`} replace />} />
        <Route path="settings/*" element={<Navigate to={`${APEX_ROOT}/company-admin/settings`} replace />} />
        <Route path="system/*" element={<Navigate to={`${APEX_ROOT}/system/currencies`} replace />} />
        <Route path="*" element={<Navigate to={`${APEX_ROOT}/company-admin/overview`} replace />} />
      </Routes>
    </Suspense>
  );
}

function NativeCompanySettingsPageLoader() {
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
