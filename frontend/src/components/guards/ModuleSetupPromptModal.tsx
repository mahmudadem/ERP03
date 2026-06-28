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
import { useTranslation } from 'react-i18next';

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

const getModuleInfo = (moduleCode: string, t: (key: string) => string): ModuleInfo => {
  const moduleMap: Record<string, ModuleInfo> = {
    accounting: {
      name: t('moduleSetupModal.modules.accounting.name'),
      description: t('moduleSetupModal.modules.accounting.description'),
      setupPath: '/accounting/setup',
      icon: Calculator,
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-600',
      isRequired: true, // ← Critical module
      setupSteps: [
        t('moduleSetupModal.modules.accounting.steps.0'),
        t('moduleSetupModal.modules.accounting.steps.1'),
        t('moduleSetupModal.modules.accounting.steps.2'),
      ],
    },
    companyAdmin: {
      name: t('moduleSetupModal.modules.companyAdmin.name'),
      description: t('moduleSetupModal.modules.companyAdmin.description'),
      setupPath: '/companyAdmin/setup',
      icon: Building2,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      isRequired: false, // ← Optional - owner user is sufficient
      setupSteps: [
        t('moduleSetupModal.modules.companyAdmin.steps.0'),
        t('moduleSetupModal.modules.companyAdmin.steps.1'),
        t('moduleSetupModal.modules.companyAdmin.steps.2'),
      ],
    },
    inventory: {
      name: t('moduleSetupModal.modules.inventory.name'),
      description: t('moduleSetupModal.modules.inventory.description'),
      setupPath: '/inventory/setup',
      icon: Package,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      isRequired: false, // Optional
      setupSteps: [
        t('moduleSetupModal.modules.inventory.steps.0'),
        t('moduleSetupModal.modules.inventory.steps.1'),
        t('moduleSetupModal.modules.inventory.steps.2'),
      ],
    },
    hr: {
      name: t('moduleSetupModal.modules.hr.name'),
      description: t('moduleSetupModal.modules.hr.description'),
      setupPath: '/hr/setup',
      icon: Users,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      isRequired: false, // Optional
      setupSteps: [
        t('moduleSetupModal.modules.hr.steps.0'),
        t('moduleSetupModal.modules.hr.steps.1'),
        t('moduleSetupModal.modules.hr.steps.2'),
      ],
    },
    pos: {
      name: t('moduleSetupModal.modules.pos.name'),
      description: t('moduleSetupModal.modules.pos.description'),
      setupPath: '/pos/setup',
      icon: ShoppingCart,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      isRequired: false, // Optional
      setupSteps: [
        t('moduleSetupModal.modules.pos.steps.0'),
        t('moduleSetupModal.modules.pos.steps.1'),
        t('moduleSetupModal.modules.pos.steps.2'),
      ],
    },
    crm: {
      name: t('moduleSetupModal.modules.crm.name'),
      description: t('moduleSetupModal.modules.crm.description'),
      setupPath: '/crm/setup',
      icon: Users,
      iconBg: 'bg-pink-50',
      iconColor: 'text-pink-600',
      isRequired: false, // Optional
      setupSteps: [
        t('moduleSetupModal.modules.crm.steps.0'),
        t('moduleSetupModal.modules.crm.steps.1'),
        t('moduleSetupModal.modules.crm.steps.2'),
      ],
    },
    invoicing: {
      name: t('moduleSetupModal.modules.invoicing.name'),
      description: t('moduleSetupModal.modules.invoicing.description'),
      setupPath: '/invoicing/setup',
      icon: FileText,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      isRequired: false, // Optional
      setupSteps: [
        t('moduleSetupModal.modules.invoicing.steps.0'),
        t('moduleSetupModal.modules.invoicing.steps.1'),
        t('moduleSetupModal.modules.invoicing.steps.2'),
      ],
    },
  };

  return (
    moduleMap[moduleCode] || {
      name: moduleCode,
      description: t('moduleSetupModal.modules.defaultDescription'),
      setupPath: `/${moduleCode}/setup`,
      icon: Building2,
      iconBg: 'bg-gray-50',
      iconColor: 'text-gray-600',
      isRequired: false,
      setupSteps: [t('moduleSetupModal.modules.defaultStep')],
    }
  );
};

export const ModuleSetupPromptModal: React.FC<ModuleSetupPromptModalProps> = ({
  moduleCode,
  onSkip,
}) => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const info = getModuleInfo(moduleCode, t);
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
                  {info.name} {info.isRequired ? t('moduleSetupModal.required') : t('moduleSetupModal.notConfigured')}
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
                <p className="text-sm font-medium text-amber-900">{t('moduleSetupModal.configurationRequired')}</p>
                <p className="text-xs text-amber-700 mt-1">
                  {t('moduleSetupModal.configurationRequiredDescription')}
                </p>
              </div>
            </div>
          )}

          {/* Setup Steps */}
          <div className="px-6 pb-6">
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                {t('moduleSetupModal.quickSetupIncludes')}
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
                {t('moduleSetupModal.startWizard')}
              </button>
              
              {/* Show "Skip" for optional modules, "Cancel" for required modules */}
              <button
                onClick={onSkip}
                className="px-4 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg font-medium text-sm transition-colors duration-200"
              >
                {info.isRequired ? t('moduleSetupModal.cancel') : t('moduleSetupModal.skipForNow')}
              </button>
            </div>

            {/* Footer message */}
            <p className="text-xs text-gray-500 text-center mt-4">
              {info.isRequired 
                ? t('moduleSetupModal.requiredFooter')
                : t('moduleSetupModal.optionalFooter')
              }
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModuleSetupPromptModal;
