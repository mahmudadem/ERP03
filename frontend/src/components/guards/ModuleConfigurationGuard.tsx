import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

/**
 * ModuleConfigurationGuard
 * 
 * Guards module routes and shows a setup prompt if the module is not initialized.
 * 
 * For REQUIRED modules (e.g., accounting):
 * - User MUST configure to access
 * - "Cancel" redirects to dashboard
 * - Cannot bypass setup
 * 
 * For OPTIONAL modules (e.g., inventory):
 * - User can skip configuration
 * - "Skip for Now" allows access
 * - Can configure later
 * 
 * Usage:
 * ```tsx
 * <Route path="/accounting/*" element={
 *   <ModuleConfigurationGuard moduleCode="accounting">
 *     <AccountingModule />
 *   </ModuleConfigurationGuard>
 * } />
 * ```
 */
export const ModuleConfigurationGuard: React.FC<ModuleConfigurationGuardProps> = ({
  moduleCode,
  children,
}) => {
  const { modules, loading } = useCompanyModules();
  const navigate = useNavigate();
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

  // If module not found in company modules, allow access (shouldn't happen normally)
  if (!module) {
    console.warn(`[ModuleConfigurationGuard] Module "${moduleCode}" not found in company modules`);
    return <>{children}</>;
  }

  // If module is initialized, show content
  if (module.initialized) {
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

