/**
 * SettingsSecurityTab.tsx
 *
 * Security & Safety information tab for AI Assistant settings.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, AlertTriangle, ToggleLeft } from 'lucide-react';
import { SettingsSection } from '../../../components/shared/ModuleSettingsLayout';

export const SettingsSecurityTab: React.FC = () => {
  const { t } = useTranslation('aiAssistant');

  return (
    <SettingsSection
      title={t('settings.securityTab', 'Security & Safety')}
      description={t('settings.securityDesc', 'Learn about the security and safety design of the AI Assistant.')}
      onSave={() => {}}
      hideSaveButton
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">
              {t('settings.safetyTitle', 'Advisory-Only Design')}
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              {t('settings.safetyDesc')}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-amber-800">
              {t('settings.apiKeySecurity', 'API Key Security')}
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              {t('settings.apiKeySecurityDesc')}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <ToggleLeft className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-gray-800">
              {t('settings.rateLimiting', 'Rate Limiting')}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {t('settings.rateLimitingDesc')}
            </p>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
};