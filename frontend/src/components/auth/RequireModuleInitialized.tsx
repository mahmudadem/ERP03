import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanyModules } from '../../hooks/useCompanyModules';
import { Loader2 } from 'lucide-react';

interface RequireModuleInitializedProps {
  moduleCode: string;
  children: React.ReactNode;
  initializationPath?: string; // Custom path to initialization wizard
}

/**
 * Guard component that checks if a module is initialized.
 * If not, redirects to the module's initialization wizard.
 */
export const RequireModuleInitialized: React.FC<RequireModuleInitializedProps> = ({
  moduleCode,
  children,
  initializationPath,
}) => {
  const { isModuleInitialized, getModuleStatus, loading } = useCompanyModules();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    const moduleStatus = getModuleStatus(moduleCode);
    
    // If module isn't installed at all, something is wrong
    if (!moduleStatus) {
      console.warn(`Module ${moduleCode} not found in company modules`);
      return;
    }

    // If module is not initialized, redirect to wizard
    if (!moduleStatus.initialized) {
      const wizardPath = initializationPath || `/${moduleCode}/setup`;
      navigate(wizardPath, { replace: true });
    }
  }, [moduleCode, loading, getModuleStatus, navigate, initializationPath]);

  // Show loading state while checking
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="text-sm text-gray-600">Checking module status...</p>
        </div>
      </div>
    );
  }

  // Check if initialized before rendering children
  if (!isModuleInitialized(moduleCode)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="text-sm text-gray-600">Redirecting to setup wizard...</p>
        </div>
      </div>
    );
  }

  // Module is initialized, render children
  return <>{children}</>;
};

export default RequireModuleInitialized;
