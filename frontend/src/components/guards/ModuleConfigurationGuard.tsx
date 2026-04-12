import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useCompanyModules } from '../../hooks/useCompanyModules';
import { ModuleSetupPromptModal } from './ModuleSetupPromptModal';

interface ModuleConfigurationGuardProps {
  moduleCode: string;
  children: React.ReactNode;
}

// Configuration map to determine which modules are required
const MODULE_CONFIG: Record<string, { isRequired: boolean }> = {
  accounting: { isRequired: true },
  companyAdmin: { isRequired: false },
  inventory: { isRequired: false },
  hr: { isRequired: false },
  pos: { isRequired: false },
  crm: { isRequired: false },
  invoicing: { isRequired: false },
};

// Modules that have dedicated setup/entry routes that should remain reachable
// even before the module is fully initialized.
const MODULE_INIT_ROUTES: Record<string, string[]> = {
  accounting: ['/accounting/setup'],
  inventory: ['/inventory'],
  purchase: ['/purchases'],
  sales: ['/sales', '/sales/settings'],
};

/**
 * ModuleConfigurationGuard
 *
 * Guards module routes and enforces initialization flow.
 * - If a module has a configured initialization handler route, users are redirected there.
 * - If not, fallback behavior uses setup prompt modal logic.
 */
export const ModuleConfigurationGuard: React.FC<ModuleConfigurationGuardProps> = ({
  moduleCode,
  children,
}) => {
  const { modules, loading } = useCompanyModules();
  const navigate = useNavigate();
  const location = useLocation();
  const [userSkipped, setUserSkipped] = useState(false);

  const isAllowedPreInitRoute = (path: string, routes: string[]): boolean =>
    routes.some((route) => {
      const normalizedRoute = route.toLowerCase();
      return path === normalizedRoute || path === `${normalizedRoute}/`;
    });

  // Get module configuration
  const moduleConfig = MODULE_CONFIG[moduleCode] || { isRequired: false };

  // While loading, show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Find the module
  const module = modules.find((m) => m.moduleCode === moduleCode);

  // If module not found, treat modules with initialization handlers as not initialized.
  // This keeps routing strict even when installation records are missing.
  if (!module) {
    const initializationRoutes = MODULE_INIT_ROUTES[moduleCode];
    if (initializationRoutes?.length) {
      const path = location.pathname.toLowerCase();
      const isInitializationRoute = isAllowedPreInitRoute(path, initializationRoutes);

      if (!isInitializationRoute) {
        return <Navigate to={initializationRoutes[0]} replace />;
      }

      return <>{children}</>;
    }

    console.warn(`[ModuleConfigurationGuard] Module "${moduleCode}" not found in company modules`);
    return <>{children}</>;
  }

  // If module is initialized, show content
  if (module.initialized) {
    return <>{children}</>;
  }

  // Direct redirect to module initialization handler when available
  const initializationRoutes = MODULE_INIT_ROUTES[moduleCode];
  if (initializationRoutes?.length) {
    const path = location.pathname.toLowerCase();
    const isInitializationRoute = isAllowedPreInitRoute(path, initializationRoutes);

    if (!isInitializationRoute) {
      return <Navigate to={initializationRoutes[0]} replace />;
    }

    return <>{children}</>;
  }

  // If module is OPTIONAL and user skipped, allow access
  if (!moduleConfig.isRequired && userSkipped) {
    return <>{children}</>;
  }

  // Module not initialized - show setup prompt
  const handleSkipOrCancel = () => {
    if (moduleConfig.isRequired) {
      // For REQUIRED modules: Redirect to dashboard (don't allow access)
      navigate('/');
    } else {
      // For OPTIONAL modules: Allow access
      setUserSkipped(true);
    }
  };

  return (
    <ModuleSetupPromptModal
      moduleCode={moduleCode}
      onSkip={handleSkipOrCancel}
    />
  );
};

export default ModuleConfigurationGuard;

