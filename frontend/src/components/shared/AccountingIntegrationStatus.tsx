import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompanyModules } from '../../hooks/useCompanyModules';
import { AlertTriangle, CheckCircle2, Settings, ArrowRight, BookOpen } from 'lucide-react';

interface AccountingIntegrationStatusProps {
  moduleCode: 'inventory' | 'purchases' | 'sales';
  hasMappings: boolean;
  integrationRoute?: string;
}

export const AccountingIntegrationStatus: React.FC<AccountingIntegrationStatusProps> = ({
  moduleCode,
  hasMappings,
  integrationRoute,
}) => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { isModuleInstalled, isModuleInitialized } = useCompanyModules();
  const installed = isModuleInstalled('accounting');
  const initialized = isModuleInitialized('accounting');
  const moduleLabel = t(`accountingIntegrationStatus.modules.${moduleCode}`, moduleCode);
  const moduleLabelLower = t(`accountingIntegrationStatus.modulesLower.${moduleCode}`, moduleLabel.toLowerCase());

  if (!installed) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <Settings className="w-4 h-4 text-gray-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
                {t('accountingIntegrationStatus.notEnabled.label', 'Accounting Not Enabled')}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {t('accountingIntegrationStatus.notEnabled.message', '{{module}} operations will track quantities and documents but will NOT create financial/GL postings.', { module: moduleLabel })}
            </p>
            <button
              onClick={() => navigate('/company-admin/modules')}
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-2 font-medium"
            >
              {t('accountingIntegrationStatus.notEnabled.action', 'Enable Accounting')} <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (installed && !initialized) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-200 text-blue-800">
                {t('accountingIntegrationStatus.setupRequired.label', 'Accounting Enabled - Setup Required')}
              </span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              {t('accountingIntegrationStatus.setupRequired.message', 'The Accounting module is enabled but has not been set up yet. Complete the Accounting setup first, then configure {{module}} financial integration.', { module: moduleLabelLower })}
            </p>
            <button
              onClick={() => navigate('/accounting/setup')}
              className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900 mt-2 font-semibold"
            >
              {t('accountingIntegrationStatus.setupRequired.action', 'Complete Accounting Setup')} <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasMappings) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-200 text-amber-800">
                {t('accountingIntegrationStatus.pending.label', 'Financial Integration Pending')}
              </span>
            </div>
            <p className="text-sm text-amber-700 mt-1">
              {t('accountingIntegrationStatus.pending.message', 'Accounting is set up but {{module}} account mappings have not been configured. Financial postings will not be created until mappings are set.', { module: moduleLabel })}
            </p>
            {integrationRoute && (
              <button
                onClick={() => navigate(integrationRoute)}
                className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 mt-2 font-semibold"
              >
                {t('accountingIntegrationStatus.pending.action', 'Configure Integration')} <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-200 text-green-800">
              {t('accountingIntegrationStatus.active.label', 'Financial Integration Active')}
            </span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            {t('accountingIntegrationStatus.active.message', '{{module}} is fully integrated with Accounting. All operations create financial/GL postings.', { module: moduleLabel })}
          </p>
        </div>
      </div>
    </div>
  );
};
