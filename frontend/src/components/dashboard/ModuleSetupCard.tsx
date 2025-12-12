import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanyModules } from '../../hooks/useCompanyModules';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Settings, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';

/**
 * Module Setup Card - Shows on Dashboard
 * Displays uninitialized modules and prompts user to complete setup
 */
export const ModuleSetupCard: React.FC = () => {
  const { modules, loading } = useCompanyModules();
  const navigate = useNavigate();

  // Filter uninitialized modules
  const uninitializedModules = modules.filter((m) => !m.initialized);

  // Debug logging
  console.log('[ModuleSetupCard] Render:', { loading, modulesCount: modules.length, uninitializedCount: uninitializedModules.length });

  // Don't show card if loading or all modules are initialized
  if (loading || uninitializedModules.length === 0) {
    return null;
  }

  // Map module codes to friendly names and setup paths
  const getModuleInfo = (moduleCode: string) => {
    const moduleMap: Record<string, { name: string; description: string; path: string }> = {
      accounting: {
        name: 'Accounting',
        description: 'Set up your chart of accounts and fiscal year',
        path: '/accounting/setup',
      },
      inventory: {
        name: 'Inventory',
        description: 'Configure warehouses and stock settings',
        path: '/inventory/setup',
      },
      hr: {
        name: 'Human Resources',
        description: 'Set up departments and employee structure',
        path: '/hr/setup',
      },
      pos: {
        name: 'Point of Sale',
        description: 'Configure POS terminals and payment methods',
        path: '/pos/setup',
      },
      companyAdmin: {
        name: 'Company Administration',
        description: 'Finalize company settings and permissions',
        path: '/companyAdmin/setup',
      },
    };

    return (
      moduleMap[moduleCode] || {
        name: moduleCode,
        description: 'Complete module setup',
        path: `/${moduleCode}/setup`,
      }
    );
  };

  return (
    <Card variant="default" className="border-l-4 border-l-amber-500">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="shrink-0 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
          <Settings className="w-6 h-6 text-amber-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Complete Module Setup
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {uninitializedModules.length === 1
              ? '1 module needs configuration before you can use it.'
              : `${uninitializedModules.length} modules need configuration before you can use them.`}
          </p>

          {/* Module List */}
          <div className="space-y-3">
            {uninitializedModules.map((module) => {
              const info = getModuleInfo(module.moduleCode);
              return (
                <div
                  key={module.moduleCode}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900">{info.name}</h4>
                    <p className="text-sm text-gray-600">{info.description}</p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(info.path)}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Setup Now
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ModuleSetupCard;
