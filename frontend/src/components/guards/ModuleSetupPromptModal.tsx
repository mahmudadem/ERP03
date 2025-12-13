import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator,
  Package,
  Users,
  ShoppingCart,
  Building2,
  FileText,
  CheckCircle,
  X,
  AlertCircle,
} from 'lucide-react';

interface ModuleSetupPromptModalProps {
  moduleCode: string;
  onSkip: () => void;
  isRequired?: boolean;
}

interface ModuleInfo {
  name: string;
  description: string;
  setupPath: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  setupSteps: string[];
  isRequired: boolean; // Critical modules must be configured
}

const getModuleInfo = (moduleCode: string): ModuleInfo => {
  const moduleMap: Record<string, ModuleInfo> = {
    accounting: {
      name: 'Accounting',
      description: 'Set up your accounting foundation to track finances, manage transactions, and generate reports.',
      setupPath: '/accounting/setup',
      icon: Calculator,
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-600',
      isRequired: true, // ← Critical module
      setupSteps: [
        'Configure Chart of Accounts',
        'Set Fiscal Year',
        'Select Default Currency',
      ],
    },
    companyAdmin: {
      name: 'Company Administration',
      description: 'Finalize your company settings, permissions, and user access controls.',
      setupPath: '/companyAdmin/setup',
      icon: Building2,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      isRequired: false, // ← Optional - owner user is sufficient
      setupSteps: [
        'Complete Company Profile',
        'Set Up User Roles',
        'Configure Permissions',
      ],
    },
    inventory: {
      name: 'Inventory',
      description: 'Configure warehouse management, product categories, and stock tracking settings.',
      setupPath: '/inventory/setup',
      icon: Package,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      isRequired: false, // Optional
      setupSteps: [
        'Create Warehouses',
        'Set Up Product Categories',
        'Define Units of Measure',
      ],
    },
    hr: {
      name: 'Human Resources',
      description: 'Set up your organization structure, departments, and employee management system.',
      setupPath: '/hr/setup',
      icon: Users,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      isRequired: false, // Optional
      setupSteps: [
        'Create Departments',
        'Define Employee Positions',
        'Configure Attendance Settings',
      ],
    },
    pos: {
      name: 'Point of Sale',
      description: 'Configure POS terminals, payment methods, and cashier workflows.',
      setupPath: '/pos/setup',
      icon: ShoppingCart,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      isRequired: false, // Optional
      setupSteps: [
        'Set Up POS Terminals',
        'Configure Payment Methods',
        'Define Product Categories',
      ],
    },
    crm: {
      name: 'CRM',
      description: 'Set up sales pipelines, teams, and lead management workflows.',
      setupPath: '/crm/setup',
      icon: Users,
      iconBg: 'bg-pink-50',
      iconColor: 'text-pink-600',
      isRequired: false, // Optional
      setupSteps: [
        'Create Sales Pipelines',
        'Set Up Sales Teams',
        'Configure Lead Sources',
      ],
    },
    invoicing: {
      name: 'Invoicing',
      description: 'Configure invoice templates, tax rules, and payment terms.',
      setupPath: '/invoicing/setup',
      icon: FileText,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      isRequired: false, // Optional
      setupSteps: [
        'Set Up Tax Rules',
        'Define Payment Terms',
        'Customize Invoice Templates',
      ],
    },
  };

  return (
    moduleMap[moduleCode] || {
      name: moduleCode,
      description: 'This module requires configuration before use.',
      setupPath: `/${moduleCode}/setup`,
      icon: Building2,
      iconBg: 'bg-gray-50',
      iconColor: 'text-gray-600',
      isRequired: false,
      setupSteps: ['Complete module setup'],
    }
  );
};

export const ModuleSetupPromptModal: React.FC<ModuleSetupPromptModalProps> = ({
  moduleCode,
  onSkip,
}) => {
  const navigate = useNavigate();
  const info = getModuleInfo(moduleCode);
  const Icon = info.icon;

  const handleStartWizard = () => {
    navigate(info.setupPath);
  };

  return (
    <>
      {/* Backdrop - Don't close on click if required */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" 
        onClick={info.isRequired ? undefined : onSkip}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full pointer-events-auto animate-in fade-in zoom-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-6 pb-4">
            {/* Only show close button for non-required modules */}
            {!info.isRequired && (
              <button
                onClick={onSkip}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 ${info.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-7 h-7 ${info.iconColor}`} />
              </div>
              <div className="flex-1 pt-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {info.name} {info.isRequired ? 'Required' : 'Not Configured'}
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {info.description}
                </p>
              </div>
            </div>
          </div>

          {/* Required Notice */}
          {info.isRequired && (
            <div className="mx-6 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-900">Configuration Required</p>
                <p className="text-xs text-amber-700 mt-1">
                  This module is critical for your business operations and must be configured before use.
                </p>
              </div>
            </div>
          )}

          {/* Setup Steps */}
          <div className="px-6 pb-6">
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Quick Setup Includes:
              </h3>
              <ul className="space-y-2">
                {info.setupSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleStartWizard}
                className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm shadow-sm hover:shadow transition-all duration-200"
              >
                Start Configuration Wizard
              </button>
              
              {/* Show "Skip" for optional modules, "Cancel" for required modules */}
              <button
                onClick={onSkip}
                className="px-4 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg font-medium text-sm transition-colors duration-200"
              >
                {info.isRequired ? 'Cancel' : 'Skip for Now'}
              </button>
            </div>

            {/* Footer message */}
            <p className="text-xs text-gray-500 text-center mt-4">
              {info.isRequired 
                ? 'You can configure this module later from the dashboard.'
                : 'You can configure this module anytime from the settings.'
              }
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModuleSetupPromptModal;
