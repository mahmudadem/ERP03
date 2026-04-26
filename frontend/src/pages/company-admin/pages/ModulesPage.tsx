import React from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useCompanyModules } from '../../../hooks/useCompanyAdmin';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export const ModulesPage: React.FC = () => {
  const { t } = useTranslation('common');
  const { refreshPermissions } = useCompanyAccess();
  const { modules, activeModules, isLoading, enableModule, disableModule, isEnabling, isDisabling } = useCompanyModules();
  const effectiveActiveCount = modules.filter((module) => module.isEnabled ?? module.enabled ?? activeModules.includes(module.id)).length;

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    moduleId: string;
    moduleName: string;
    isEnabled: boolean;
  }>({
    isOpen: false,
    moduleId: '',
    moduleName: '',
    isEnabled: false,
  });

  const handleToggle = (moduleId: string, moduleName: string, isEnabled: boolean) => {
    if (isEnabled) {
      setConfirmDialog({
        isOpen: true,
        moduleId,
        moduleName,
        isEnabled,
      });
    } else {
      enableModule({ moduleName: moduleId }, {
        onSuccess: () => refreshPermissions()
      });
    }
  };

  const handleConfirmToggle = () => {
    const { moduleId, isEnabled } = confirmDialog;
    if (isEnabled) {
      disableModule({ moduleName: moduleId }, {
        onSuccess: () => {
          refreshPermissions();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      });
    }
  };

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.modules.title")} 
        breadcrumbs={[{ label: t('companyAdmin.shared.companyAdmin') }, { label: t('companyAdmin.modules.title') }]}
      />

      <div className="mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">{t('companyAdmin.modules.activeModules')}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {isLoading ? t('companyAdmin.modules.loading') : t('companyAdmin.modules.activeCount', { count: effectiveActiveCount })}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : modules.length === 0 ? (
        <EmptyState 
          title={t('companyAdmin.modules.noModules')} 
          description={t('companyAdmin.modules.noModulesDescription')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => {
            const isEnabled = module.isEnabled ?? module.enabled ?? activeModules.includes(module.id);
            const isMandatory = module.mandatory;
            const isSuspended = module.state === 'suspended';
            const isBlocked = isEnabled && (isSuspended || module.isAvailable === false);
            const blockedReason = module.blockedReason || module.reason || (isSuspended ? 'This module is temporarily suspended.' : undefined);
            const canToggle = !isMandatory && !isEnabling && !isDisabling && (isEnabled || module.isAvailable !== false);
            
            return (
              <Card key={module.id} className={`p-6 ${isBlocked ? 'border-amber-300 bg-amber-50/40' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{module.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{module.description}</p>
                  </div>
                  <div className={`ml-4 px-3 py-1 rounded-full text-xs font-medium ${
                    isBlocked
                      ? 'bg-amber-100 text-amber-800'
                      : isEnabled
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {isBlocked ? 'Blocked' : isEnabled ? t('companyAdmin.modules.active') : t('companyAdmin.modules.inactive')}
                  </div>
                </div>

                {isMandatory && (
                  <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                    <span className="font-medium">{t('companyAdmin.modules.mandatoryModule')}</span> - {t('companyAdmin.modules.cannotBeDisabled')}
                  </div>
                )}

                {isBlocked && (
                  <div className="mb-4 p-3 bg-amber-100 border border-amber-200 rounded text-xs text-amber-800">
                    <span className="font-medium">Runtime blocked.</span> {blockedReason}
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Button
                    variant={isEnabled ? 'secondary' : 'primary'}
                    className="w-full"
                    onClick={() => handleToggle(module.id, module.name, isEnabled)}
                    disabled={!canToggle}
                  >
                    {isEnabling || isDisabling
                      ? t('companyAdmin.modules.processing')
                      : isEnabled
                        ? t('companyAdmin.modules.disableModule')
                        : module.isAvailable === false
                          ? 'Unavailable'
                          : t('companyAdmin.modules.enableModule')}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={t('companyAdmin.modules.disableModule')}
        message={
          <div className="space-y-3">
            <p>{t('companyAdmin.modules.confirmDisable', { moduleName: confirmDialog.moduleName })}</p>
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-xs text-amber-700 border border-amber-100">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>Disabling this module will hide all its related menu items and features from the sidebar for all users immediately.</p>
            </div>
          </div>
        }
        confirmLabel={t('companyAdmin.modules.disableModule')}
        cancelLabel={t('companyAdmin.shared.cancel')}
        onConfirm={handleConfirmToggle}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        isConfirming={isDisabling}
        tone="danger"
      />
    </CompanyAdminLayout>
  );
};

export default ModulesPage;
