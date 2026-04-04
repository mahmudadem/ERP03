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

// Modules that have a dedicated initialization handler route
const MODULE_INIT_PATHS: Record<string, string> = {
  accounting: '/accounting/setup',
  inventory: '/inventory',
  purchase: '/purchases',
  sales: '/sales',
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
    const initializationPath = MODULE_INIT_PATHS[moduleCode];
    if (initializationPath) {
      const path = location.pathname.toLowerCase();
      const targetPath = initializationPath.toLowerCase();
      const isInitializationRoute = path === targetPath || path === `${targetPath}/`;

      if (!isInitializationRoute) {
        return <Navigate to={initializationPath} replace />;
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
  const initializationPath = MODULE_INIT_PATHS[moduleCode];
  if (initializationPath) {
    const path = location.pathname.toLowerCase();
    const targetPath = initializationPath.toLowerCase();
    const isInitializationRoute = path === targetPath || path === `${targetPath}/`;

    if (!isInitializationRoute) {
      return <Navigate to={initializationPath} replace />;
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

