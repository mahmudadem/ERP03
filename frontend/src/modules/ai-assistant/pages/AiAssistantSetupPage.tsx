import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom'; import { useTranslation } from 'react-i18next'; import { } from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { companyModulesApi } from '../../../api/companyModules';
import { emitCompanyModulesRefresh } from '../../../utils/companyModulesEvents';
import { useCompanyModules } from '../../../hooks/useCompanyModules';
import { AiSetupWizard } from '../components/AiSetupWizard';

export const AiAssistantSetupPage: React.FC = () => {
  const { t } = useTranslation('aiAssistant');
  const navigate = useNavigate();
  const { hasPermission } = useRBAC();
  const { companyId } = useCompanyAccess();
  const { loading: modulesLoading, isModuleInitialized } = useCompanyModules();

  const canManage = hasPermission('ai-assistant.settings.manage');
  const canView = hasPermission('ai-assistant.settings.view');

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t('settings.noPermission')}</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t('settings.noPermission')}</p>
      </div>
    );
  }

  if (modulesLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500">
        <Spinner variant="indigo" className="mr-2" />
        {t('settings.loading', 'Loading settings...')}
      </div>
    );
  }

  if (isModuleInitialized('ai-assistant')) {
    return <Navigate to="/ai-assistant/settings" replace />;
  }

  const handleSetupComplete = async () => {
    if (companyId) {
      await companyModulesApi.initialize(companyId, 'ai-assistant', {
        setupCompletedAt: new Date().toISOString(),
      });
      emitCompanyModulesRefresh({ companyId, moduleCode: 'ai-assistant' });
    }

    navigate('/ai-assistant/settings', { replace: true });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <AiSetupWizard
        isConfigured={false}
        onComplete={handleSetupComplete}
      />
    </div>
  );
};

export default AiAssistantSetupPage;
